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
      // FI-38: remove a durable Journal record after Save Pending while preserving
    // the activation marker. Reload must quarantine, never use legacy settlement.
    const fiContext = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fiPage = await fiContext.newPage();
    fiPage.on('pageerror', error => errors.push('FI-38: ' + String(error)));
    await fiPage.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fiPage.getByRole('button', { name:'Create New Character' }).click();
    await fiPage.locator('#screen-create.active').waitFor();
    await fiPage.locator('#character-name').fill('FI38 Hero');
    await fiPage.getByRole('button', { name:'Create Character' }).click();
    await fiPage.locator('#screen-world.active').waitFor();
    const fi38 = await fiPage.evaluate(async () => {
      const E = window.ELDORIA;
      const save = E.GameSave.getCurrentSave();
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
      const intent = {
        rewardId:String(save.nextRewardSeq), encounterId, monsterId:'poring',
        exp:1, gold:0, drops:[], cards:[], createdAt:new Date().toISOString()
      };
      const journal = E.RewardRecovery.create();
      const prepared = await journal.runExclusive(save.characterId, async () => {
        const entry = await journal.prepare(save.characterId, intent);
        if (!entry.ok) return entry;
        const sidecar = E.CardCollection.stageReward(save.characterId, intent.rewardId, []);
        if (!sidecar.ok) return sidecar;
        const sidecarState = await journal.transition(save.characterId, intent.rewardId, 'sidecarStaged');
        if (!sidecarState.ok) return sidecarState;
        const pending = E.Save.withPendingReward(save,
          { exp:1, gold:0, drops:[] }, 'poring', intent.createdAt);
        if (!pending.ok) return pending;
        const saveSystem = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
        const committed = saveSystem.commit(save, pending.save);
        if (!committed.ok) return { ok:false, reason:committed.reason || 'SAVE_PENDING_FAILED' };
        return { ok:true };
      });
      if (!prepared.ok) throw new Error('FI-38 setup failed: ' + prepared.reason);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('eldoria-reward-recovery', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['journal'], 'readwrite');
        tx.objectStore('journal').delete(save.characterId + ':' + intent.rewardId);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
      return { characterId:save.characterId, rewardId:intent.rewardId };
    });
    await fiPage.reload({ waitUntil:'networkidle' });
    await fiPage.locator('#screen-title.active').waitFor();
    await fiPage.getByRole('button', { name:'Continue' }).click();
    await fiPage.locator('#screen-select.active').waitFor();
    await fiPage.locator('.character-row').filter({ hasText:'FI38 Hero' }).getByRole('button', { name:'Play' }).click();
    await fiPage.locator('#screen-world.active').waitFor();
    const fi38Evidence = await fiPage.evaluate(async id =>
      window.ELDORIA.RewardRecovery.create().listQuarantine(id), fi38.characterId);
    if (!fi38Evidence.ok || !fi38Evidence.entries.some(entry => entry.reason === 'ACTIVATED_JOURNAL_MISSING')) {
      throw new Error('FI-38: missing activated Journal was not quarantined');
    }
    const lockMessage = await fiPage.locator('#save-lock-message').textContent();
    if (!lockMessage || !/recovery/i.test(lockMessage)) throw new Error('FI-38: missing Journal did not block gameplay');

    // FI-30: activated Journal missing at reload must never downgrade to legacy
    // settlement, even after repeated retry/reload. Distinct from FI-38: assert
    // the persisted Save/Sidecar deltas and activation marker remain unchanged.
    const fi30Before = await fiPage.evaluate(fixture => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const cards = E.CardCollection.get(fixture.characterId).data;
      return {
        exp:save.stats.exp, items:JSON.stringify(save.items),
        pendingSeq:save.pendingReward && save.pendingReward.seq,
        lastClaimedSeq:save.lastClaimedSeq,
        cardState:JSON.stringify(cards.owned),
        receiptState:JSON.stringify(cards.claimedRewardIds),
        marker:localStorage.getItem('eldoria.reward.v1.active.' + fixture.characterId)
      };
    }, fi38);
    if (fi30Before.marker !== '1' || fi30Before.pendingSeq !== Number(fi38.rewardId)) {
      throw new Error('FI-30: activation marker or pending Save checkpoint absent');
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      await fiPage.reload({ waitUntil:'networkidle' });
      await fiPage.getByRole('button', { name:'Continue' }).click();
      await fiPage.locator('#screen-select.active').waitFor();
      await fiPage.locator('.character-row').filter({ hasText:'FI38 Hero' }).getByRole('button', { name:'Play' }).click();
      await fiPage.locator('#screen-world.active').waitFor();
      const fi30After = await fiPage.evaluate(async fixture => {
        const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
        const cards = E.CardCollection.get(fixture.characterId).data;
        const quarantine = await E.RewardRecovery.create().listQuarantine(fixture.characterId);
        return {
          exp:save.stats.exp, items:JSON.stringify(save.items),
          pendingSeq:save.pendingReward && save.pendingReward.seq,
          lastClaimedSeq:save.lastClaimedSeq,
          cardState:JSON.stringify(cards.owned),
          receiptState:JSON.stringify(cards.claimedRewardIds),
          marker:localStorage.getItem('eldoria.reward.v1.active.' + fixture.characterId),
          quarantine
        };
      }, fi38);
      if (fi30After.exp !== fi30Before.exp ||
          fi30After.items !== fi30Before.items ||
          fi30After.pendingSeq !== fi30Before.pendingSeq ||
          fi30After.lastClaimedSeq !== fi30Before.lastClaimedSeq ||
          fi30After.cardState !== fi30Before.cardState ||
          fi30After.receiptState !== fi30Before.receiptState ||
          fi30After.marker !== '1' ||
          !fi30After.quarantine.ok ||
          !fi30After.quarantine.entries.some(entry => entry.reason === 'ACTIVATED_JOURNAL_MISSING')) {
        throw new Error('FI-30: activated missing Journal was silently settled or evidence changed (attempt ' + attempt + ')');
      }
      const fi30Lock = await fiPage.locator('#save-lock-message').textContent();
      if (!fi30Lock || !/recovery/i.test(fi30Lock)) {
        throw new Error('FI-30: gameplay not blocked after activated Journal loss');
      }
    }
    await fiContext.close();

      // FI-10: Sidecar pending reward without a matching IndexedDB Journal is orphaned.
    const fi10Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi10Page = await fi10Context.newPage();
    fi10Page.on('pageerror', error => errors.push('FI-10: ' + String(error)));
    await fi10Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi10Page.getByRole('button', { name:'Create New Character' }).click();
    await fi10Page.locator('#screen-create.active').waitFor();
    await fi10Page.locator('#character-name').fill('FI10 Hero');
    await fi10Page.getByRole('button', { name:'Create Character' }).click();
    await fi10Page.locator('#screen-world.active').waitFor();
    const fi10CharacterId = await fi10Page.evaluate(() => {
      const save = window.ELDORIA.GameSave.getCurrentSave();
      const staged = window.ELDORIA.CardCollection.stageReward(save.characterId, 'orphan-fi10',
        [{ cardId:'bash', stars:1, quantity:1 }]);
      if (!staged.ok) throw new Error('FI-10 setup failed: ' + staged.reason);
      return save.characterId;
    });
    await fi10Page.reload({ waitUntil:'networkidle' });
    await fi10Page.locator('#screen-title.active').waitFor();
    await fi10Page.getByRole('button', { name:'Continue' }).click();
    await fi10Page.locator('#screen-select.active').waitFor();
    await fi10Page.locator('.character-row').filter({ hasText:'FI10 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi10Page.locator('#screen-world.active').waitFor();
    const fi10Evidence = await fi10Page.evaluate(async id =>
      window.ELDORIA.RewardRecovery.create().listQuarantine(id), fi10CharacterId);
    if (!fi10Evidence.ok || !fi10Evidence.entries.some(entry => entry.reason === 'ORPHAN_SIDECAR_REWARD')) {
      throw new Error('FI-10: orphan Sidecar reward was not quarantined');
    }
    const fi10LockMessage = await fi10Page.locator('#save-lock-message').textContent();
    if (!fi10LockMessage || !/recovery/i.test(fi10LockMessage)) throw new Error('FI-10: orphan Sidecar reward did not block gameplay');
    await fi10Context.close();

    // FI-20: a valid Save pending reward with a different sequence must be quarantined.
    const fi20Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi20Page = await fi20Context.newPage();
    fi20Page.on('pageerror', error => errors.push('FI-20: ' + String(error)));
    await fi20Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi20Page.getByRole('button', { name:'Create New Character' }).click();
    await fi20Page.locator('#screen-create.active').waitFor();
    await fi20Page.locator('#character-name').fill('FI20 Hero');
    await fi20Page.getByRole('button', { name:'Create Character' }).click();
    await fi20Page.locator('#screen-world.active').waitFor();
    const fi20CharacterId = await fi20Page.evaluate(async () => {
      const E = window.ELDORIA;
      const save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
      const createdAt = new Date().toISOString();
      const journal = E.RewardRecovery.create();
      const prepared = await journal.runExclusive(save.characterId, async () => {
        const entry = await journal.prepare(save.characterId, {
          rewardId, encounterId, monsterId:'poring', exp:1, gold:0, drops:[], cards:[], createdAt
        });
        if (!entry.ok) return entry;
        const staged = E.CardCollection.stageReward(save.characterId, rewardId, []);
        if (!staged.ok) return staged;
        const state = await journal.transition(save.characterId, rewardId, 'sidecarStaged');
        if (!state.ok) return state;
        const pending = E.Save.withPendingReward(save, { exp:1, gold:0, drops:[] }, 'poring', createdAt);
        if (!pending.ok) return pending;
        pending.save.pendingReward.seq += 1;
        pending.save.nextRewardSeq += 1;
        const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
        const committed = system.commit(save, pending.save);
        if (!committed.ok) return { ok:false, reason:committed.reason || 'SAVE_COMMIT_FAILED' };
        return { ok:true };
      });
      if (!prepared.ok) throw new Error('FI-20 setup failed: ' + prepared.reason);
      return save.characterId;
    });
    await fi20Page.reload({ waitUntil:'networkidle' });
    await fi20Page.locator('#screen-title.active').waitFor();
    await fi20Page.getByRole('button', { name:'Continue' }).click();
    await fi20Page.locator('#screen-select.active').waitFor();
    await fi20Page.locator('.character-row').filter({ hasText:'FI20 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi20Page.locator('#screen-world.active').waitFor();
    const fi20Evidence = await fi20Page.evaluate(async id =>
      window.ELDORIA.RewardRecovery.create().listQuarantine(id), fi20CharacterId);
    if (!fi20Evidence.ok || !fi20Evidence.entries.some(entry => entry.reason === 'SAVE_JOURNAL_ID_MISMATCH')) {
      throw new Error('FI-20: mismatched Save sequence was not quarantined');
    }
    await fi20Context.close();

    // FI-22: Save claim commits while Journal remains cardsClaimed; reload must finish forward.
    const fi22Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi22Page = await fi22Context.newPage();
    fi22Page.on('pageerror', error => errors.push('FI-22: ' + String(error)));
    await fi22Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi22Page.getByRole('button', { name:'Create New Character' }).click();
    await fi22Page.locator('#screen-create.active').waitFor();
    await fi22Page.locator('#character-name').fill('FI22 Hero');
    await fi22Page.getByRole('button', { name:'Create Character' }).click();
    await fi22Page.locator('#screen-world.active').waitFor();
    const fi22Fixture = await fi22Page.evaluate(async () => {
      const E = window.ELDORIA;
      const save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
      const createdAt = new Date().toISOString();
      const journal = E.RewardRecovery.create();
      const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
      const prepared = await journal.runExclusive(save.characterId, async () => {
        const entry = await journal.prepare(save.characterId, {
          rewardId, encounterId, monsterId:'poring', exp:1, gold:0, drops:[], cards:[], createdAt
        });
        if (!entry.ok) return entry;
        const staged = E.CardCollection.stageReward(save.characterId, rewardId, []);
        if (!staged.ok) return staged;
        if (!(await journal.transition(save.characterId, rewardId, 'sidecarStaged')).ok) return { ok:false, reason:'SIDECAR_STATE_FAILED' };
        const pending = E.Save.withPendingReward(save, { exp:1, gold:0, drops:[] }, 'poring', createdAt);
        if (!pending.ok) return pending;
        const pendingCommit = system.commit(save, pending.save);
        if (!pendingCommit.ok) return { ok:false, reason:'PENDING_COMMIT_FAILED' };
        if (!(await journal.transition(save.characterId, rewardId, 'savePending')).ok) return { ok:false, reason:'SAVE_PENDING_STATE_FAILED' };
        const cardClaim = E.CardCollection.claimReward(save.characterId, rewardId);
        if (!cardClaim.ok || cardClaim.missingStage) return { ok:false, reason:'CARD_CLAIM_FAILED' };
        if (!(await journal.transition(save.characterId, rewardId, 'cardsClaimed')).ok) return { ok:false, reason:'CARDS_CLAIMED_STATE_FAILED' };
        const claim = E.Save.withClaim(pendingCommit.save, function (target, reward) {
          target.stats.exp += reward.exp;
        });
        if (!claim.ok) return claim;
        const saveClaim = system.commit(pendingCommit.save, claim.save);
        if (!saveClaim.ok) return { ok:false, reason:'SAVE_CLAIM_FAILED' };
        // Deliberately stop before Journal saveClaimed / completed.
        return { ok:true, rewardId, exp:saveClaim.save.stats.exp };
      });
      if (!prepared.ok) throw new Error('FI-22 setup failed: ' + prepared.reason);
      return { characterId:save.characterId, rewardId:prepared.rewardId, exp:prepared.exp };
    });
    await fi22Page.reload({ waitUntil:'networkidle' });
    await fi22Page.locator('#screen-title.active').waitFor();
    await fi22Page.getByRole('button', { name:'Continue' }).click();
    await fi22Page.locator('#screen-select.active').waitFor();
    await fi22Page.locator('.character-row').filter({ hasText:'FI22 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi22Page.locator('#screen-world.active').waitFor();
    const fi22Recovered = await fi22Page.evaluate(async id => {
      const save = window.ELDORIA.GameSave.getCurrentSave();
      const journal = await window.ELDORIA.RewardRecovery.create().get(id, String(save.lastClaimedSeq));
      return { save, journal:journal.entry };
    }, fi22Fixture.characterId);
    if (fi22Recovered.save.pendingReward !== null ||
        fi22Recovered.save.stats.exp !== fi22Fixture.exp ||
        !fi22Recovered.journal || fi22Recovered.journal.status !== 'completed') {
      throw new Error('FI-22: recovery did not finish Journal after durable Save claim');
    }
    await fi22Context.close();


    // FI-07: browser integration — injected Sidecar stage failure after durable Journal PREPARED.
    // The failed stage must not advance Journal or Save; reload recovers the same reward once.
    const fi07Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi07Page = await fi07Context.newPage();
    fi07Page.on('pageerror', error => errors.push('FI-07: ' + String(error)));
    await fi07Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi07Page.getByRole('button', { name:'Create New Character' }).click();
    await fi07Page.locator('#screen-create.active').waitFor();
    await fi07Page.locator('#character-name').fill('FI07 Hero');
    await fi07Page.getByRole('button', { name:'Create Character' }).click();
    await fi07Page.locator('#screen-world.active').waitFor();
    const fi07Fixture = await fi07Page.evaluate(async () => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      const intent = { rewardId, encounterId, monsterId:'poring', exp:2, gold:0,
        drops:[{ id:'jelly', name:'Poring Jelly' }],
        cards:[{ cardId:'bash', stars:1, quantity:1 }], createdAt:new Date().toISOString() };
      const beforeCards = E.CardCollection.get(save.characterId).data.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity;
      const journal = E.RewardRecovery.create();
      const result = await journal.runExclusive(save.characterId, async () => {
        const prepared = await journal.prepare(save.characterId, intent);
        if (!prepared.ok) return prepared;
        const originalStage = E.CardCollection.stageReward;
        E.CardCollection.stageReward = () => ({ ok:false, reason:'WRITE_FAILED' });
        let failed;
        try { failed = E.CardCollection.stageReward(save.characterId, rewardId, intent.cards); }
        finally { E.CardCollection.stageReward = originalStage; }
        if (failed.ok || failed.reason !== 'WRITE_FAILED') return { ok:false, reason:'STAGE_FAILURE_NOT_INJECTED' };
        return { ok:true };
      });
      if (!result.ok) throw new Error('FI-07 fixture failed: ' + result.reason);
      const beforeJournal = await journal.get(save.characterId, rewardId);
      const beforeSidecar = E.CardCollection.get(save.characterId).data;
      const beforeSave = E.GameSave.getCurrentSave();
      if (!beforeJournal.ok || beforeJournal.entry.status !== 'prepared' ||
          beforeSidecar.pendingRewards.some(r => r.rewardId === rewardId) ||
          beforeSidecar.claimedRewardIds.includes(rewardId) ||
          beforeSave.pendingReward !== null ||
          beforeSave.stats.exp !== save.stats.exp ||
          (beforeSave.items.jelly || 0) !== (save.items.jelly || 0) ||
          beforeSidecar.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== beforeCards) {
        throw new Error('FI-07: stage failure advanced Journal, Sidecar or Save');
      }
      return { characterId:save.characterId, rewardId, beforeExp:save.stats.exp,
        beforeJelly:save.items.jelly || 0, beforeGold:save.gold, beforeCards };
    });
    await fi07Page.reload({ waitUntil:'networkidle' });
    await fi07Page.locator('#screen-title.active').waitFor();
    await fi07Page.getByRole('button', { name:'Continue' }).click();
    await fi07Page.locator('#screen-select.active').waitFor();
    await fi07Page.locator('.character-row').filter({ hasText:'FI07 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi07Page.locator('#screen-world.active').waitFor();
    for (let attempt = 0; attempt < 2; attempt++) {
      const recovered = await fi07Page.evaluate(async fixture => {
        const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
        const sidecar = E.CardCollection.get(save.characterId).data;
        const journal = await E.RewardRecovery.create().get(save.characterId, fixture.rewardId);
        return { save, sidecar, journal };
      }, fi07Fixture);
      if (recovered.save.pendingReward !== null ||
          recovered.save.lastClaimedSeq !== Number(fi07Fixture.rewardId) ||
          recovered.save.stats.exp !== fi07Fixture.beforeExp + 2 ||
          (recovered.save.items.jelly || 0) !== fi07Fixture.beforeJelly + 1 ||
          recovered.save.gold !== fi07Fixture.beforeGold ||
          recovered.sidecar.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== fi07Fixture.beforeCards + 1 ||
          recovered.sidecar.claimedRewardIds.filter(id => id === fi07Fixture.rewardId).length !== 1 ||
          recovered.sidecar.pendingRewards.some(r => r.rewardId === fi07Fixture.rewardId) ||
          !recovered.journal.ok || recovered.journal.entry.status !== 'completed') {
        throw new Error('FI-07: stage failure reload did not settle exactly once (attempt ' + attempt + ')');
      }
      if (attempt === 0) {
        await fi07Page.reload({ waitUntil:'networkidle' });
        await fi07Page.locator('#screen-title.active').waitFor();
        await fi07Page.getByRole('button', { name:'Continue' }).click();
        await fi07Page.locator('#screen-select.active').waitFor();
        await fi07Page.locator('.character-row').filter({ hasText:'FI07 Hero' }).getByRole('button', { name:'Play' }).click();
        await fi07Page.locator('#screen-world.active').waitFor();
      }
    }
    await fi07Context.close();


    // FI-15: crash immediately after durable Save Pending commit, before Journal savePending.
    // The reload must resume forward and settle cards/EXP/items exactly once.
    const fi15Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi15Page = await fi15Context.newPage();
    fi15Page.on('pageerror', error => errors.push('FI-15: ' + String(error)));
    await fi15Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi15Page.getByRole('button', { name:'Create New Character' }).click();
    await fi15Page.locator('#screen-create.active').waitFor();
    await fi15Page.locator('#character-name').fill('FI15 Hero');
    await fi15Page.getByRole('button', { name:'Create Character' }).click();
    await fi15Page.locator('#screen-world.active').waitFor();
    const fi15Fixture = await fi15Page.evaluate(async () => {
      const E = window.ELDORIA;
      const save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
      const createdAt = new Date().toISOString();
      const journal = E.RewardRecovery.create();
      const beforeCards = E.CardCollection.get(save.characterId).data.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity;
      const prepared = await journal.runExclusive(save.characterId, async () => {
        const intent = { rewardId, encounterId, monsterId:'poring', exp:3, gold:0,
          drops:[{ id:'jelly', name:'Poring Jelly' }],
          cards:[{ cardId:'bash', stars:1, quantity:1 }], createdAt };
        const entry = await journal.prepare(save.characterId, intent);
        if (!entry.ok) return entry;
        const staged = E.CardCollection.stageReward(save.characterId, rewardId, intent.cards);
        if (!staged.ok) return staged;
        const state = await journal.transition(save.characterId, rewardId, 'sidecarStaged');
        if (!state.ok) return state;
        const pending = E.Save.withPendingReward(save, { exp:3, gold:0, drops:intent.drops }, 'poring', createdAt);
        if (!pending.ok) return pending;
        const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
        const committed = system.commit(save, pending.save);
        if (!committed.ok) return { ok:false, reason:committed.reason || 'SAVE_PENDING_FAILED' };
        // Simulated crash checkpoint: no Journal transition to savePending and no claim.
        return { ok:true };
      });
      if (!prepared.ok) throw new Error('FI-15 fixture failed: ' + prepared.reason);
      return { characterId:save.characterId, rewardId, beforeExp:save.stats.exp,
        beforeJelly:save.items.jelly || 0, beforeCards, beforeGold:save.gold };
    });
    await fi15Page.reload({ waitUntil:'networkidle' });
    await fi15Page.locator('#screen-title.active').waitFor();
    await fi15Page.getByRole('button', { name:'Continue' }).click();
    await fi15Page.locator('#screen-select.active').waitFor();
    await fi15Page.locator('.character-row').filter({ hasText:'FI15 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi15Page.locator('#screen-world.active').waitFor();
    const fi15After = await fi15Page.evaluate(async fixture => {
      const E = window.ELDORIA;
      const save = E.GameSave.getCurrentSave();
      const collection = E.CardCollection.get(save.characterId).data;
      const journal = await E.RewardRecovery.create().get(save.characterId, fixture.rewardId);
      return { save, collection, journal:journal.entry };
    }, fi15Fixture);
    if (fi15After.save.pendingReward !== null ||
        fi15After.save.lastClaimedSeq !== Number(fi15Fixture.rewardId) ||
        fi15After.save.stats.exp !== fi15Fixture.beforeExp + 3 ||
        (fi15After.save.items.jelly || 0) !== fi15Fixture.beforeJelly + 1 ||
        fi15After.save.gold !== fi15Fixture.beforeGold ||
        fi15After.collection.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== fi15Fixture.beforeCards + 1 ||
        fi15After.collection.claimedRewardIds.filter(id => id === fi15Fixture.rewardId).length !== 1 ||
        !fi15After.journal || fi15After.journal.status !== 'completed') {
      throw new Error('FI-15: pending-commit crash did not recover exactly once');
    }
    await fi15Context.close();


    // FI-16: durable pending Save and savePending Journal, interrupted before Card Claim.
    const fi16Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi16Page = await fi16Context.newPage();
    fi16Page.on('pageerror', error => errors.push('FI-16: ' + String(error)));
    await fi16Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi16Page.getByRole('button', { name:'Create New Character' }).click();
    await fi16Page.locator('#screen-create.active').waitFor();
    await fi16Page.locator('#character-name').fill('FI16 Hero');
    await fi16Page.getByRole('button', { name:'Create Character' }).click();
    await fi16Page.locator('#screen-world.active').waitFor();
    const fi16Fixture = await fi16Page.evaluate(async () => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
      const createdAt = new Date().toISOString();
      const journal = E.RewardRecovery.create();
      const beforeCards = E.CardCollection.get(save.characterId).data.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity;
      const result = await journal.runExclusive(save.characterId, async () => {
        const intent = { rewardId, encounterId, monsterId:'poring', exp:2, gold:0, drops:[],
          cards:[{ cardId:'bash', stars:1, quantity:1 }], createdAt };
        const entry = await journal.prepare(save.characterId, intent);
        if (!entry.ok) return entry;
        const stage = E.CardCollection.stageReward(save.characterId, rewardId, intent.cards);
        if (!stage.ok) return stage;
        const sidecarState = await journal.transition(save.characterId, rewardId, 'sidecarStaged');
        if (!sidecarState.ok) return sidecarState;
        const pending = E.Save.withPendingReward(save, { exp:2, gold:0, drops:[] }, 'poring', createdAt);
        if (!pending.ok) return pending;
        const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
        const commit = system.commit(save, pending.save);
        if (!commit.ok) return commit;
        return journal.transition(save.characterId, rewardId, 'savePending');
      });
      if (!result.ok) throw new Error('FI-16 setup failed: ' + result.reason);
      return { characterId:save.characterId, rewardId, beforeExp:save.stats.exp, beforeCards };
    });
    await fi16Page.reload({ waitUntil:'networkidle' });
    await fi16Page.locator('#screen-title.active').waitFor();
    await fi16Page.getByRole('button', { name:'Continue' }).click();
    await fi16Page.locator('#screen-select.active').waitFor();
    await fi16Page.locator('.character-row').filter({ hasText:'FI16 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi16Page.locator('#screen-world.active').waitFor();
    const fi16Recovered = await fi16Page.evaluate(async fixture => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const cards = E.CardCollection.get(save.characterId).data;
      const journal = await E.RewardRecovery.create().get(save.characterId, fixture.rewardId);
      return { save, cards, journal:journal.entry };
    }, fi16Fixture);
    if (fi16Recovered.save.pendingReward !== null ||
        fi16Recovered.save.lastClaimedSeq !== Number(fi16Fixture.rewardId) ||
        fi16Recovered.save.stats.exp !== fi16Fixture.beforeExp + 2 ||
        fi16Recovered.cards.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== fi16Fixture.beforeCards + 1 ||
        fi16Recovered.cards.claimedRewardIds.filter(id => id === fi16Fixture.rewardId).length !== 1 ||
        !fi16Recovered.journal || fi16Recovered.journal.status !== 'completed') {
      throw new Error('FI-16: durable savePending did not recover exactly once');
    }
    await fi16Context.close();


    // FI-17: stale Save snapshot must never overwrite a newer committed sequence.
    // Unlike FI-20 this tests optimistic Save commit freshness, not Journal ID mismatch.
    const fi17Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi17Page = await fi17Context.newPage();
    fi17Page.on('pageerror', error => errors.push('FI-17: ' + String(error)));
    await fi17Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi17Page.getByRole('button', { name:'Create New Character' }).click();
    await fi17Page.locator('#screen-create.active').waitFor();
    await fi17Page.locator('#character-name').fill('FI17 Hero');
    await fi17Page.getByRole('button', { name:'Create Character' }).click();
    await fi17Page.locator('#screen-world.active').waitFor();
    const fi17Result = await fi17Page.evaluate(() => {
      const E = window.ELDORIA;
      const stale = E.GameSave.getCurrentSave();
      const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
      const first = E.Save.withPendingReward(stale, { exp:2, gold:0, drops:[] }, 'poring', new Date().toISOString());
      if (!first.ok) throw new Error('FI-17 fixture pending failed: ' + first.reason);
      const newer = system.commit(stale, first.save);
      if (!newer.ok) throw new Error('FI-17 fixture commit failed: ' + newer.reason);
      const staleAttempt = E.Save.withPendingReward(stale, { exp:9, gold:0, drops:[] }, 'poring', new Date().toISOString());
      if (!staleAttempt.ok) throw new Error('FI-17 stale transform failed: ' + staleAttempt.reason);
      const rejected = system.commit(stale, staleAttempt.save);
      const durable = system.loadCharacter(stale.characterId);
      if (!durable.ok) throw new Error('FI-17 durable read failed: ' + durable.reason);
      return { rejected:{ ok:rejected.ok, reason:rejected.reason },
        expectedSeq:first.save.pendingReward.seq, expectedExp:first.save.pendingReward.exp,
        durableSeq:durable.save.pendingReward && durable.save.pendingReward.seq,
        durableExp:durable.save.pendingReward && durable.save.pendingReward.exp,
        nextSeq:durable.save.nextRewardSeq, revision:durable.save.revision,
        expectedRevision:newer.save.revision };
    });
    if (fi17Result.rejected.ok !== false || fi17Result.rejected.reason !== 'STALE' ||
        fi17Result.durableSeq !== fi17Result.expectedSeq ||
        fi17Result.durableExp !== fi17Result.expectedExp ||
        fi17Result.nextSeq !== fi17Result.expectedSeq + 1 ||
        fi17Result.revision !== fi17Result.expectedRevision) {
      throw new Error('FI-17: stale Save commit overwrote or altered durable reward sequence: ' + JSON.stringify(fi17Result));
    }
    await fi17Context.close();


    // FI-18: matching reward sequence but conflicting EXP/items must quarantine.
    // Distinct from FI-20, which changes the pending reward sequence itself.
    const fi18Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi18Page = await fi18Context.newPage();
    fi18Page.on('pageerror', error => errors.push('FI-18: ' + String(error)));
    await fi18Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi18Page.getByRole('button', { name:'Create New Character' }).click();
    await fi18Page.locator('#screen-create.active').waitFor();
    await fi18Page.locator('#character-name').fill('FI18 Hero');
    await fi18Page.getByRole('button', { name:'Create Character' }).click();
    await fi18Page.locator('#screen-world.active').waitFor();
    const fi18Fixture = await fi18Page.evaluate(async () => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
      const createdAt = new Date().toISOString(), journal = E.RewardRecovery.create();
      const beforeCards = E.CardCollection.get(save.characterId).data.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity;
      const prepared = await journal.runExclusive(save.characterId, async () => {
        const intent = { rewardId, encounterId, monsterId:'poring', exp:2, gold:0,
          drops:[{ id:'jelly', name:'Poring Jelly' }],
          cards:[{ cardId:'bash', stars:1, quantity:1 }], createdAt };
        const entry = await journal.prepare(save.characterId, intent);
        if (!entry.ok) return entry;
        const staged = E.CardCollection.stageReward(save.characterId, rewardId, intent.cards);
        if (!staged.ok) return staged;
        const transitioned = await journal.transition(save.characterId, rewardId, 'sidecarStaged');
        if (!transitioned.ok) return transitioned;
        // Valid Save pending sequence, but EXP and drops conflict with immutable Journal intent.
        const pending = E.Save.withPendingReward(save, { exp:9, gold:0, drops:[] }, 'poring', createdAt);
        if (!pending.ok) return pending;
        const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
        return system.commit(save, pending.save);
      });
      if (!prepared.ok) throw new Error('FI-18 setup failed: ' + prepared.reason);
      return { characterId:save.characterId, rewardId, beforeExp:save.stats.exp,
        beforeItems:save.items.jelly || 0, beforeCards };
    });
    await fi18Page.reload({ waitUntil:'networkidle' });
    await fi18Page.locator('#screen-title.active').waitFor();
    await fi18Page.getByRole('button', { name:'Continue' }).click();
    await fi18Page.locator('#screen-select.active').waitFor();
    await fi18Page.locator('.character-row').filter({ hasText:'FI18 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi18Page.locator('#screen-world.active').waitFor();
    const fi18Evidence = await fi18Page.evaluate(async fixture => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const cards = E.CardCollection.get(save.characterId).data;
      const quarantine = await E.RewardRecovery.create().listQuarantine(fixture.characterId);
      return { save, cards, quarantine };
    }, fi18Fixture);
    if (!fi18Evidence.quarantine.ok ||
        !fi18Evidence.quarantine.entries.some(e => e.reason === 'SAVE_JOURNAL_PAYLOAD_MISMATCH') ||
        fi18Evidence.save.stats.exp !== fi18Fixture.beforeExp ||
        (fi18Evidence.save.items.jelly || 0) !== fi18Fixture.beforeItems ||
        fi18Evidence.cards.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== fi18Fixture.beforeCards ||
        fi18Evidence.cards.claimedRewardIds.includes(fi18Fixture.rewardId)) {
      throw new Error('FI-18: conflicting reward payload was claimed or not quarantined');
    }
    await fi18Context.close();


    // FI-19: interrupted Save Engine resume after a durable pending-reward write.
    // Inject W4 failure, interrupt the first resume at W5, then resume the same tx.
    // Do not recompute the reward, reroll cards, or change the production Save Engine.
    const fi19Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi19Page = await fi19Context.newPage();
    fi19Page.on('pageerror', error => errors.push('FI-19: ' + String(error)));
    await fi19Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi19Page.getByRole('button', { name:'Create New Character' }).click();
    await fi19Page.locator('#screen-create.active').waitFor();
    await fi19Page.locator('#character-name').fill('FI19 Hero');
    await fi19Page.getByRole('button', { name:'Create Character' }).click();
    await fi19Page.locator('#screen-world.active').waitFor();
    const fi19Fixture = await fi19Page.evaluate(async () => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
      const createdAt = new Date().toISOString(), journal = E.RewardRecovery.create();
      const beforeCards = E.CardCollection.get(save.characterId).data.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity;
      const result = await journal.runExclusive(save.characterId, async () => {
        const intent = { rewardId, encounterId, monsterId:'poring', exp:2, gold:0, drops:[],
          cards:[{ cardId:'bash', stars:1, quantity:1 }], createdAt };
        const prepared = await journal.prepare(save.characterId, intent);
        if (!prepared.ok) return prepared;
        const staged = E.CardCollection.stageReward(save.characterId, rewardId, intent.cards);
        if (!staged.ok) return staged;
        const sidecar = await journal.transition(save.characterId, rewardId, 'sidecarStaged');
        if (!sidecar.ok) return sidecar;
        const pending = E.Save.withPendingReward(save, { exp:2, gold:0, drops:[] }, 'poring', createdAt);
        if (!pending.ok) return pending;
        let failW4 = true, interruptW5 = true;
        const hooks = {
          actionFor(step) { if (step === 'W4' && failW4) { failW4 = false; return 'fail'; } return null; },
          haltAfter(step) { if (step === 'W5' && interruptW5) { interruptW5 = false; return true; } return false; }
        };
        const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend(), hooks });
        const interrupted = system.commit(save, pending.save);
        if (interrupted.ok || !interrupted.durable || interrupted.stage !== 'W4' || !interrupted.tx) {
          throw new Error('FI-19 expected durable W4 failure with resumable transaction');
        }
        let halted = false;
        try { system.resume(interrupted.tx); }
        catch (error) {
          if (!(error instanceof E.Save.SaveHalt)) throw error;
          halted = true;
        }
        if (!halted) throw new Error('FI-19 expected interruption during resume W5');
        const recovered = system.resume(interrupted.tx);
        if (!recovered.ok || !recovered.full || !recovered.durable ||
            recovered.save.pendingReward.seq !== Number(rewardId)) {
          throw new Error('FI-19 second resume did not finish the same pending reward');
        }
        const duplicateResume = system.resume(interrupted.tx);
        if (!duplicateResume.ok || duplicateResume.save.checksum !== recovered.save.checksum) {
          throw new Error('FI-19 repeated resume changed the durable target');
        }
        return { ok:true };
      });
      if (!result.ok) throw new Error('FI-19 setup failed: ' + result.reason);
      return { characterId:save.characterId, rewardId, beforeExp:save.stats.exp, beforeCards };
    });
    await fi19Page.reload({ waitUntil:'networkidle' });
    await fi19Page.locator('#screen-title.active').waitFor();
    await fi19Page.getByRole('button', { name:'Continue' }).click();
    await fi19Page.locator('#screen-select.active').waitFor();
    await fi19Page.locator('.character-row').filter({ hasText:'FI19 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi19Page.locator('#screen-world.active').waitFor();
    const fi19Recovered = await fi19Page.evaluate(async fixture => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const cards = E.CardCollection.get(save.characterId).data;
      const journal = await E.RewardRecovery.create().get(save.characterId, fixture.rewardId);
      return { save, cards, journal:journal.entry };
    }, fi19Fixture);
    if (fi19Recovered.save.pendingReward !== null ||
        fi19Recovered.save.lastClaimedSeq !== Number(fi19Fixture.rewardId) ||
        fi19Recovered.save.stats.exp !== fi19Fixture.beforeExp + 2 ||
        fi19Recovered.cards.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== fi19Fixture.beforeCards + 1 ||
        fi19Recovered.cards.claimedRewardIds.filter(id => id === fi19Fixture.rewardId).length !== 1 ||
        !fi19Recovered.journal || fi19Recovered.journal.status !== 'completed') {
      throw new Error('FI-19: interrupted Save resume did not settle exactly once after reload');
    }
    await fi19Context.close();


    // FI-21: crash after durable Card Claim, before Save Claim.
    // Verify Sidecar receipt survives reload and recovery applies Save deltas once.
    const fi21Context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    const fi21Page = await fi21Context.newPage();
    fi21Page.on('pageerror', error => errors.push('FI-21: ' + String(error)));
    await fi21Page.goto('http://127.0.0.1:' + port + '/', { waitUntil:'networkidle' });
    await fi21Page.getByRole('button', { name:'Create New Character' }).click();
    await fi21Page.locator('#screen-create.active').waitFor();
    await fi21Page.locator('#character-name').fill('FI21 Hero');
    await fi21Page.getByRole('button', { name:'Create Character' }).click();
    await fi21Page.locator('#screen-world.active').waitFor();
    const fi21Fixture = await fi21Page.evaluate(async () => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const rewardId = String(save.nextRewardSeq);
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      const encounterId = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
      const createdAt = new Date().toISOString(), journal = E.RewardRecovery.create();
      const beforeCards = E.CardCollection.get(save.characterId).data.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity;
      const result = await journal.runExclusive(save.characterId, async () => {
        const intent = { rewardId, encounterId, monsterId:'poring', exp:2, gold:0,
          drops:[{ id:'jelly', name:'Poring Jelly' }],
          cards:[{ cardId:'bash', stars:1, quantity:1 }], createdAt };
        const prepared = await journal.prepare(save.characterId, intent);
        if (!prepared.ok) return prepared;
        const staged = E.CardCollection.stageReward(save.characterId, rewardId, intent.cards);
        if (!staged.ok) return staged;
        const sidecar = await journal.transition(save.characterId, rewardId, 'sidecarStaged');
        if (!sidecar.ok) return sidecar;
        const pending = E.Save.withPendingReward(save, { exp:2, gold:0, drops:intent.drops }, 'poring', createdAt);
        if (!pending.ok) return pending;
        const system = E.Save.createSystem({ backend:E.Save.getBrowserBackend() });
        const committed = system.commit(save, pending.save);
        if (!committed.ok) return committed;
        const pendingState = await journal.transition(save.characterId, rewardId, 'savePending');
        if (!pendingState.ok) return pendingState;
        const claimed = E.CardCollection.claimReward(save.characterId, rewardId);
        if (!claimed.ok || claimed.missingStage) return { ok:false, reason:'FI21_CARD_CLAIM_FAILED' };
        const cardState = await journal.transition(save.characterId, rewardId, 'cardsClaimed');
        if (!cardState.ok) return cardState;
        // Simulated crash boundary: Save Claim intentionally not called.
        const durable = system.loadCharacter(save.characterId);
        const cards = E.CardCollection.get(save.characterId).data;
        if (!durable.ok || durable.save.pendingReward.seq !== Number(rewardId) ||
            durable.save.stats.exp !== save.stats.exp ||
            cards.claimedRewardIds.filter(id => id === rewardId).length !== 1 ||
            cards.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== beforeCards + 1) {
          throw new Error('FI-21 crash checkpoint is not durable Card Claim / pending Save');
        }
        return { ok:true };
      });
      if (!result.ok) throw new Error('FI-21 setup failed: ' + result.reason);
      return { characterId:save.characterId, rewardId, beforeExp:save.stats.exp,
        beforeItems:save.items.jelly || 0, beforeCards };
    });
    await fi21Page.reload({ waitUntil:'networkidle' });
    await fi21Page.locator('#screen-title.active').waitFor();
    await fi21Page.getByRole('button', { name:'Continue' }).click();
    await fi21Page.locator('#screen-select.active').waitFor();
    await fi21Page.locator('.character-row').filter({ hasText:'FI21 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi21Page.locator('#screen-world.active').waitFor();
    const fi21Recovered = await fi21Page.evaluate(async fixture => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const cards = E.CardCollection.get(save.characterId).data;
      const journal = await E.RewardRecovery.create().get(save.characterId, fixture.rewardId);
      return { save, cards, journal:journal.entry };
    }, fi21Fixture);
    if (fi21Recovered.save.pendingReward !== null ||
        fi21Recovered.save.lastClaimedSeq !== Number(fi21Fixture.rewardId) ||
        fi21Recovered.save.stats.exp !== fi21Fixture.beforeExp + 2 ||
        (fi21Recovered.save.items.jelly || 0) !== fi21Fixture.beforeItems + 1 ||
        fi21Recovered.cards.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== fi21Fixture.beforeCards + 1 ||
        fi21Recovered.cards.claimedRewardIds.filter(id => id === fi21Fixture.rewardId).length !== 1 ||
        !fi21Recovered.journal || fi21Recovered.journal.status !== 'completed') {
      throw new Error('FI-21: Card Claim / Save Claim recovery did not settle exactly once');
    }
    await fi21Page.reload({ waitUntil:'networkidle' });
    await fi21Page.getByRole('button', { name:'Continue' }).click();
    await fi21Page.locator('#screen-select.active').waitFor();
    await fi21Page.locator('.character-row').filter({ hasText:'FI21 Hero' }).getByRole('button', { name:'Play' }).click();
    await fi21Page.locator('#screen-world.active').waitFor();
    const fi21Replay = await fi21Page.evaluate(() => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const cards = E.CardCollection.get(save.characterId).data;
      return { exp:save.stats.exp, items:save.items.jelly || 0,
        cards:cards.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity };
    });
    if (fi21Replay.exp !== fi21Recovered.save.stats.exp ||
        fi21Replay.items !== (fi21Recovered.save.items.jelly || 0) ||
        fi21Replay.cards !== fi21Fixture.beforeCards + 1) {
      throw new Error('FI-21: second reload replayed an already claimed reward');
    }

    // FI-26: retry a settled journal-backed reward repeatedly without reapplying deltas.
    // Use the same durable FI-21 fixture after its first recovery, then exercise
    // the existing Sidecar claim retry and the Journal recovery path across reloads.
    const fi26First = await fi21Page.evaluate(async fixture => {
      const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
      const collection = E.CardCollection.get(save.characterId);
      const claim = E.CardCollection.claimReward(save.characterId, fixture.rewardId);
      const entry = await E.RewardRecovery.create().get(save.characterId, fixture.rewardId);
      return { claim, entry:entry.entry, save, collection:collection.data };
    }, fi21Fixture);
    if (!fi26First.claim.ok || !fi26First.claim.alreadyClaimed ||
        fi26First.entry.status !== 'completed' ||
        fi26First.save.pendingReward !== null) {
      throw new Error('FI-26: retry of completed reward did not preserve durable receipt');
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      await fi21Page.reload({ waitUntil:'networkidle' });
      await fi21Page.getByRole('button', { name:'Continue' }).click();
      await fi21Page.locator('#screen-select.active').waitFor();
      await fi21Page.locator('.character-row').filter({ hasText:'FI21 Hero' }).getByRole('button', { name:'Play' }).click();
      await fi21Page.locator('#screen-world.active').waitFor();
      const evidence = await fi21Page.evaluate(async fixture => {
        const E = window.ELDORIA, save = E.GameSave.getCurrentSave();
        const claim = E.CardCollection.claimReward(save.characterId, fixture.rewardId);
        const cards = E.CardCollection.get(save.characterId).data;
        const entry = await E.RewardRecovery.create().get(save.characterId, fixture.rewardId);
        return { save, claim, cards, entry:entry.entry };
      }, fi21Fixture);
      if (!evidence.claim.ok || !evidence.claim.alreadyClaimed ||
          evidence.save.pendingReward !== null ||
          evidence.save.lastClaimedSeq !== Number(fi21Fixture.rewardId) ||
          evidence.save.stats.exp !== fi21Fixture.beforeExp + 2 ||
          (evidence.save.items.jelly || 0) !== fi21Fixture.beforeItems + 1 ||
          evidence.cards.owned.find(c => c.cardId === 'bash' && c.stars === 1).quantity !== fi21Fixture.beforeCards + 1 ||
          evidence.cards.claimedRewardIds.filter(id => id === fi21Fixture.rewardId).length !== 1 ||
          !evidence.entry || evidence.entry.status !== 'completed') {
        throw new Error('FI-26: repeated claim/reload replayed EXP, items or cards (attempt ' + attempt + ')');
      }
    }
    await fi21Context.close();

if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ results, pageErrors:errors, FI38:'pass', FI10:'pass', FI20:'pass', FI22:'pass' }, null, 2));
    console.log('PASS  character creation and selection smoke test on desktop and iPhone-sized Chromium');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode=1; });
