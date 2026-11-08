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
    console.log('Browser smoke passed: create -> persist -> reload -> continue -> world');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
