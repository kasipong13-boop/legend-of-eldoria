// S1 unit tests: creation, index, commit, resume, recovery, discard (plan IDs in test names).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../lib/save-helpers');
const { Save, memBackend, hooks, sys, newChar, pending, claim, parts, revs, putRaw, reseal, RULES, applyStub } = H;

const K = (id, p) => `eldoria.char.${id}.${p}`;
const GARBAGE = '{"broken":';

// Build a real history: r2 ready, r3 pending#1, r4 claim, r5 pending#2, r6 claim, r7 pending#3.
function toR7(b, h) {
  const s = sys(b, h);
  let v = newChar(s);
  v = pending(s, v); v = claim(s, v); v = pending(s, v); v = claim(s, v); v = pending(s, v);
  assert.equal(v.revision, 7); assert.equal(v.pendingReward.seq, 3);
  return { s, v, id: v.characterId };
}
// Main r8 (claim of #3 durable), Backup r7, Guard r7: app closed right after W3.
function stateMainR8BackupR7(b) {
  const { v, id } = toR7(b);
  const s2 = sys(b, hooks({ halt: ['W3'] }));
  const t = Save.withClaim(v, applyStub);
  assert.throws(() => s2.commit(v, t.save), e => e instanceof Save.SaveHalt);
  assert.deepEqual(revs(b, id), [8, 7, 7]);
  return { id, r7: v };
}
const claimsApplied = save => save.items.jelly; // every test reward drops exactly one jelly

/* ---------------- Creation (creating -> ready) ---------------- */

test('CREATE success: Main/Backup/Guard r2 ready, index lists it', () => {
  const b = memBackend(); const s = sys(b);
  const save = newChar(s, 'น้ำใจ', { gender: 'female', hairStyle: 5, hairColor: 7 });
  const p = parts(b, save.characterId);
  assert.deepEqual(revs(b, save.characterId), [2, 2, 2]);
  assert.equal(p.main.status, 'ready'); assert.equal(b.getItem(K(save.characterId, 'main')), b.getItem(K(save.characterId, 'backup')));
  assert.deepEqual(JSON.parse(b.getItem('eldoria.index')).order, [save.characterId]);
  const list = s.listCharacters();
  assert.equal(list.characters.length, 1); assert.equal(list.characters[0].state, 'ready');
  assert.equal(list.characters[0].save.profile.name, 'น้ำใจ');
});

test('CREATE multiple characters: unique ids, independent progress, no overwrite', () => {
  const b = memBackend(); const s = sys(b);
  const a = newChar(s, 'Aria'), c = newChar(s, 'Bram'), d = newChar(s, 'Cira');
  assert.equal(new Set([a.characterId, c.characterId, d.characterId]).size, 3);
  const bBefore = ['main', 'backup', 'guard'].map(p => b.getItem(K(c.characterId, p)));
  let a2 = pending(s, a); a2 = claim(s, a2);
  assert.deepEqual(['main', 'backup', 'guard'].map(p => b.getItem(K(c.characterId, p))), bBefore, 'B untouched byte-for-byte');
  const list = s.listCharacters().characters;
  const byName = Object.fromEntries(list.map(x => [x.save.profile.name, x.save]));
  assert.equal(byName.Aria.gold, 7); assert.equal(byName.Bram.gold, 0); assert.equal(byName.Cira.gold, 0);
  assert.deepEqual(list.map(x => x.save.profile.name), ['Aria', 'Bram', 'Cira'], 'creation order kept');
});

test('CREATE invalid name or appearance writes nothing', () => {
  const b = memBackend(); const s = sys(b);
  assert.equal(s.createCharacter({ name: '', gender: 'male', hairStyle: 0, hairColor: 0 }, RULES).reason, 'NAME_empty');
  assert.equal(s.createCharacter({ name: 'Ok', gender: 'x', hairStyle: 0, hairColor: 0 }, RULES).reason, 'APPEARANCE_gender');
  assert.equal(s.createCharacter({ name: 'Ok', gender: 'male', hairStyle: 6, hairColor: 0 }, RULES).reason, 'APPEARANCE_hairStyle');
  assert.equal(s.createCharacter({ name: 'Ok', gender: 'male', hairStyle: 0, hairColor: 8 }, RULES).reason, 'APPEARANCE_hairColor');
  assert.equal(b.length, 0);
});

