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
      const debug = window.ELDORIA.World._debug;
      const poring = debug.getPoring();
      Object.assign(debug.hero, { c: poring.c, r: poring.r, x: poring.x, y: poring.y, path: [], moving: false });
    });
    await page.waitForFunction(() => document.querySelector('#screen-battle').classList.contains('active'), { timeout: 5000 });
    assert.equal(await page.locator('#live-battlefield .live-cell').count(), 100, 'live battle screen renders the 10x10 battlefield');
    assert.equal(await page.locator('#live-battlefield .live-unit').count(), 2, 'live battlefield renders hero and encountered enemy');
    assert.equal(await page.locator('#live-battlefield .live-unit-intent').count(), 1, 'live enemy intent is visible on its battlefield cell');
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
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-start').click();
    await page.waitForFunction(() => document.querySelector('#screen-select').classList.contains('active'));
    const savedMeta = await page.locator('#character-list').textContent();
    assert.match(savedMeta, /Lv 1|Lv 2/, 'saved character remains selectable after battle reload');
    assert.match(savedMeta, /Gold/, 'saved gold remains visible after reload');
    assert.deepEqual(errors, [], 'no uncaught desktop browser errors after battle');
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
    console.log('Browser smoke passed: character create/reload/continue, mobile preview, legacy Poring battle, rewards, and Battle Core v2 10x10 multi-unit UI');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
