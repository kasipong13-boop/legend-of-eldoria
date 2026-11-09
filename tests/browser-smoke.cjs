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
    await page.locator('#btn-card-collection').click();
    await page.waitForFunction(() => document.querySelector('#screen-card-collection').classList.contains('active'));
    assert.match(await page.locator('#collection-summary').textContent(), /0 owned card copies/);
    assert.match(await page.locator('#collection-owned').textContent(), /No cards collected yet/);
    assert.match(await page.locator('#collection-presets').textContent(), /No saved deck presets yet/);
    await page.locator('#btn-card-collection-back').click();
    await page.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
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
    await mobile.locator('#character-name').fill('มือถือทดสอบ');
    await mobile.locator('#btn-create-confirm').tap();
    await mobile.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
    await mobile.locator('#btn-card-collection').tap();
    await mobile.waitForFunction(() => document.querySelector('#screen-card-collection').classList.contains('active'));
    assert.match(await mobile.locator('#collection-summary').textContent(), /0 owned card copies/);
    const collectionLayout = await mobile.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(collectionLayout.scroll <= collectionLayout.width + 1, 'no horizontal overflow on mobile Card Collection');
    await mobile.locator('#btn-card-collection-back').tap();
    await mobile.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
    const layout = await mobile.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(layout.scroll <= layout.width + 1, 'no horizontal page overflow on mobile');
    assert.deepEqual(mobileErrors, [], 'no uncaught mobile browser errors');
    await mobile.close();

    // Exercise the real world-to-battle transition, win flow, reward persistence, and reload.
    await page.evaluate(() => {
      const E = window.ELDORIA;
      // Test-only catalog fixture: verify that only explicitly eligible special cards enter the reward flow.
      E.CARDS.bash.acquisitionType = 'monster-special-skill';
      E.CARDS.bash.rarity = 'Rare';
      E.MONSTER_CARD_DROP_TABLE.poring = [{ cardId: 'bash', chance: 1 }];
      const debug = E.World._debug;
      const poring = debug.getPoring();
      Object.assign(debug.hero, { c: poring.c, r: poring.r, x: poring.x, y: poring.y, path: [], moving: false });
    });
    await page.waitForFunction(() => document.querySelector('#screen-battle').classList.contains('active'), { timeout: 5000 });
    let turns = 0;
    while (turns < 14 && !(await page.locator('#screen-result').evaluate(e => e.classList.contains('active')))) {
      const attacks = page.locator('#hand .card.attack:not(.disabled), #hand .card.spell:not(.disabled)');
      if (await attacks.count()) {
        await attacks.first().click();
      } else {
        const endTurn = page.locator('#btn-end-turn');
        if (!(await endTurn.isEnabled())) {
          await page.waitForFunction(() => document.querySelector('#screen-result').classList.contains('active'), { timeout: 3000 });
          break;
        }
        await endTurn.click();
        turns++;
      }
      await page.waitForTimeout(80);
    }
    await page.waitForFunction(() => document.querySelector('#screen-result').classList.contains('active'), { timeout: 15000 });
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
    assert.deepEqual(savedAfterBattle.deckCollection.owned, [{ cardId: 'bash', stars: 1, quantity: 1 }], 'monster special skill card saved to collection');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-start').click();
    await page.waitForFunction(() => document.querySelector('#screen-select').classList.contains('active'));
    const savedMeta = await page.locator('#character-list').textContent();
    assert.match(savedMeta, /Lv 1|Lv 2/, 'saved character remains selectable after battle reload');
    assert.match(savedMeta, /Gold/, 'saved gold remains visible after reload');
    await page.locator('#character-list .btn').click();
    await page.waitForFunction(() => document.querySelector('#screen-world').classList.contains('active'));
    await page.locator('#btn-card-collection').click();
    await page.waitForFunction(() => document.querySelector('#screen-card-collection').classList.contains('active'));
    assert.match(await page.locator('#collection-owned').textContent(), /Bash/, 'card collection shows acquired card after reload');
    assert.match(await page.locator('#collection-summary').textContent(), /1 owned card copies/, 'card quantity persists after reload');
    assert.deepEqual(errors, [], 'no uncaught desktop browser errors after battle');
    console.log('Browser smoke passed: character create/reload/continue, desktop and mobile Card Collection navigation, mobile preview, Poring battle victory, item and card rewards, and post-battle reload');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