for (const step of ['CC3', 'CC4', 'CC5', 'W2', 'W3', 'W4', 'W5', 'IDX']) {
  test(`CREATE interrupted (app closed after ${step}): other characters untouched, new one never shown ready while incomplete`, () => {
    const b = memBackend(); const s = sys(b);
    const a = newChar(s, 'Existing');
    const aRaw = ['main', 'backup', 'guard'].map(p => b.getItem(K(a.characterId, p)));
    const s2 = sys(b, hooks({ halt: [step] }));
    assert.throws(() => s2.createCharacter({ name: 'Newbie', gender: 'female', hairStyle: 2, hairColor: 3 }, RULES), e => e instanceof Save.SaveHalt);
    const list = sys(b).listCharacters();
    const ex = list.characters.find(x => x.id === a.characterId);
    assert.equal(ex.state, 'ready');
    assert.deepEqual(['main', 'backup', 'guard'].map(p => b.getItem(K(a.characterId, p))), aRaw, 'existing character byte-identical');
    const nw = list.characters.find(x => x.id !== a.characterId);
    assert.ok(nw, 'interrupted character is found by scanning, not lost');
    const expected = ['CC3', 'CC4', 'CC5', 'W2'].includes(step) ? 'creating' : 'ready';
    assert.equal(nw.state, expected, `after ${step}`);
    if (expected === 'ready') assert.deepEqual(revs(b, nw.id), [2, 2, 2], 'Durable Commit reached: rolled forward to a full, consistent set');
    if (expected === 'creating') assert.equal(sys(b).loadCharacter(nw.id).reason, 'NOT_READY', 'cannot be played');
    assert.ok(JSON.parse(b.getItem('eldoria.index')).order.includes(nw.id), 'index repaired to include it');
  });
}

test('CREATE stuck in "creating" can be finished or discarded by the player', () => {
  const b = memBackend(); const s = sys(b);
  const r = sys(b, hooks({ fail: ['CC5'] })).createCharacter({ name: 'Half', gender: 'male', hairStyle: 0, hairColor: 0 }, RULES);
  assert.equal(r.ok, false); assert.equal(r.stage, 'CC5');
  assert.equal(s.listCharacters().characters[0].state, 'creating');
  const f = s.finishCreation(r.id);
  assert.equal(f.ok, true); assert.equal(f.save.status, 'ready');
  assert.equal(s.listCharacters().characters[0].state, 'ready');
  const r2 = sys(b, hooks({ fail: ['CC4'] })).createCharacter({ name: 'Other', gender: 'male', hairStyle: 0, hairColor: 0 }, RULES);
  assert.equal(s.discardCharacter(r2.id, { confirmed: true }).ok, true);
  assert.deepEqual(s.listCharacters().characters.map(x => x.save.profile.name), ['Half']);
});

test('CREATE torn first write leaves a "damaged" entry, never a playable one; other characters fine', () => {
  const b = memBackend(); const s = sys(b); const a = newChar(s, 'Safe');
  const r = sys(b, hooks({ corrupt: ['CC3'] })).createCharacter({ name: 'Torn', gender: 'male', hairStyle: 0, hairColor: 0 }, RULES);
  assert.equal(r.ok, false);
  const list = s.listCharacters().characters;
  assert.equal(list.find(x => x.id === r.id).state, 'damaged');
  assert.equal(list.find(x => x.id === a.characterId).state, 'ready');
  assert.equal(b.getItem(K(r.id, 'main')).length > 0, true, 'damaged data is kept, not deleted');
});

test('CREATE storage full: fails cleanly, existing character intact', () => {
  const b = memBackend(); const s = sys(b); const a = newChar(s, 'Full');
  const snap = b.snapshot();
  const used = [...snap].reduce((n, [k, v]) => n + k.length + v.length, 0);
  const tight = memBackend({ maxBytes: used + 100 });
  for (const [k, v] of snap) tight._m.set(k, v);
  const r = sys(tight).createCharacter({ name: 'NoRoom', gender: 'male', hairStyle: 0, hairColor: 0 }, RULES);
  assert.equal(r.ok, false); assert.equal(r.reason, 'WRITE_FAILED');
  assert.equal(sys(tight).loadCharacter(a.characterId).ok, true);
});

/* ---------------- Index ---------------- */

function threeChars() { const b = memBackend(); const s = sys(b); const ids = ['Aria', 'Bram', 'Cira'].map(n => newChar(s, n).characterId); return { b, s, ids }; }

test('INDEX corrupted -> rebuilt from validated records, nobody lost', () => {
  const { b, s, ids } = threeChars();
  b.setItem('eldoria.index', GARBAGE);
  const r = s.listCharacters();
  assert.deepEqual(r.characters.map(x => x.id).sort(), [...ids].sort());
  assert.ok(r.notices.includes('indexInvalid')); assert.ok(r.notices.includes('indexRebuilt'));
  assert.equal(Save.validateIndex(JSON.parse(b.getItem('eldoria.index'))).ok, true);
});

test('INDEX missing or bad checksum -> rebuilt', () => {
  const { b, s, ids } = threeChars();
  b.removeItem('eldoria.index');
  assert.equal(s.listCharacters().characters.length, 3);
  const x = JSON.parse(b.getItem('eldoria.index')); x.order.reverse(); b.setItem('eldoria.index', JSON.stringify(x));
  const r = s.listCharacters();
  assert.ok(r.notices.includes('indexInvalid')); assert.equal(r.characters.length, 3);
});

