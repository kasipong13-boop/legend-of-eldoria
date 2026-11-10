#!/usr/bin/env node
// End-to-end smoke test for character creation/selection and existing save flows.
const assert = require('node:assert/strict');
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
        const key = Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k));
        return localStorage.getItem(key);
      });
      if (viewport.name === 'iphone') await page.locator('#btn-card-collection').tap(); else await page.locator('#btn-card-collection').click();
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
      assert.match(sidecarSaved.key, /^eldoria\.cards\./);
      const coreSaveAfterCollection = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k));
        return localStorage.getItem(key);
      });
      assert.equal(coreSaveAfterCollection, coreSaveBeforeCollection, 'collection must not touch the character Save Engine record');
      if (viewport.name === 'iphone') await page.locator('#btn-card-collection-back').tap(); else await page.locator('#btn-card-collection-back').click();
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
      await page.locator('#btn-card-collection').click();
      await page.locator('#screen-card-collection.active').waitFor();
      assert.equal(await page.locator('#collection-source').textContent(), 'Saved collection data', 'collection sidecar survives a real browser reload');
      assert.match(await page.locator('#collection-summary').textContent(), /10 owned card copies/);
      await page.locator('#btn-card-collection-back').click();
      await page.locator('#screen-world.active').waitFor();

      // Test-only catalog fixture: production monster card-drop tables remain empty.
      // Exercise the actual battle -> stage card reward -> claim -> collection path.
      await page.evaluate(() => {
        const E = window.ELDORIA;
        E.CARDS.bash.acquisitionType = 'monster-special-skill';
        E.CARDS.bash.rarity = 'Rare';
        E.MONSTER_CARD_DROP_TABLE.poring = [{ cardId: 'bash', chance: 1 }];
        E.World.onEncounter('poring');
      });
      await page.locator('#screen-battle.active').waitFor();
      for (let turn = 0; turn < 30; turn++) {
        if (await page.locator('#screen-result.active').count()) break;
        const playable = page.locator('#hand .card:not(.disabled)');
        if (await playable.count()) await playable.first().click();
        else {
          const endTurn = page.locator('#btn-end-turn');
          if (await endTurn.isDisabled()) {
            // The button is also disabled during card/enemy animations. Wait for either
            // the result screen or the next playable player phase, not victory alone.
            try {
              await page.waitForFunction(() => {
                const result = document.querySelector('#screen-result.active');
                const end = document.querySelector('#btn-end-turn');
                return !!result || (!!end && !end.disabled);
              }, null, { timeout:10000 });
            } catch (error) {
              const debug = await page.evaluate(() => ({
                activeScreens: Array.from(document.querySelectorAll('.screen.active')).map(el => el.id),
                endTurnDisabled: document.querySelector('#btn-end-turn') && document.querySelector('#btn-end-turn').disabled,
                battleLog: document.querySelector('#battle-log') && document.querySelector('#battle-log').textContent,
                resultTitle: document.querySelector('#result-title') && document.querySelector('#result-title').textContent,
                enemyHp: document.querySelector('#enemy-hp-text') && document.querySelector('#enemy-hp-text').textContent,
                playerHp: document.querySelector('#player-hp-text') && document.querySelector('#player-hp-text').textContent,
                hand: document.querySelector('#hand') && document.querySelector('#hand').textContent
              }));
              throw new Error(viewport.name + ': battle phase stalled: ' + JSON.stringify(debug) + '; pageErrors=' + errors.join(' | '));
            }
            if (await page.locator('#screen-result.active').count()) break;
            continue;
          }
          await endTurn.click();
        }
        await page.waitForTimeout(80);
      }
      await page.locator('#screen-result.active').waitFor({ timeout:15000 });
      const victoryText = await page.locator('#result-list').textContent();
      if (!victoryText.includes('EXP') || /gold/i.test(victoryText)) throw new Error(viewport.name + ': victory result displayed an invalid Gold reward');
      if (!victoryText.includes('Card acquired: Bash · Rare')) throw new Error(viewport.name + ': Monster Special Skill Card was not displayed as a victory reward');
      const afterVictory = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => /^eldoria\.char\.[a-f0-9]{32}\.main$/.test(k));
        const save = JSON.parse(localStorage.getItem(key));
        const collection = window.ELDORIA.CardCollection.get(save.characterId);
        const bash = collection.data.owned.find(card => card.cardId === 'bash' && card.stars === 1);
        return { save, collection: collection.data, bash };
      });
      if (!afterVictory.bash || afterVictory.bash.quantity !== 2) throw new Error(viewport.name + ': acquired card did not stack with the existing same-star copy');
      if (afterVictory.collection.pendingRewards.length !== 0 || afterVictory.collection.claimedRewardIds.length !== 1) throw new Error(viewport.name + ': card reward receipt was not finalized exactly once');
      const afterVictorySave = afterVictory.save;
      if (afterVictorySave.gold !== 37 || afterVictorySave.pendingReward !== null) throw new Error(viewport.name + ': monster victory changed existing Gold or left a pending reward');
      if (!(await page.locator('#hud-gold').textContent()).includes('37 gold')) throw new Error(viewport.name + ': Gold HUD did not preserve the existing balance');

      // Crash-recovery scenario: persist a complete battle intent to the sidecar,
      // then reload before the character Save Engine receives its Pending Reward.
      const crashIntent = await page.evaluate(async () => {
        const E = window.ELDORIA;
        const save = E.GameSave.getCurrentSave();
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const encounterId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
        const intent = {
          rewardId: String(save.nextRewardSeq), encounterId, monsterId: 'poring',
          exp: 1, gold: 0, drops: [{ id: 'jelly', name: 'Poring Jelly' }],
          cards: [{ cardId: 'bash', stars: 1, quantity: 1 }],
          createdAt: new Date().toISOString()
        };
        const journal = E.RewardRecovery.create();
        const staged = await journal.runExclusive(save.characterId, async () =>
          journal.prepare(save.characterId, intent)
        );
        if (!staged.ok) throw new Error('could not persist PREPARED IndexedDB crash-recovery fixture: ' + staged.reason);
        // Simulate a crash immediately after PREPARED: no Sidecar stage or Save pending write exists yet.
        return { rewardId: intent.rewardId, beforeJelly: save.items.jelly };
      });
      await page.reload({ waitUntil:'networkidle' });
      await page.locator('#screen-title.active').waitFor();
      await page.getByRole('button', { name:'Continue' }).click();
      await page.locator('#screen-select.active').waitFor();
      await page.getByRole('button', { name:'Play' }).click();
      await page.locator('#screen-world.active').waitFor();
      const afterCrashRecovery = await page.evaluate(async () => {
        const E = window.ELDORIA;
        const save = E.GameSave.getCurrentSave();
        const collection = E.CardCollection.get(save.characterId);
        const bash = collection.data.owned.find(card => card.cardId === 'bash' && card.stars === 1);
        const journal = await E.RewardRecovery.create().list(save.characterId);
        return { save, bash, journal: journal.entries };
      });
      if (afterCrashRecovery.save.lastClaimedSeq !== Number(crashIntent.rewardId) ||
          afterCrashRecovery.save.pendingReward !== null ||
          afterCrashRecovery.save.items.jelly !== crashIntent.beforeJelly + 1) {
        throw new Error(viewport.name + ': journal reward did not recover EXP/item claim after reload');
      }
      if (!afterCrashRecovery.bash || afterCrashRecovery.bash.quantity !== 3 ||
          afterCrashRecovery.journal.find(entry => entry.rewardId === crashIntent.rewardId).status !== 'completed') {
        throw new Error(viewport.name + ': journal reward card was not granted exactly once and finalized');
      }
      if (afterCrashRecovery.save.gold !== 37) throw new Error(viewport.name + ': crash recovery changed existing Gold');

      // Hold the per-character Web Lock in one tab and verify a second tab fails closed.
      const lockProbePage = await context.newPage();
      await lockProbePage.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
      const characterId = afterCrashRecovery.save.characterId;
      const holdLock = page.evaluate(async id => navigator.locks.request(
        'eldoria:reward:' + id, { mode:'exclusive' },
        () => new Promise(resolve => setTimeout(resolve, 350))
      ), characterId);
      await page.waitForTimeout(50);
      const lockContention = await lockProbePage.evaluate(async id =>
        window.ELDORIA.RewardRecovery.create().runExclusive(id, async () => ({ ok:true })), characterId);
      await holdLock;
      if (lockContention.ok || lockContention.reason !== 'REWARD_LOCK_BUSY') {
        throw new Error(viewport.name + ': second tab was not blocked by the exclusive reward lock');
      }
      await lockProbePage.close();

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
