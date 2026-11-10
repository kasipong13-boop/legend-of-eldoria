const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '../../..');
const root = fs.existsSync(path.join(projectRoot, 'game/index.html')) ? path.join(projectRoot, 'game') : projectRoot;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');

test('World and Battle screens expose an in-game menu', () => {
  assert.match(html, /id="btn-menu"/);
  assert.match(html, /id="btn-battle-menu"/);
  assert.match(html, /id="game-menu"/);
  assert.match(main, /function openGameMenu\(\)/);
  assert.match(main, /function returnToTitleFromMenu\(\)/);
});

test('Return to Title persists before leaving the active game', () => {
  assert.match(main, /persist\('menu-return-title'\)/);
  assert.match(main, /persist\('menu-return-title'\)[\s\S]*?if \(!saved\.ok\) return;[\s\S]*?active = false/);
});

test('A pending victory reward blocks Continue when claim cannot commit', () => {
  assert.match(main, /function settlePendingReward\(save\)[\s\S]*?if \(!claim\.ok\) return null/);
  assert.match(main, /if \(!lockResult\.ok \|\| !lockResult\.save\)[\s\S]*?lockGame\('A saved victory reward needs recovery/);
});

test('All local script references resolve to packaged JavaScript files', () => {
  const refs = [...html.matchAll(/<script src="([^"]+\.js)"><\/script>/g)].map(m => m[1]);
  assert.ok(refs.length >= 5);
  for (const ref of refs) assert.ok(fs.existsSync(path.join(root, ref)), `Missing ${ref}`);
});

test('Defeat applies the confirmed 10% gold penalty before persisting', () => {
  assert.match(main, /var goldLost = Math\.floor\(player\.gold \* 0\.10\)/);
  assert.match(main, /player\.gold -= goldLost/);
  assert.match(main, /line\(goldLost > 0 \? 'You lost '/);
  assert.match(main, /player\.gold -= goldLost;[\s\S]*?persist\('battle-defeat'\)/);
});


test('Character creation and selection screens are wired to the current Save API', () => {
  assert.match(html, /id="screen-select"/);
  assert.match(html, /id="screen-create"/);
  assert.match(html, /id="character-name"/);
  assert.match(html, /id="character-gender"/);
  assert.match(html, /id="character-hair"/);
  assert.match(html, /id="character-color"/);
  assert.match(main, /saveSystem\.createCharacter\(\{[\s\S]*?hairStyle:/);
  assert.match(main, /saveSystem\.loadCharacter\(id\)/);
  assert.match(main, /function renderCharacterSelection\(\)/);
  assert.match(main, /function loadSelectedCharacter\(id\)/);
});

test('Character UI preserves save recovery boundaries and does not replace the Save Engine', () => {
  assert.match(main, /c\.state !== 'ready'/);
  assert.match(main, /saveSystem\.loadCharacter\(id\)/);
  assert.match(main, /recoverRewardJournal\(loaded\.save\)/);
  assert.doesNotMatch(main, /localStorage\.(setItem|removeItem)/);
  assert.match(html, /css\/character\.css/);
});


test('Character creation returns to the screen it was opened from', () => {
  assert.match(main, /var characterCreationReturnScreen = 'screen-title'/);
  assert.match(main, /characterCreationReturnScreen = screen/);
  assert.match(main, /characterCreationReturnScreen === 'screen-select'/);
  assert.match(main, /show\('screen-title'\)/);
});

test('Recovery-blocked records disable character creation on every entry point', () => {
  assert.match(main, /\$\('btn-new-character'\)\.disabled = blocked\.length > 0/);
  assert.match(main, /\$\('btn-create-confirm'\)\.disabled = blocked\.length > 0/);
  assert.match(main, /var blocked = chars\.filter\(function \(c\) \{ return c\.state === 'damaged' \|\| c\.state === 'recoveryIncomplete' \|\| c\.state === 'creating'; \}\)/);
  assert.match(html, /id="character-name" type="text" maxlength="16"/);
});


test('Card acquisition module is loaded before the current Save Engine and collection sidecar', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)">/g)].map(match => match[1]);
  assert.ok(scripts.indexOf('js/card-acquisition.js') >= 0);
  assert.ok(scripts.indexOf('js/card-acquisition.js') < scripts.indexOf('js/save.js'));
  assert.ok(scripts.indexOf('js/save.js') < scripts.indexOf('js/card-collection.js'));
  assert.ok(scripts.indexOf('js/card-collection.js') < scripts.indexOf('js/main.js'));
});

test('Reward recovery uses the approved IndexedDB journal and preserves sidecar v2', () => {
  assert.match(main, /RewardRecovery\.create\(\)/);
  assert.match(main, /rewardRecovery\.prepare\(currentSave\.characterId, pendingBattleReward\)/);
  assert.match(main, /CardCollection\.stageReward\(currentSave\.characterId, rewardId, payload\.cards\)/);
  assert.match(main, /rewardRecovery\.transition\(/);
  assert.match(main, /rewardRecovery\.isActive\(save\.characterId\)/);
  assert.match(main, /ACTIVATED_JOURNAL_MISSING/);
  assert.match(main, /SAVE_JOURNAL_ID_MISMATCH/);
  assert.match(main, /var cardsAlreadyDurable = entry\.status === 'cardsClaimed' \|\| entry\.status === 'saveClaimed'/);
  assert.match(main, /battleLockFinished = resolve/);
  assert.match(main, /releaseBattle\(\)/);
  assert.match(main, /function recoverRewardJournal\(save\)/);
  assert.doesNotMatch(main, /CardCollection\.stageBattleReward|CardCollection\.completeReward/);
  assert.match(html, /id="screen-card-collection"/);
  assert.ok(html.indexOf('js/card-collection.js') < html.indexOf('js/reward-recovery.js'));
  assert.ok(html.indexOf('js/reward-recovery.js') < html.indexOf('js/main.js'));
  const recovery = fs.readFileSync(path.join(root, 'js/reward-recovery.js'), 'utf8');
  assert.match(recovery, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(recovery, /locks\.request\('eldoria:reward:'/);
  assert.match(recovery, /WEB_LOCKS_UNAVAILABLE/);
});

test('Card collection metadata displays rarity when assigned without inventing it', () => {
  assert.match(main, /def\.rarity \|\| 'Rarity unassigned'/);
});


test('A victory reward waiting for card-sidecar storage cannot be abandoned through the lock dialog', () => {
  assert.match(main, /var pendingBattleReward = null/);
  assert.match(main, /function retryPendingBattleReward\(\)/);
  assert.match(main, /if \(pendingBattleReward \|\| rewardRecoveryBlocked\) \{/);
  assert.match(main, /returning to the title is temporarily disabled/);
});


test('Retry recognizes an already-claimed Save sequence before staging another reward', () => {
  assert.match(main, /async function retryPendingBattleReward\(\)/);
  assert.match(main, /var recovered = await recoverRewardJournal\(currentSave\)/);
  assert.match(main, /pendingBattleReward = null/);
});


test('A durable recovery block cannot be dismissed by retrying an unrelated world save', () => {
  assert.match(main, /var locked = await rewardRecovery\.runExclusive\(currentSave\.characterId[\s\S]*?recoverRewardJournal\(currentSave\)/);
  assert.match(main, /if \(pendingBattleReward \|\| rewardRecoveryBlocked\)/);
  assert.match(main, /rewardRecoveryBlocked = true/);
});