test('INDEX keeps its order and appends characters it did not know about', () => {
  const { b, s, ids } = threeChars();
  const x = JSON.parse(b.getItem('eldoria.index'));
  b.setItem('eldoria.index', JSON.stringify(Save.seal({ schemaVersion: 1, revision: x.revision + 1, order: [ids[2], ids[0]] })));
  const r = s.listCharacters();
  assert.deepEqual(r.characters.map(c => c.id), [ids[2], ids[0], ids[1]]);
  assert.ok(r.notices.includes('indexRecoveredCharacters'));
});

test('INDEX never brings back Discarded characters', () => {
  const { b, s, ids } = threeChars();
  const oldIndex = b.getItem('eldoria.index');
  assert.equal(s.discardCharacter(ids[1], { confirmed: true }).ok, true);
  b.setItem('eldoria.index', oldIndex); // stale index that still names the discarded character
  let r = s.listCharacters();
  assert.deepEqual(r.characters.map(c => c.id), [ids[0], ids[2]]);
  b.setItem('eldoria.index', GARBAGE); // and when the index is rebuilt from scratch
  r = s.listCharacters();
  assert.deepEqual(r.characters.map(c => c.id).sort(), [ids[0], ids[2]].sort());
  assert.ok([...b._m.keys()].some(k => k.startsWith(`eldoria.discarded.${ids[1]}.`)), 'discarded data still kept');
});

test('INDEX only lists a character as ready after Main/Backup/Guard checks', () => {
  const { b, s, ids } = threeChars();
  putRaw(b, ids[0], 'main', GARBAGE); putRaw(b, ids[0], 'backup', GARBAGE); // only a Guard left
  b.removeItem(K(ids[1], 'main')); b.removeItem(K(ids[1], 'guard'));        // only a valid Backup left
  const r = s.listCharacters().characters;
  assert.equal(r.find(c => c.id === ids[0]).state, 'damaged');
  assert.equal(r.find(c => c.id === ids[1]).state, 'ready');
  assert.deepEqual(revs(b, ids[1]), [2, 2, 2], 'repaired from the valid Backup');
});

test('INDEX write failure does not hide characters', () => {
  const { b, ids } = threeChars();
  b.setItem('eldoria.index', GARBAGE);
  const r = sys(b, hooks({ fail: ['IDX'] })).listCharacters();
  assert.equal(r.characters.length, 3); assert.ok(r.notices.includes('indexWriteFailed'));
});

/* ---------------- Commit / Pending / Claim ---------------- */

test('PENDING only one at a time; claim only once; stale in-memory save refused', () => {
  const b = memBackend(); const s = sys(b); let v = newChar(s);
  v = pending(s, v);
  assert.equal(Save.withPendingReward(v, { exp: 1, gold: 1, drops: [] }, 'poring', 't').reason, 'PENDING_EXISTS');
  const old = v;
  v = claim(s, v);
  assert.equal(Save.withClaim(v, applyStub).reason, 'NO_PENDING');
  const again = Save.withClaim(old, applyStub);
  assert.equal(s.commit(old, again.save).reason, 'STALE', 'replaying an old claim is refused');
  assert.equal(claimsApplied(sys(b).loadCharacter(v.characterId).save), 1);
});

test('PENDING cross-character leakage refused', () => {
  const b = memBackend(); const s = sys(b);
  let a = newChar(s, 'A'); const c = newChar(s, 'B');
  a = pending(s, a);
  const forged = JSON.parse(JSON.stringify(c)); forged.pendingReward = a.pendingReward;
  assert.equal(Save.withClaim(forged, applyStub).reason, 'WRONG_CHARACTER');
  assert.match(s.commit(c, Object.assign({}, forged, { pendingReward: a.pendingReward })).reason, /^INVALID_TARGET:pendingReward/);
});

for (const step of ['W2', 'W3']) {
  test(`SL-5 / FL-9 claim fails at ${step} (before Durable Commit): nothing applied, retry applies once`, () => {
    const b = memBackend(); const { v, id } = toR7(b);
    const t = Save.withClaim(v, applyStub);
    const r = sys(b, hooks({ fail: [step] })).commit(v, t.save);
    assert.equal(r.ok, false); assert.equal(r.durable, false);
    assert.equal(sys(b).loadCharacter(id).save.pendingReward.seq, 3, 'reward still pending');
    const r2 = sys(b).commit(v, t.save);
    assert.equal(r2.ok, true);
    assert.equal(claimsApplied(r2.save), 3);
    assert.equal(claimsApplied(sys(b).loadCharacter(id).save), 3);
  });
}

test('FL-9 torn Main at W3: not durable; recovery returns the pending reward; claimed exactly once', () => {
  const b = memBackend(); const { v, id } = toR7(b);
  const t = Save.withClaim(v, applyStub);
  const r = sys(b, hooks({ corrupt: ['W3'] })).commit(v, t.save);
  assert.equal(r.durable, false);
  assert.equal(sys(b).commit(v, t.save).reason, 'MAIN_INVALID', 'needs recovery first');
  const rec = sys(b).loadCharacter(id);
  assert.equal(rec.ok, true); assert.equal(rec.save.pendingReward.seq, 3); assert.equal(claimsApplied(rec.save), 2);
  const done = claim(sys(b), rec.save);
  assert.equal(claimsApplied(done), 3);
});

