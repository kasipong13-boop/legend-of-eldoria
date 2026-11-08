#!/usr/bin/env node
// Optional: runs save.js against a real browser's localStorage (Chromium via Playwright) across a reload.
// Needs Playwright with Chromium installed (npm i playwright && npx playwright install chromium).
const fs = require('fs'), os = require('os'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP  Playwright not installed (optional test)'); process.exit(0); }
const saveJs = path.resolve(__dirname, '..', '..', '..', 'game', 'js', 'save.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eldoria-br-'));
const page = path.join(dir, 'page.html');
fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><script src="file://${saveJs}"></script>`);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('file://' + page);
  const first = await p.evaluate(() => {
    localStorage.clear();
    const S = ELDORIA.Save, sys = S.createSystem({ backend: S.getBrowserBackend() });
    const rules = { maxHp: 50, start: { c: 5, r: 5 } };
    const a = sys.createCharacter({ name: 'น้ำใจ', gender: 'female', hairStyle: 3, hairColor: 4 }, rules);
    const c = sys.createCharacter({ name: 'Bram', gender: 'male', hairStyle: 0, hairColor: 1 }, rules);
    const v = sys.commit(a.save, S.withPendingReward(a.save, { exp: 12, gold: 7, drops: [] }, 'poring', new Date().toISOString()).save);
    const names = ['Ann\tBob', 'Ann\nBob', 'a‍b', '❤️', 'น้ำ', 'Ann　Bob'].map(n => { const r = S.validateName(n); return r.ok ? 'ok(' + r.length + ')' : r.reason; });
    return { probe: sys.probe(), created: a.ok && c.ok && v.ok, names, debug: S.debugHooksFromLocation() };
  });
  await p.reload();
  const after = await p.evaluate(() => {
    const S = ELDORIA.Save, sys = S.createSystem({ backend: S.getBrowserBackend() });
    return sys.listCharacters().characters.map(x => ({ state: x.state, name: x.save.profile.name, revision: x.save.revision, pendingSeq: x.save.pendingReward && x.save.pendingReward.seq }));
  });
  await p.goto('file://' + page + '?debug=save');
  const debugWithQuery = await p.evaluate(() => ELDORIA.Save.debugHooksFromLocation());
  await b.close(); fs.rmSync(dir, { recursive: true, force: true });
  const ok = first.probe && first.created && JSON.stringify(first.names) === JSON.stringify(['control', 'control', 'invisible', 'invisible', 'ok(1)', 'ok(7)'])
    && after.length === 2 && after.every(x => x.state === 'ready') && after[0].pendingSeq === 1 && first.debug === null && debugWithQuery === null && errors.length === 0;
  console.log(JSON.stringify({ first, afterReload: after, debugWithQuery, errors }, null, 1));
  console.log(ok ? 'PASS  save.js works with real browser localStorage across a reload' : 'FAIL  see output above');
  process.exit(ok ? 0 : 1);
})();
