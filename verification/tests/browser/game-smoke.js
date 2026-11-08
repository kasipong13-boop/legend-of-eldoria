#!/usr/bin/env node
// End-to-end smoke test for the actual game page on desktop and iPhone-sized Chromium.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const errors = [];
  try {
    for (const viewport of [{ name:'desktop', width:1280, height:800 }, { name:'iphone', width:390, height:844 }]) {
      const context = await browser.newContext({ viewport: { width:viewport.width, height:viewport.height }, isMobile:viewport.name==='iphone', hasTouch:viewport.name==='iphone' });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(viewport.name + ': ' + String(e)));
      page.on('console', m => { if (m.type()==='error') errors.push(viewport.name + ' console: ' + m.text()); });
      await page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
      await page.locator('#screen-title.active').waitFor();
      await page.getByRole('button', { name:'Begin the journey' }).click();
      await page.locator('#screen-world.active').waitFor();
      const hud = await page.locator('#hud-zone').textContent();
      if (!hud.includes('Greenvale Village')) throw new Error(viewport.name + ': village HUD missing');
      await page.locator('#btn-menu').click();
      await page.locator('#game-menu:not([hidden])').waitFor();
      await page.getByRole('button', { name:'Save & Return to Title' }).click();
      await page.locator('#screen-title.active').waitFor();
      await page.locator('#btn-continue:not([hidden])').waitFor();
      await page.getByRole('button', { name:'Continue' }).click();
      await page.locator('#screen-world.active').waitFor();
      results.push({ viewport:viewport.name, title:'pass', newGame:'pass', village:'pass', menu:'pass', returnToTitle:'pass', continueAfterReload:'pass' });
      await context.close();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ results, pageErrors:errors }, null, 2));
    console.log('PASS  actual game smoke test on desktop and iPhone-sized Chromium');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode=1; });
