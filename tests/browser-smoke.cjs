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
    console.log('Browser smoke passed: desktop create -> persist -> reload -> continue; mobile preview and responsive layout');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