for (const [mode, step] of [['fail', 'W4'], ['corrupt', 'W4'], ['fail', 'W5'], ['corrupt', 'W5']]) {
  test(`H7 / S3 / S4 ${mode} at ${step} after Durable Commit -> Save Pending; Resume finishes without re-applying`, () => {
    const b = memBackend(); const { v, id } = toR7(b);
    const t = Save.withClaim(v, applyStub);
    const r = sys(b, hooks({ [mode]: [step] })).commit(v, t.save);
    assert.equal(r.ok, false); assert.equal(r.durable, true); assert.equal(r.stage, step);
    const rec = [];
    const done = sys(b, hooks({ record: rec })).resume(r.tx);
    assert.equal(done.ok, true); assert.equal(done.full, true);
    assert.ok(!rec.includes('W2') && !rec.includes('W3'), 'resume did not rewrite Main: ' + rec);
    assert.deepEqual(revs(b, id), [8, 8, 8]);
    assert.equal(claimsApplied(done.save), 3);
    assert.equal(sys(b).loadCharacter(id).save.pendingReward, null);
  });
}

test('RESUME after W3 torn write -> recovery then re-commit of the same target, applied once', () => {
  const b = memBackend(); const { v, id } = toR7(b);
  const t = Save.withClaim(v, applyStub);
  const r = sys(b, hooks({ corrupt: ['W3'] })).commit(v, t.save);
  const done = sys(b).resume(r.tx);
  assert.equal(done.ok, true); assert.equal(claimsApplied(done.save), 3);
  assert.equal(claimsApplied(sys(b).loadCharacter(id).save), 3);
});

for (const step of ['W2', 'W3', 'W4', 'W5']) {
  test(`H4 app closed after ${step} while claiming: reopen gives 0 or 1 claim, never 2; never acknowledged early`, () => {
    const b = memBackend(); const { v, id } = toR7(b);
    const t = Save.withClaim(v, applyStub);
    let acknowledged = false;
    try { const r = sys(b, hooks({ halt: [step] })).commit(v, t.save); acknowledged = r.ok; } catch (e) { assert.ok(e instanceof Save.SaveHalt); }
    assert.equal(acknowledged, false);
    const s = sys(b).loadCharacter(id).save;
    if (step === 'W2') { assert.equal(claimsApplied(s), 2); assert.equal(s.pendingReward.seq, 3); }
    else { assert.equal(claimsApplied(s), 3); assert.equal(s.pendingReward, null); }
    assert.deepEqual(revs(b, id), step === 'W2' ? [7, 7, 7] : [8, 8, 8]);
  });
}

test('ORDER commit writes old->Backup, new Main, new Backup, Guard LAST (W2..W5)', () => {
  const b = memBackend(); const { v, id } = toR7(b);
  const rec = [];
  const r = sys(b, hooks({ record: rec })).commit(v, Save.withClaim(v, applyStub).save);
  assert.equal(r.ok, true);
  assert.deepEqual(rec, ['W2', 'W3', 'W4', 'W5']);
});

test('ORDER when the Guard is written, Main and Backup already hold the new revision', () => {
  const b = memBackend(); const { v, id } = toR7(b);
  const seen = [];
  const watch = Object.create(b);
  watch.setItem = (k, val) => {
    if (k === K(id, 'guard')) seen.push(revs(b, id).slice(0, 2));
    b.setItem(k, val);
  };
  Object.defineProperty(watch, 'length', { get: () => b.length });
  const r = sys(watch).commit(v, Save.withClaim(v, applyStub).save);
  assert.equal(r.ok, true);
  assert.deepEqual(seen, [[8, 8]]);
});

test('RESUME after a W4 failure continues exactly with W4 then W5', () => {
  const b = memBackend(); const { v } = toR7(b);
  const r = sys(b, hooks({ fail: ['W4'] })).commit(v, Save.withClaim(v, applyStub).save);
  const rec = [];
  assert.equal(sys(b, hooks({ record: rec })).resume(r.tx).ok, true);
  assert.deepEqual(rec, ['W4', 'W5']);
});

test('TIE same revision in Main and Backup but different content -> Main wins', () => {
  const b = memBackend(); const s = sys(b); const v = newChar(s);
  const id = v.characterId;
  const other = reseal(v, o => { o.gold = 999; });
  putRaw(b, id, 'backup', other);
  const r = sys(b).recover(id);
  assert.equal(r.save.gold, 0, 'Main (gold 0) chosen over Backup (gold 999)');
  assert.equal(parts(b, id).backup.gold, 0, 'Backup repaired to match Main');
});

/* ---------------- Recovery ---------------- */

