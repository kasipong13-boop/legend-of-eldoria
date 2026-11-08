// Randomised crash/failure test of the whole reward loop (BR-C, H4, RV7, D5).
// Each claimed reward k adds gold 2^k and exactly 1 jelly, so a duplicated claim breaks
// "gold == 2^(L+1) - 2 and jelly == L" (L = lastClaimedSeq), and a lost reward breaks it too.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Save, memBackend, sys, newChar, RULES, clock } = require('../lib/save-helpers');

function rng(seed) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
const STEPS = ['W2', 'W3', 'W4', 'W5', 'RS2', 'RS4', 'RS5', 'RS6', 'CR-main', 'CR-backup', 'CR-guard'];
const apply = (n, p) => { n.gold += p.gold; n.items.jelly += 1; };

function invariant(save, label) {
  const L = save.lastClaimedSeq;
  assert.equal(save.items.jelly, L, `${label}: claims counted`);
  assert.equal(save.gold, 2 ** (L + 1) - 2, `${label}: each reward 1..L claimed exactly once`);
  if (save.pendingReward) { assert.equal(save.pendingReward.seq, L + 1, `${label}: pending is the next one`); assert.equal(save.nextRewardSeq, L + 2); }
  else assert.equal(save.nextRewardSeq, L + 1, `${label}: no sequence numbers skipped`);
}

for (const seed of [1, 7, 42, 99, 2026, 31337]) {
  test(`FUZZ seed ${seed}: random fail/corrupt/app-close at every step, 400 actions`, (t) => {
    const r = rng(seed);
    const b = memBackend(); const now = clock();
    let mem = newChar(Save.createSystem({ backend: b, now }), 'Fuzz');
    const id = mem.characterId;
    let maxRevSeen = mem.revision, tx = null, restarts = 0, acks = 0, pendingSaves = 0, resumes = 0;
    const faulty = () => {
      const cfg = { fail: new Set(), corrupt: new Set(), halt: new Set() };
      for (const st of STEPS) { const x = r(); if (x < 0.04) cfg.fail.add(st); else if (x < 0.08) cfg.corrupt.add(st); else if (x < 0.12) cfg.halt.add(st); }
      return Save.createSystem({ backend: b, now, hooks: { actionFor: st => cfg.fail.has(st) ? 'fail' : cfg.corrupt.has(st) ? 'corrupt' : null, haltAfter: st => cfg.halt.has(st) } });
    };
    const restart = () => {
      restarts++; tx = null;
      for (let i = 0; i < 20; i++) {
        let res;
        try { res = faulty().loadCharacter(id); } catch (e) { if (e instanceof Save.SaveHalt) continue; throw e; }
        if (res.ok) { mem = res.save; return; }
        assert.notEqual(res.reason, 'RECOVERY_damaged', 'never lose every valid copy');
      }
      const res = Save.createSystem({ backend: b, now }).loadCharacter(id);
      assert.equal(res.ok, true, 'clean recovery always succeeds'); mem = res.save;
    };
    for (let step = 0; step < 400 && mem.lastClaimedSeq < 24; step++) {
      const s = faulty();
      let out;
      try {
        if (tx) { resumes++; out = s.resume(tx); }
        else {
          const t = mem.pendingReward ? Save.withClaim(mem, apply) : Save.withPendingReward(mem, { exp: 1, gold: 2 ** mem.nextRewardSeq, drops: [] }, 'poring', 't');
          assert.equal(t.ok, true, t.reason);
          out = s.commit(mem, t.save);
        }
      } catch (e) { if (!(e instanceof Save.SaveHalt)) throw e; restart(); invariant(mem, `seed ${seed} after restart`); continue; }
      if (out.ok) {
        acks++; tx = null; mem = out.save;
        // Acknowledged success must mean all three records agree on disk.
        const raw = p => JSON.parse(b.getItem(`eldoria.char.${id}.${p}`));
        assert.equal(raw('main').checksum, mem.checksum); assert.equal(raw('backup').checksum, mem.checksum);
        assert.equal(raw('guard').revision, mem.revision);
      } else if (out.durable) { pendingSaves++; tx = out.tx; }          // Save Pending: only Resume allowed
      else if (out.reason === 'WRITE_FAILED') { /* nothing changed in memory; may retry */ }
      else restart();                                 // STALE / MAIN_INVALID / DIVERGED / RECOVERY_*
      invariant(mem, `seed ${seed} step ${step}`);
      assert.ok(mem.revision >= maxRevSeen || restarts > 0, 'revision never decreases in memory');
      maxRevSeen = Math.max(maxRevSeen, mem.revision);
    }
    restart();
    invariant(mem, `seed ${seed} final`);
    const disk = Save.createSystem({ backend: b, now }).recover(id);
    assert.equal(disk.status, 'ok');
    assert.ok(disk.save.revision >= maxRevSeen, 'revision on disk never below the highest acknowledged one');
    t.diagnostic(`acks=${acks} restarts=${restarts} savePending=${pendingSaves} resumes=${resumes} claimed=${mem.lastClaimedSeq} rev=${disk.save.revision}`);
    assert.ok(acks > 10, `progress made (${acks} acknowledged saves, ${restarts} restarts)`);
  });
}
