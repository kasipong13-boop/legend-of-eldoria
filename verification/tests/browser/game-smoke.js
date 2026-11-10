#!/usr/bin/env node
// End-to-end smoke test for character creation/selection and existing save flows.
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
      await page.getByRole('button', { name:'Create New Character' }).click();
      await page.locator('#screen-create.active').waitFor();
      await page.getByRole('button', { name:'Back' }).click();
      await page.locator('#screen-title.active').waitFor();
      await page.getByRole('button', { name:'Create New Character' }).click();
      await page.locator('#screen-create.active').waitFor();
      await page.locator('#character-name').fill('Eldoria Hero');
      await page.locator('#character-gender').selectOption('female');
      await page.locator('#character-hair').selectOption('3');
      await page.locator('#character-color').selectOption('6');
      await page.getByRole('button', { name:'Create Character' }).click();
      await page.locator('#screen-world.active').waitFor();
      const coreSaveBeforeCollection = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\\.char\\.[a-f0-9]{32}\\.main$/.test(k));
        return localStorage.getItem(key);
      });
      await page.locator('#btn-card-collection').click();
      await page.locator('#screen-card-collection.active').waitFor();
      assert.match(await page.locator('#collection-summary').textContent(), /10 owned card copies · 5 card variants · 1 deck preset/);
      assert.match(await page.locator('#collection-owned').textContent(), /Strike/);
      assert.match(await page.locator('#collection-presets').textContent(), /Starter Deck/);
      const sidecarSaved = await page.evaluate(() => {
        const save = window.ELDORIA.GameSave.getCurrentSave();
        const collection = window.ELDORIA.CardCollection.get(save.characterId);
        const stored = window.ELDORIA.CardCollection.save(save.characterId, collection.data);
        return { ok: stored.ok, key: window.ELDORIA.CardCollection.keyFor(save.characterId) };
      });
      assert.equal(sidecarSaved.ok, true, 'collection sidecar can be saved independently');
      assert.match(sidecarSaved.key, /^eldoria\\.cards\\./);
      const coreSaveAfterCollection = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\\.char\\.[a-f0-9]{32}\\.main$/.test(k));
        return localStorage.getItem(key);
      });
      assert.equal(coreSaveAfterCollection, coreSaveBeforeCollection, 'collection must not touch the character Save Engine record');
      await page.locator('#btn-card-collection-back').click();
      await page.locator('#screen-world.active').waitFor();
      const hud = await page.locator('#hud-zone').textContent();
      if (!hud.includes('Greenvale Village')) throw new Error(viewport.name + ': village HUD missing');
      const firstSave = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k)))).profile);
      if (firstSave.name !== 'Eldoria Hero' || firstSave.gender !== 'female' || firstSave.hairStyle !== 3 || firstSave.hairColor !== 6) throw new Error(viewport.name + ': character profile not persisted');

      // Seed a valid existing Gold balance plus a legacy pending combat reward.
      // Reload so the application reads this fixture through the real Save Engine.
      await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k));
        if (!key) throw new Error('character save key not found');
        const id = key.split('.')[2];
        const current = JSON.parse(localStorage.getItem(key));
        current.gold = 37;
        const withGold = window.ELDORIA.Save.seal(current);
        const staged = window.ELDORIA.Save.withPendingReward(
          withGold,
          { exp: 12, gold: 99, drops: [{ id: 'jelly', name: 'Poring Jelly' }] },
          'poring',
          new Date().toISOString()
        );
        if (!staged.ok) throw new Error('could not stage legacy pending reward: ' + staged.reason);
        const saved = window.ELDORIA.Save.seal(staged.save);
        localStorage.setItem(key, JSON.stringify(saved));
        localStorage.setItem('eldoria.char.' + id + '.backup', JSON.stringify(saved));
        localStorage.setItem('eldoria.char.' + id + '.guard', JSON.stringify(window.ELDORIA.Save.guardFor(saved)));
      });
      await page.reload({ waitUntil:'networkidle' });
      await page.locator('#screen-title.active').waitFor();
      await page.getByRole('button', { name:'Continue' }).click();
      await page.locator('#screen-select.active').waitFor();
      await page.getByRole('button', { name:'Play' }).click();
      await page.locator('#screen-world.active').waitFor();
      const afterLegacyClaim = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k));
        return JSON.parse(localStorage.getItem(key));
      });
      if (afterLegacyClaim.gold !== 37 || afterLegacyClaim.stats.exp !== 12 || afterLegacyClaim.items.jelly !== 1 || afterLegacyClaim.pendingReward !== null) {
        throw new Error(viewport.name + ': legacy pending Gold was not ignored or eligible rewards were not claimed');
      }

      // Exercise the real battle -> victory -> pending reward -> claim integration.
      await page.evaluate(() => window.ELDORIA.World.onEncounter('poring'));
      await page.locator('#screen-battle.active').waitFor();
      for (let turn = 0; turn < 30; turn++) {
        if (await page.locator('#screen-result.active').count()) break;
        const playable = page.locator('#hand .card:not(.disabled)');
        if (await playable.count()) await playable.first().click();
        else {
          const endTurn = page.locator('#btn-end-turn');
          if (await endTurn.isDisabled()) {
            await page.locator('#screen-result.active').waitFor({ timeout:3000 });
            break;
          }
          await endTurn.click();
        }
        await page.waitForTimeout(80);
      }
      await page.locator('#screen-result.active').waitFor({ timeout:15000 });
      const victoryText = await page.locator('#result-list').textContent();
      if (!victoryText.includes('EXP') || /gold/i.test(victoryText)) throw new Error(viewport.name + ': victory result displayed an invalid Gold reward');
      const afterVictory = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k));
        return JSON.parse(localStorage.getItem(key));
      });
      if (afterVictory.gold !== 37 || afterVictory.pendingReward !== null) throw new Error(viewport.name + ': monster victory changed existing Gold or left a pending reward');
      if (!(await page.locator('#hud-gold').textContent()).includes('37 gold')) throw new Error(viewport.name + ': Gold HUD did not preserve the existing balance');
      await page.locator('#btn-result').click();
      await page.locator('#screen-world.active').waitFor();
      await page.locator('#btn-menu').click();
      await page.locator('#game-menu:not([hidden])').waitFor();
      await page.getByRole('button', { name:'Save & Return to Title' }).click();
      await page.locator('#screen-title.active').waitFor();
      await page.locator('#btn-continue:not([hidden])').waitFor();
      await page.getByRole('button', { name:'Continue' }).click();
      await page.locator('#screen-select.active').waitFor();
      await page.getByRole('button', { name:'Play' }).click();
      await page.locator('#screen-world.active').waitFor();
      await page.locator('#btn-menu').click();
      await page.getByRole('button', { name:'Save & Return to Title' }).click();
      await page.locator('#screen-title.active').waitFor();
      await page.getByRole('button', { name:'Continue' }).click();
      await page.locator('#screen-select.active').waitFor();
      await page.getByRole('button', { name:'Create New Character' }).click();
      await page.locator('#screen-create.active').waitFor();
      await page.getByRole('button', { name:'Back' }).click();
      await page.locator('#screen-select.active').waitFor();
      await page.getByRole('button', { name:'Create New Character' }).click();
      await page.locator('#screen-create.active').waitFor();
      await page.locator('#character-name').fill('Second Hero');
      await page.getByRole('button', { name:'Create Character' }).click();
      await page.locator('#screen-world.active').waitFor();
      await page.locator('#btn-menu').click();
      await page.getByRole('button', { name:'Save & Return to Title' }).click();
      await page.locator('#screen-title.active').waitFor();
      await page.getByRole('button', { name:'Continue' }).click();
      await page.locator('#screen-select.active').waitFor();
      const count = await page.locator('.character-row:not(.blocked)').count();
      if (count !== 2) throw new Error(viewport.name + ': expected two selectable characters, found ' + count);
      const damagedId = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k));
        return key && key.split('.')[2];
      });
      if (!damagedId) throw new Error(viewport.name + ': unable to locate a character save for recovery test');
      await page.evaluate(id => {
        ['main','backup','guard'].forEach(part => localStorage.setItem('eldoria.char.' + id + '.' + part, '{damaged'));
      }, damagedId);
      await page.reload({ waitUntil:'networkidle' });
      await page.locator('#screen-title.active').waitFor();
      if (!(await page.locator('#btn-start').isDisabled())) throw new Error(viewport.name + ': title creation was not blocked during recovery');
      await page.getByRole('button', { name:'Continue' }).click();
      await page.locator('#screen-select.active').waitFor();
      if (!(await page.locator('#btn-new-character').isDisabled())) throw new Error(viewport.name + ': selection creation was not blocked during recovery');
      if ((await page.locator('.character-row.blocked').count()) !== 1) throw new Error(viewport.name + ': damaged character was not shown as blocked');
      results.push({ viewport:viewport.name, creation:'pass', appearancePersistence:'pass', selection:'pass', multipleCharacters:'pass', backNavigation:'pass', recoveryCreationLock:'pass', menu:'pass', continueFlow:'pass' });
      await context.close();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ results, pageErrors:errors }, null, 2));
    console.log('PASS  character creation and selection smoke test on desktop and iPhone-sized Chromium');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode=1; });