test('H1 / R1 / S5 / D1b / D6 / RV1 Main r8, Backup r7, Guard r7, no content change -> copy repair, stays r8', () => {
  const b = memBackend(); const { id } = stateMainR8BackupR7(b);
  const rec = [];
  const r = sys(b, hooks({ record: rec })).recover(id);
  assert.equal(r.status, 'ok'); assert.equal(r.save.revision, 8);
  assert.deepEqual(rec, ['CR-backup', 'CR-guard'], 'Main not touched, no RS steps');
  assert.ok(r.notices.includes('rolledForward'));
  assert.deepEqual(revs(b, id), [8, 8, 8]);
  assert.equal(claimsApplied(r.save), 3);
  assert.equal(sys(b).recover(id).repaired, false, 'second recovery changes nothing');
});

test('R2 Main+Backup r8, Guard corrupt -> Guard repaired, totals unchanged', () => {
  const b = memBackend(); const { id } = stateMainR8BackupR7(b);
  sys(b).recover(id);
  putRaw(b, id, 'guard', GARBAGE);
  const before = parts(b, id).main;
  const r = sys(b).recover(id);
  assert.equal(r.status, 'ok'); assert.equal(r.save.revision, 8);
  assert.deepEqual([r.save.stats, r.save.gold, r.save.items], [before.stats, before.gold, before.items]);
  assert.ok(r.notices.includes('guardInvalid'));
  assert.equal(Save.validateGuard(parts(b, id).guard, id).ok, true);
});

test('H3 / BR-A claim fully committed, then Main corrupt -> restored from Backup, no Pending', () => {
  const b = memBackend(); const { s, v, id } = toR7(b);
  claim(s, v);
  putRaw(b, id, 'main', GARBAGE);
  const r = sys(b).recover(id);
  assert.equal(r.status, 'ok'); assert.equal(r.save.pendingReward, null); assert.equal(claimsApplied(r.save), 3);
  assert.ok(r.notices.includes('restoredFromBackup'));
  assert.deepEqual(revs(b, id), [8, 8, 8]);
});

test('R3 / H5 Main r8 lost before Backup r8 written, Guard unconfirmed -> Pending back from Backup r7, claimable once', () => {
  const b = memBackend(); const { id } = stateMainR8BackupR7(b);
  putRaw(b, id, 'main', GARBAGE);
  const r = sys(b).loadCharacter(id);
  assert.equal(r.save.revision, 7); assert.equal(r.save.pendingReward.seq, 3); assert.equal(claimsApplied(r.save), 2);
  const done = claim(sys(b), r.save);
  assert.equal(claimsApplied(done), 3);
  assert.equal(Save.withClaim(done, applyStub).reason, 'NO_PENDING');
});

test('H6 / BR-D committed claim never returns, even from an old Backup outside the claim history window', () => {
  const b = memBackend(); const s = sys(b); let v = newChar(s);
  v = pending(s, v); const oldWithPending = b.getItem(K(v.characterId, 'main')); // pending seq 1
  for (let i = 0; i < 14; i++) { v = claim(s, v); v = pending(s, v); }
  v = claim(s, v);
  assert.equal(v.lastClaimedSeq, 15); assert.ok(!v.claimedRewardIds.includes(1), 'seq 1 is outside the 10-entry history');
  const id = v.characterId;
  putRaw(b, id, 'main', GARBAGE); putRaw(b, id, 'backup', oldWithPending);
  const r = sys(b).recover(id);
  assert.equal(r.status, 'ok'); assert.equal(r.save.pendingReward, null, 'old reward not claimable again');
  assert.ok(r.notices.includes('droppedClaimedPending')); assert.ok(r.notices.includes('restoredOlderCopy'));
  assert.equal(r.save.lastClaimedSeq, 15); assert.ok(r.save.nextRewardSeq >= 16);
  assert.ok(r.save.revision > v.revision, 'revision never goes back');
});

test('BR-B Backup with the higher revision wins over a lower Main', () => {
  const b = memBackend(); const { id } = stateMainR8BackupR7(b);
  const m8 = b.getItem(K(id, 'main')), b7 = b.getItem(K(id, 'backup'));
  putRaw(b, id, 'main', b7); putRaw(b, id, 'backup', m8);
  const r = sys(b).recover(id);
  assert.equal(r.save.revision, 8); assert.ok(r.notices.includes('restoredFromBackup'));
});

test('H8 commit finds Main invalid -> refuses and leaves Backup untouched', () => {
  const b = memBackend(); const { v, id } = toR7(b);
  putRaw(b, id, 'main', GARBAGE);
  const before = b.getItem(K(id, 'backup'));
  const r = sys(b).commit(v, Save.withClaim(v, applyStub).save);
  assert.equal(r.reason, 'MAIN_INVALID'); assert.equal(b.getItem(K(id, 'backup')), before);
});

test('BR-G nothing valid -> damaged, nothing deleted', () => {
  const b = memBackend(); const { id } = toR7(b);
  for (const p of ['main', 'backup', 'guard']) putRaw(b, id, p, GARBAGE + p);
  assert.equal(sys(b).recover(id).status, 'damaged');
  assert.equal(sys(b).loadCharacter(id).ok, false);
  for (const p of ['main', 'backup', 'guard']) assert.equal(b.getItem(K(id, p)), GARBAGE + p);
});

/* ---------------- nextRewardSeq / Guard (S, GA, C) ---------------- */

