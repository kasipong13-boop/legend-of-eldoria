const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
(async () => {
  const server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: 'ignore' });
  let browser;
  try {
    await new Promise(r => setTimeout(r, 1200));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#screen-title').evaluate(e => e.classList.contains('active')), true);
    await page.locator('#btn-new').click();
    await page.locator('#character-name').fill('ทดสอบเอลโดเรีย');
    await page.locator('#btn-create-confirm').click();
    await page.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
    const keys = await page.evaluate(() => Object.keys(localStorage));
    assert.ok(keys.some(k => k === 'eldoria.index'), 'character index persisted');
    assert.ok(keys.some(k => k.endsWith('.main')), 'character main save persisted');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-start').click();
    await page.waitForFunction(() => document.querySelector('#screen-select').classList.contains('active'));
    await page.locator('#character-list .btn').click();
    await page.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
    // Exercise the real browser Save API for collection ownership and reusable presets.
    const deckPersisted = await page.evaluate(() => {
      const ids = JSON.parse(localStorage.getItem('eldoria.index'));
      const character = window.ELDORIA.Save.loadCharacter(ids[0]);
      const saved = window.ELDORIA.Save.saveDeckData(character, {
        owned: [
          { cardId: 'strike', stars: 1, quantity: 3 },
          { cardId: 'guard', stars: 1, quantity: 2 }
        ],
        presets: [
          { id: 'qa-balanced', name: 'QA Balanced', cardRefs: [{ cardId: 'strike', stars: 1 }, { cardId: 'guard', stars: 1 }] },
          { id: 'qa-alternate', name: 'QA Alternate', cardRefs: [{ cardId: 'strike', stars: 1 }] }
        ],
        activePresetId: 'qa-balanced'
      });
      return { revision: saved.revision, deck: window.ELDORIA.Save.getDeckData(saved) };
    });
    assert.equal(deckPersisted.deck.owned.length, 2, 'browser Save API persists owned card stacks');
    assert.equal(deckPersisted.deck.presets.length, 2, 'browser Save API persists multiple presets');
    await page.reload({ waitUntil: 'networkidle' });
    const deckAfterReload = await page.evaluate(() => {
      const ids = JSON.parse(localStorage.getItem('eldoria.index'));
      return window.ELDORIA.Save.getDeckData(window.ELDORIA.Save.loadCharacter(ids[0]));
    });
    assert.equal(deckAfterReload.activePresetId, 'qa-balanced', 'active preset survives a real browser reload');
    assert.equal(deckAfterReload.owned[0].quantity, 3, 'owned card quantity survives a real browser reload');
    assert.equal(deckAfterReload.presets.length, 2, 'preset collection survives a real browser reload');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mobileErrors = [];
    mobile.on('pageerror', e => mobileErrors.push(e.message));
    await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await mobile.locator('#btn-new').tap();
    await mobile.waitForFunction(() => document.querySelector('#screen-create').classList.contains('active'));
    const preview = mobile.locator('#creation-avatar');
    assert.equal(await preview.isVisible(), true, 'mobile character preview visible');
    const before = await preview.locator('.avatar-hair').evaluate(e => getComputedStyle(e).backgroundColor);
    await mobile.locator('#character-color').selectOption('6');
    const after = await preview.locator('.avatar-hair').evaluate(e => getComputedStyle(e).backgroundColor);
    assert.notEqual(after, before, 'hair color updates live preview');
    const layout = await mobile.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(layout.scroll <= layout.width + 1, 'no horizontal page overflow on mobile');
    assert.deepEqual(mobileErrors, [], 'no uncaught mobile browser errors');
    await mobile.close();

    // Exercise the real world-to-battle transition, win flow, reward persistence, and reload.
    await page.evaluate(() => {
      // Keep this browser smoke test focused on the transition/reward/save path:
      // a one-HP Poring guarantees a quick victory without timing-sensitive turn loops.
      window.ELDORIA.MONSTERS.poring.hp = 1;
      window.ELDORIA.World.onEncounter({ mapId: 'greenvale-village', monsterIds: ['poring'] });
    });
    await page.waitForFunction(() => document.querySelector('#screen-battle').classList.contains('active'), { timeout: 5000 });
    assert.equal(await page.locator('#live-battlefield .live-cell').count(), 100, 'live battle screen renders the 10x10 battlefield');
    assert.equal(await page.locator('#live-battlefield .live-unit').count(), 2, 'live battlefield renders hero and encountered enemy');
    assert.equal(await page.locator('#live-battlefield .live-unit-intent').count(), 1, 'live enemy intent is visible on its battlefield cell');
    // The 10-card starter deck always draws at least one of its five attack cards
    // into a five-card opening hand; do not accidentally choose the non-damaging Heal spell.
    const attacks = page.locator('#hand .card.attack:not(.disabled)');
    await page.waitForFunction(() => document.querySelectorAll('#hand .card.attack:not(.disabled)').length > 0, { timeout: 5000 });
    await attacks.first().click();
    await page.waitForFunction(() => document.querySelector('#screen-result').classList.contains('active'), { timeout: 5000 });
    assert.equal(await page.locator('#result-title').textContent(), 'Victory!', 'battle can be won with starter deck');
    await page.locator('#btn-result').click();
    await page.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
    const savedAfterBattle = await page.evaluate(() => {
      const ids = JSON.parse(localStorage.getItem('eldoria.index'));
      const raw = JSON.parse(localStorage.getItem('eldoria.char.' + ids[0] + '.main'));
      return raw.payload;
    });
    assert.equal(savedAfterBattle.stats.exp, 12, 'victory EXP saved');
    assert.ok(savedAfterBattle.gold >= 5 && savedAfterBattle.gold <= 10, 'victory gold saved');
    assert.equal(savedAfterBattle.activeDeckPresetId, 'qa-balanced', 'world snapshot preserves active deck preset');
    assert.equal(savedAfterBattle.deckCollection.owned[0].quantity, 3, 'world snapshot preserves card ownership');
    assert.equal(savedAfterBattle.deckPresets.length, 2, 'world snapshot preserves all deck presets');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-start').click();
    await page.waitForFunction(() => document.querySelector('#screen-select').classList.contains('active'));
    const savedMeta = await page.locator('#character-list').textContent();
    assert.match(savedMeta, /Lv 1|Lv 2/, 'saved character remains selectable after battle reload');
    assert.match(savedMeta, /Gold/, 'saved gold remains visible after reload');
    assert.deepEqual(errors, [], 'no uncaught desktop browser errors after battle');
    // Exercise both real portal tiles, force a three-Poring spawn, and verify grouped battle handoff.
    const forest = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const forestErrors = [];
    forest.on('pageerror', e => forestErrors.push(e.message));
    await forest.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await forest.locator('#btn-new').click();
    await forest.locator('#character-name').fill('Forest QA');
    await forest.locator('#btn-create-confirm').click();
    await forest.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));

    // Stand on the village F tile; the world update loop must perform the map transition.
    await forest.evaluate(() => {
      const h = window.ELDORIA.World._debug.hero;
      Object.assign(h, { c:10, r:10, x:10, y:10, path:[], moving:false });
    });
    await forest.waitForFunction(() => window.ELDORIA.World._debug.getMapId() === 'whispering-forest' && document.querySelector('#hud-zone').textContent === 'Whispering Forest', { timeout: 5000 });
    const arrival = await forest.evaluate(() => ({ x:window.ELDORIA.World._debug.hero.c, y:window.ELDORIA.World._debug.hero.r }));
    assert.deepEqual(arrival, { x:2, y:10 }, 'Forest arrival is beside, not on, the return portal');

    // Stand on the Forest E tile and confirm the return transition.
    await forest.evaluate(() => {
      const h = window.ELDORIA.World._debug.hero;
      Object.assign(h, { c:1, r:10, x:1, y:10, path:[], moving:false });
    });
    await forest.waitForFunction(() => window.ELDORIA.World._debug.getMapId() === 'greenvale-village' && document.querySelector('#hud-zone').textContent === 'Greenvale Village', { timeout: 5000 });

    // Re-enter through F with deterministic maximum group size and harmless 1-HP QA enemies.
    await forest.evaluate(() => {
      Math.random = () => 0.999;
      window.ELDORIA.MONSTERS.poring.hp = 1;
      window.ELDORIA.MONSTERS.poring.moves = [{ name: 'QA Bounce', damage: 0 }];
      const h = window.ELDORIA.World._debug.hero;
      Object.assign(h, { c:10, r:10, x:10, y:10, path:[], moving:false });
    });
    await forest.waitForFunction(() => window.ELDORIA.World._debug.getMapId() === 'whispering-forest', { timeout: 5000 });
    const forestState = await forest.evaluate(() => ({
      mapId: window.ELDORIA.World._debug.getMapId(),
      count: window.ELDORIA.World._debug.getPorings().length,
      label: document.querySelector('#hud-zone').textContent
    }));
    assert.equal(forestState.mapId, 'whispering-forest', 'Forest map loads through the village portal');
    assert.equal(forestState.label, 'Whispering Forest', 'HUD reflects the active map');
    assert.equal(forestState.count, 3, 'Forest supports a maximum three-Poring group');
    const forestCanvas = await forest.locator('#world-canvas').evaluate(canvas => {
      const ctx = canvas.getContext('2d');
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4 * 97) {
        if (pixels[i + 3] > 0) colors.add(pixels[i] + ',' + pixels[i + 1] + ',' + pixels[i + 2]);
      }
      return { width: canvas.width, height: canvas.height, colorCount: colors.size };
    });
    assert.ok(forestCanvas.width > 0 && forestCanvas.height > 0, 'Forest canvas has a valid mobile render surface');
    assert.ok(forestCanvas.colorCount > 12, 'Forest scene renders varied ground, foliage, and atmospheric colors');

    await forest.evaluate(() => {
      const d = window.ELDORIA.World._debug, p = d.getPorings()[0];
      Object.assign(d.hero, { c:p.c, r:p.r, x:p.x, y:p.y, path:[], moving:false });
    });
    await forest.waitForFunction(() => document.querySelector('#screen-battle').classList.contains('active'), { timeout: 5000 });
    assert.equal(await forest.locator('#live-battlefield .live-unit.enemy').count(), 3, 'Touching one Poring starts battle with all three spawned Porings');
    assert.equal(await forest.locator('#live-battlefield .live-cell').count(), 100, 'Forest encounter uses the 10x10 battlefield');

    // Win the actual three-enemy battle through the live card UI.
    let groupTurns = 0;
    while (groupTurns < 6 && !(await forest.locator('#screen-result').evaluate(e => e.classList.contains('active')))) {
      const attacks = forest.locator('#hand .card.attack:not(:disabled), #hand .card.spell:not(:disabled)').filter({ hasNotText: 'Heal' });
      if (await attacks.count()) {
        await attacks.first().click();
        const targetCell = forest.locator('#live-battlefield .live-cell:has(.live-unit.enemy)').first();
        if (await targetCell.count()) await targetCell.click();
      } else {
        const endTurn = forest.locator('#btn-end-turn');
        if (!(await endTurn.isEnabled())) break;
        await endTurn.click();
        groupTurns++;
      }
      await forest.waitForTimeout(50);
    }
    await forest.waitForFunction(() => document.querySelector('#screen-result').classList.contains('active'), { timeout: 10000 });
    assert.equal(await forest.locator('#result-title').textContent(), 'Victory!', 'three-Poring encounter can be defeated through the live UI');
    const rewardLines = await forest.locator('#result-list').textContent();
    assert.match(rewardLines, /36 EXP/, 'group victory aggregates 12 EXP per Poring');
    await forest.locator('#btn-result').click();
    await forest.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
    const groupSave = await forest.evaluate(() => {
      const ids = JSON.parse(localStorage.getItem('eldoria.index'));
      return JSON.parse(localStorage.getItem('eldoria.char.' + ids[0] + '.main')).payload;
    });
    assert.equal(groupSave.stats.level, 2, 'aggregated group EXP triggers level-up');
    assert.equal(groupSave.stats.exp, 16, 'remaining EXP is saved after group level-up');
    assert.ok(groupSave.gold >= 15, 'group Gold reward is saved');
    await forest.reload({ waitUntil: 'networkidle' });
    await forest.locator('#btn-start').click();
    await forest.waitForFunction(() => document.querySelector('#screen-select').classList.contains('active'));
    const persistedGroup = await forest.locator('#character-list').textContent();
    assert.match(persistedGroup, /Lv 2/, 'level from group reward survives reload');
    assert.match(persistedGroup, /Gold/, 'group Gold remains visible after reload');
    assert.deepEqual(forestErrors, [], 'no uncaught errors in Forest portal, battle, rewards, or reload');
    await forest.close();

    // Exercise the isolated Battle Core v2 multi-unit battlefield UI.
    const grid = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const gridErrors = [];
    grid.on('pageerror', e => gridErrors.push(e.message));
    await grid.goto('http://127.0.0.1:4173/battle-grid-test.html', { waitUntil: 'networkidle' });
    assert.equal(await grid.locator('#arena .cell').count(), 100, 'battlefield renders 10x10 cells');
    assert.equal(await grid.locator('#arena .cell .unit').count(), 3, 'hero and two enemies render');
    assert.equal(await grid.locator('#arena .cell .unit-intent').count(), 2, 'both enemies show their next intent');
    assert.match(await grid.locator('#arena .cell .unit-intent').first().textContent(), /Bounce/, 'enemy intent name is visible');
    const bash = grid.locator('#hand .card').filter({ hasText: 'Bash' }).first();
    assert.equal(await bash.count(), 1, 'deterministic test hand contains Bash');
    await bash.click();
    await grid.locator('#arena .cell').nth(38).click(); // Poring A at x=8, y=3
    await grid.waitForFunction(() => document.querySelector('#battle-log').textContent.includes('Damage to poring-a'));
    assert.match(await grid.locator('#arena .cell').nth(38).locator('.unit-effects').textContent(), /VUL 1/, 'Vulnerable status is visible on the battlefield unit');
    assert.equal(await grid.locator('#arena .cell').nth(38).locator('.unit').count(), 1, 'target remains visible after damage');
    const gridMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await gridMobile.goto('http://127.0.0.1:4173/battle-grid-test.html', { waitUntil: 'networkidle' });
    assert.equal(await gridMobile.locator('#arena .cell').count(), 100, 'mobile battlefield renders all cells');
    const gridLayout = await gridMobile.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(gridLayout.scroll <= gridLayout.width + 1, 'battlefield has no horizontal overflow on mobile');
    assert.deepEqual(gridErrors, [], 'no uncaught errors in multi-unit battlefield');
    await gridMobile.close();
    await grid.close();

    // Exercise the multi-enemy adapter on the real battle screen at a phone viewport.
    const liveGroup = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const liveGroupErrors = [];
    liveGroup.on('pageerror', e => liveGroupErrors.push(e.message));
    await liveGroup.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await liveGroup.evaluate(() => {
      Math.random = () => 0;
      document.querySelector('#screen-battle').classList.add('active');
      window.ELDORIA.BattleUI.startEncounter(
        { hp: 50, maxHp: 50 },
        [
          { id: 'poring-a', monsterId: 'poring', x: 8, y: 2 },
          { id: 'poring-b', monsterId: 'poring', x: 8, y: 7 }
        ],
        () => {}
      );
    });
    assert.equal(await liveGroup.locator('#live-battlefield .live-cell').count(), 100, 'live multi-enemy screen renders 100 cells');
    assert.equal(await liveGroup.locator('#live-battlefield .live-unit.enemy').count(), 2, 'live adapter renders both enemies');
    const liveAttacks = liveGroup.locator('#hand .card.attack:not(:disabled)');
    assert.ok(await liveAttacks.count() > 0, 'live multi-enemy hand contains an attack card');
    await liveAttacks.first().click();
    assert.equal(await liveGroup.locator('#live-battlefield .live-cell.targetable').count(), 2, 'manual target selection highlights both eligible enemies');
    assert.equal(await liveGroup.locator('#hand .card:disabled').count(), (await liveGroup.locator('#hand .card').count()) - 1, 'other cards are locked while the selected card remains active');
    assert.equal(await liveGroup.locator('#hand .card:not(:disabled)').count(), 1, 'only the selected card remains active during target selection');
    await liveGroup.locator('#live-battlefield .live-unit.enemy').first().locator('xpath=..').click();
    await liveGroup.waitForFunction(() => document.querySelector('#battle-log').textContent.includes('Hit poring-'));
    assert.equal(await liveGroup.locator('#live-battlefield .live-cell.targetable').count(), 0, 'target selection clears after card resolves');
    const liveGroupLayout = await liveGroup.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(liveGroupLayout.scroll <= liveGroupLayout.width + 1, 'live multi-enemy battle has no horizontal overflow on mobile');
    assert.deepEqual(liveGroupErrors, [], 'no uncaught errors in live multi-enemy adapter');
    await liveGroup.close();
    console.log('Browser smoke passed: character/save/reward regression, legacy battle, isolated grid UI, and live multi-enemy target selection on mobile');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
