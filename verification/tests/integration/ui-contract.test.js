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
  assert.match(main, /if \(!saved\.ok\) return;[\s\S]{0,120}active = false/);
});

test('A pending victory reward blocks Continue when claim cannot commit', () => {
  assert.match(main, /function settlePendingReward\(save\)[\s\S]*?if \(!claim\.ok\) return null/);
  assert.match(main, /if \(!settled\)[\s\S]*?lockGame\('A saved victory reward still needs to be committed/);
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
  assert.match(main, /entry\.state !== 'ready'/);
  assert.match(main, /saveSystem\.loadCharacter\(id\)/);
  assert.match(main, /settlePendingReward\(loaded\.save\)/);
  assert.doesNotMatch(main, /localStorage\.(setItem|removeItem)/);
  assert.match(html, /css\/character\.css/);
});