// A ready save with chosen sequence numbers, written as Main+Backup at revision `r`, guard optional.
function crafted(b, { next, last, pend = null, r = 5, guard = 'match' }) {
  const s = sys(b); const base = newChar(s);
  const id = base.characterId;
  const save = reseal(base, o => {
    o.revision = r; o.nextRewardSeq = next; o.lastClaimedSeq = last;
    o.pendingReward = pend === null ? null : { seq: pend, characterId: id, monsterId: 'poring', exp: 12, gold: 7, drops: [{ id: 'jelly', name: 'Poring Jelly' }], createdAt: 't' };
  });
  putRaw(b, id, 'main', save); putRaw(b, id, 'backup', save);
  if (guard === 'match') putRaw(b, id, 'guard', Save.guardFor(save));
  else if (guard === null) b.removeItem(K(id, 'guard'));
  else putRaw(b, id, 'guard', guard(id, save));
  return { id, save };
}
const G = (o) => (id) => Save.seal(Object.assign({ characterId: id }, o));

test('S1 save.next 6, guard.maxSeqIssued 5 -> next 6 (no skipped number), no new revision', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 6, last: 5 });
  const r = sys(b).recover(id);
  assert.equal(r.save.nextRewardSeq, 6); assert.equal(r.save.revision, 5); assert.equal(r.repaired, false);
});

test('S2 guard.maxSeqIssued 8 -> next 9, content change -> new revision', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 6, last: 5, guard: G({ revision: 5, lastClaimedSeq: 5, maxSeqIssued: 8 }) });
  const r = sys(b).recover(id);
  assert.equal(r.save.nextRewardSeq, 9); assert.equal(r.save.revision, 6);
});

test('GA1 / GA4 guard missing -> maxSeqIssued = next-1, next pending gets seq 6 then next 7', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 6, last: 5, guard: null });
  const r = sys(b).recover(id);
  assert.equal(r.save.nextRewardSeq, 6); assert.ok(r.notices.includes('guardMissing'));
  assert.equal(parts(b, id).guard.maxSeqIssued, 5);
  const v = pending(sys(b), r.save);
  assert.equal(v.pendingReward.seq, 6); assert.equal(v.nextRewardSeq, 7);
});

test('GA2 guard with bad checksum claiming maxSeqIssued 9 is ignored entirely', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 6, last: 5, guard: id => ({ characterId: id, revision: 5, lastClaimedSeq: 8, maxSeqIssued: 9, checksum: 'fnv1a32:00000000' }) });
  const r = sys(b).recover(id);
  assert.equal(r.save.nextRewardSeq, 6); assert.equal(r.save.lastClaimedSeq, 5); assert.ok(r.notices.includes('guardInvalid'));
});

test('GA3 guard for another character id is ignored', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 6, last: 5, guard: () => Save.seal({ characterId: 'f'.repeat(32), revision: 9, lastClaimedSeq: 9, maxSeqIssued: 9 }) });
  const r = sys(b).recover(id);
  assert.equal(r.save.nextRewardSeq, 6); assert.equal(r.save.revision, 5);
});

test('GA5 inconsistent save (next 4 <= lastClaimed 5) -> next 6, new revision', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 4, last: 5, guard: null });
  const r = sys(b).recover(id);
  assert.equal(r.save.nextRewardSeq, 6); assert.equal(r.save.revision, 6);
});

test('GA6 valid guard in step with the save -> used, nothing changes', () => {
  const b = memBackend(); const { id, save } = crafted(b, { next: 6, last: 5 });
  const r = sys(b).recover(id);
  assert.equal(r.save.checksum, save.checksum); assert.equal(r.repaired, false);
});

test('C1 guard lastClaimed 8 / maxSeqIssued 5 is invalid: nothing from it is used', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 6, last: 5, pend: null, guard: G({ revision: 5, lastClaimedSeq: 8, maxSeqIssued: 5 }) });
  const r = sys(b).recover(id);
  assert.equal(r.save.lastClaimedSeq, 5); assert.equal(r.save.nextRewardSeq, 6); assert.ok(r.notices.includes('guardInvalid'));
  assert.equal(Save.validateGuard(parts(b, id).guard, id).ok, true, 'guard rebuilt from the save');
});

test('C2 / C3 valid guard lastClaimed 8 / maxSeq 8, save next 6 -> floor 8, next 9, new revision once', () => {
  const b = memBackend(); const { id, save } = crafted(b, { next: 6, last: 5, guard: G({ revision: 5, lastClaimedSeq: 8, maxSeqIssued: 8 }) });
  const r = sys(b).recover(id);
  assert.equal(r.save.lastClaimedSeq, 8); assert.equal(r.save.nextRewardSeq, 9); assert.equal(r.save.revision, 6);
  assert.notEqual(r.save.checksum, save.checksum);
  const r2 = sys(b).recover(id);
  assert.equal(r2.save.revision, 6); assert.equal(r2.save.checksum, r.save.checksum); assert.equal(r2.repaired, false);
});

test('C4 pending seq 7 with next 6 -> next 8, pending kept, new revision', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 6, last: 5, pend: 7, guard: null });
  const r = sys(b).recover(id);
  assert.equal(r.save.pendingReward.seq, 7); assert.equal(r.save.nextRewardSeq, 8); assert.equal(r.save.revision, 6);
});

test('C5 invariant already fine: next not moved; revision only changes if other content changes', () => {
  const b = memBackend(); const a = crafted(b, { next: 6, last: 5, guard: null });
  assert.equal(sys(b).recover(a.id).save.revision, 5);
  const b2 = memBackend(); const c = crafted(b2, { next: 6, last: 5, pend: 5, guard: null });
  const r = sys(b2).recover(c.id);
  assert.equal(r.save.pendingReward, null); assert.equal(r.save.nextRewardSeq, 6); assert.equal(r.save.revision, 6);
});

/* ---------------- Rollback / revision (RV) and Preserve Source (D) ---------------- */

// Backup r7 with pending seq 5, Guard r8 that already confirms seq 5 claimed, Main torn.
function rv2(b) {
  const { id } = crafted(b, { next: 6, last: 4, pend: 5, r: 7, guard: G({ revision: 8, lastClaimedSeq: 5, maxSeqIssued: 5 }) });
  putRaw(b, id, 'main', GARBAGE);
  return id;
}

test('RV2 / D8 confirmed claim in Guard, Backup r7 still pending -> Pending dropped, r9; Backup (the source) kept until Main r9 written', () => {
  const b = memBackend(); const id = rv2(b);
  const rec = [];
  const r = sys(b, hooks({ record: rec })).recover(id);
  assert.equal(r.status, 'ok'); assert.equal(r.save.revision, 9); assert.equal(r.save.pendingReward, null); assert.equal(r.save.lastClaimedSeq, 5);
  assert.deepEqual(rec, ['RS4', 'RS5', 'RS6'], 'source already in Backup: RS2 skipped, Main written first');
  assert.deepEqual(revs(b, id), [9, 9, 9]);
});

test('RV3 rolled back to r7 (content fine) under a valid Guard r8 -> new revision r9, Guard never goes back', () => {
  const b = memBackend(); const { id } = crafted(b, { next: 7, last: 5, pend: 6, r: 7, guard: G({ revision: 8, lastClaimedSeq: 5, maxSeqIssued: 6 }) });
  const r = sys(b).recover(id);
  assert.equal(r.save.revision, 9); assert.equal(r.save.pendingReward.seq, 6);
  assert.ok(r.notices.includes('restoredOlderCopy'));
  assert.equal(sys(b).recover(id).save.revision, 9, 'RV4 no further increase');
});

for (const step of ['RS4', 'RS5', 'RS6']) {
  test(`RV5 app closed after ${step} during RV2 recovery -> next recovery consistent, revision never decreases`, () => {
    const b = memBackend(); const id = rv2(b);
    assert.throws(() => sys(b, hooks({ halt: [step] })).recover(id), e => e instanceof Save.SaveHalt);
    const r = sys(b).recover(id);
    assert.equal(r.status, 'ok'); assert.equal(r.save.revision, 9); assert.equal(r.save.pendingReward, null);
    assert.deepEqual(revs(b, id), [9, 9, 9]);
  });
}

test('RV6 after RV2, losing the Guard does not bring the Pending back', () => {
  const b = memBackend(); const id = rv2(b);
  sys(b).recover(id);
  b.removeItem(K(id, 'guard'));
  const r = sys(b).recover(id);
  assert.equal(r.save.pendingReward, null); assert.equal(r.save.lastClaimedSeq, 5); assert.ok(r.save.nextRewardSeq >= 6);
});

// Main r8 is the only valid copy; Guard r7 has a higher lastClaimedSeq (content conflict) -> needs r9.
function d1(b, backupMode) {
  const { id } = stateMainR8BackupR7(b);
  const m8 = parts(b, id).main;
  putRaw(b, id, 'guard', Save.seal({ characterId: id, revision: 7, lastClaimedSeq: m8.lastClaimedSeq + 1, maxSeqIssued: m8.nextRewardSeq }));
  if (backupMode === 'garbage') putRaw(b, id, 'backup', GARBAGE);
  return { id, m8raw: b.getItem(K(id, 'main')) };
}

for (const mode of ['old', 'garbage']) {
  test(`D1 / D2 (Backup ${mode}) Main r8 is preserved into Backup and verified before Main r9 is written`, () => {
    const b = memBackend(); const { id, m8raw } = d1(b, mode);
    const rec = [];
    assert.throws(() => sys(b, hooks({ record: rec, halt: ['RS2'] })).recover(id), e => e instanceof Save.SaveHalt);
    assert.deepEqual(rec, ['RS2']);
    assert.equal(b.getItem(K(id, 'backup')), m8raw, 'Backup now holds r8');
    assert.equal(b.getItem(K(id, 'main')), m8raw, 'Main still r8');
    const r = sys(b).recover(id); // D3: continues from the preserved source
    assert.equal(r.status, 'ok'); assert.equal(r.save.revision, 9);
    assert.deepEqual(revs(b, id), [9, 9, 9]);
  });
}

test('D4 / D9 app closed after Main r9 written, then Main r9 lost -> rebuilt from preserved r8, same content, no duplicate', () => {
  const b = memBackend(); const { id } = d1(b, 'garbage');
  assert.throws(() => sys(b, hooks({ halt: ['RS4'] })).recover(id), e => e instanceof Save.SaveHalt);
  const p = parts(b, id);
  assert.equal(p.main.revision, 9); assert.equal(p.backup.revision, 8, 'at least the source is valid');
  const lost = p.main;
  putRaw(b, id, 'main', GARBAGE);
  const r = sys(b).recover(id);
  assert.equal(r.status, 'ok'); assert.equal(r.save.revision, 9);
  assert.equal(Save.contentKey(r.save), Save.contentKey(lost));
  assert.equal(claimsApplied(r.save), claimsApplied(lost));
});

for (const step of ['RS2', 'RS4', 'RS5', 'RS6']) for (const how of ['halt', 'corrupt', 'fail']) {
  test(`D5 ${how} at ${step}: never lose every valid copy; next recovery finishes; no duplicate reward`, () => {
    const b = memBackend(); const { id } = d1(b, 'garbage');
    const base = parts(b, id).main;
    try { sys(b, hooks({ [how]: [step] })).recover(id); } catch (e) { assert.ok(e instanceof Save.SaveHalt); }
    const p = parts(b, id);
    const validCopies = ['main', 'backup'].filter(k => p[k] && p[k] !== 'GARBAGE' && Save.validateSave(p[k], id).ok);
    assert.ok(validCopies.length >= 1, `valid copies after ${how} ${step}: ${validCopies}`);
    const r = sys(b).recover(id);
    assert.equal(r.status, 'ok');
    assert.ok(r.save.revision >= 9);
    assert.equal(claimsApplied(r.save), claimsApplied(base));
  });
}

test('D7 Preserve fails with Backup damaged -> Main untouched, recovery incomplete, character not playable', () => {
  const b = memBackend(); const { id, m8raw } = d1(b, 'garbage');
  const r = sys(b, hooks({ fail: ['RS2'] })).recover(id);
  assert.equal(r.status, 'incomplete'); assert.equal(r.stage, 'RS2');
  assert.equal(b.getItem(K(id, 'main')), m8raw);
  assert.equal(sys(b, hooks({ fail: ['RS2'] })).loadCharacter(id).ok, false);
  assert.equal(sys(b, hooks({ fail: ['RS2'] })).listCharacters().characters[0].state, 'recoveryIncomplete');
});

test('S6 copy repair cannot write -> incomplete, reported, retried later', () => {
  const b = memBackend(); const { id } = stateMainR8BackupR7(b);
  const r = sys(b, hooks({ fail: ['CR-backup'] })).recover(id);
  assert.equal(r.status, 'incomplete'); assert.equal(r.stage, 'CR-backup');
  assert.equal(sys(b).recover(id).status, 'ok');
});

/* ---------------- Discard ---------------- */

test('DISCARD needs confirmation, moves records aside byte-for-byte, other characters untouched', () => {
  const { b, s, ids } = threeChars();
  const raws = ['main', 'backup', 'guard'].map(p => b.getItem(K(ids[1], p)));
  const other = ['main', 'backup', 'guard'].map(p => b.getItem(K(ids[0], p)));
  assert.equal(s.discardCharacter(ids[1]).reason, 'NOT_CONFIRMED');
  assert.equal(s.discardCharacter(ids[1], { confirmed: 'yes' }).reason, 'NOT_CONFIRMED');
  const r = s.discardCharacter(ids[1], { confirmed: true });
  assert.equal(r.ok, true);
  assert.deepEqual(['main', 'backup', 'guard'].map(p => b.getItem(`${r.discardedAs}.${p}`)), raws);
  for (const p of ['main', 'backup', 'guard']) assert.equal(b.getItem(K(ids[1], p)), null);
  assert.deepEqual(['main', 'backup', 'guard'].map(p => b.getItem(K(ids[0], p))), other);
  assert.equal(s.listCharacters().characters.length, 2);
});

test('DISCARD interrupted after copying -> originals still there and listed; copies harmless', () => {
  const { b, ids } = threeChars();
  const r = sys(b, hooks({ fail: ['DS-copy'] })).discardCharacter(ids[0], { confirmed: true });
  assert.equal(r.ok, false);
  assert.equal(sys(b).listCharacters().characters.length, 3);
});

test('DISCARD works on damaged data too (kept under discarded keys)', () => {
  const { b, s, ids } = threeChars();
  for (const p of ['main', 'backup', 'guard']) putRaw(b, ids[2], p, GARBAGE);
  const r = s.discardCharacter(ids[2], { confirmed: true });
  assert.equal(r.ok, true); assert.equal(b.getItem(`${r.discardedAs}.main`), GARBAGE);
});
