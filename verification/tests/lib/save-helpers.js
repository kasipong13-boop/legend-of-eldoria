// Shared helpers for save.js tests: in-memory storage, fault hooks, clock, quick character setup.
const path = require('path');
const PROJECT = path.resolve(__dirname, '../../..');
const DEV = process.env.ELDORIA_DIR || (require('fs').existsSync(path.join(PROJECT, 'game/js/save.js')) ? path.join(PROJECT, 'game') : PROJECT);
const Save = require(path.join(DEV, 'js/save.js'));

function memBackend(opts = {}) {
  const m = new Map();
  const b = {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (opts.throwOnSet) throw new Error('QuotaExceededError');
      if (opts.maxBytes) {
        let total = 0; for (const [kk, vv] of m) if (kk !== k) total += kk.length + vv.length;
        if (total + k.length + String(v).length > opts.maxBytes) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      }
      m.set(k, String(v));
    },
    removeItem: k => { m.delete(k); },
    key: i => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
    _m: m,
    snapshot: () => new Map(m)
  };
  return b;
}

// hooks({ fail: ['W3'], corrupt: ['W4'], halt: ['W2'], record: [] })
function hooks(cfg = {}) {
  const fail = new Set(cfg.fail || []), corrupt = new Set(cfg.corrupt || []), halt = new Set(cfg.halt || []);
  return {
    steps: cfg.record || [],
    actionFor(step) { this.steps.push(step); return fail.has(step) ? 'fail' : corrupt.has(step) ? 'corrupt' : null; },
    haltAfter(step) { return halt.has(step); }
  };
}

function clock(start = Date.UTC(2026, 10, 7, 10, 0, 0)) {
  let t = start;
  return () => new Date((t += 1000)).toISOString();
}

const RULES = { maxHp: 50, start: { c: 5, r: 5 } };

// Simple deterministic reward application used by the save-layer tests
// (the real level-up rules are wired in S3 and tested there).
function applyStub(n, p) {
  n.stats.exp += p.exp;
  n.gold += p.gold;
  n.items.jelly += p.drops.filter(d => d.id === 'jelly').length;
}

function sys(backend, h, extra = {}) {
  return Save.createSystem(Object.assign({ backend, hooks: h || null, now: extra.now || clock() }, extra));
}

function newChar(s, name = 'สมชาย', extra = {}) {
  const r = s.createCharacter(Object.assign({ name, gender: 'male', hairStyle: 0, hairColor: 0 }, extra), RULES);
  if (!r.ok) throw new Error('createCharacter failed: ' + JSON.stringify(r));
  return r.save;
}

// Commit helpers that throw on failure (for building states).
function pending(s, save, exp = 12, gold = 7, jelly = true) {
  const t = Save.withPendingReward(save, { exp, gold, drops: jelly ? [{ id: 'jelly', name: 'Poring Jelly' }] : [] }, 'poring', '2026-11-07T00:00:00.000Z');
  if (!t.ok) throw new Error(t.reason);
  const c = s.commit(save, t.save);
  if (!c.ok) throw new Error('commit pending failed ' + JSON.stringify(c));
  return c.save;
}
function claim(s, save) {
  const t = Save.withClaim(save, applyStub);
  if (!t.ok) throw new Error(t.reason);
  const c = s.commit(save, t.save);
  if (!c.ok) throw new Error('commit claim failed ' + JSON.stringify(c));
  return c.save;
}

function parts(backend, id) {
  const get = p => { const v = backend.getItem(`eldoria.char.${id}.${p}`); try { return v === null ? null : JSON.parse(v); } catch (e) { return 'GARBAGE'; } };
  return { main: get('main'), backup: get('backup'), guard: get('guard') };
}
function rev(x) { return x && x !== 'GARBAGE' ? x.revision : x; }
function revs(backend, id) { const p = parts(backend, id); return [rev(p.main), rev(p.backup), rev(p.guard)]; }

function putRaw(backend, id, part, obj) { backend.setItem(`eldoria.char.${id}.${part}`, typeof obj === 'string' ? obj : JSON.stringify(obj)); }

// Rewrite a record with modifications, re-sealed (valid checksum).
function reseal(obj, patch) { const o = JSON.parse(JSON.stringify(obj)); patch(o); return Save.seal(o); }

module.exports = { Save, DEV, memBackend, hooks, clock, RULES, applyStub, sys, newChar, pending, claim, parts, revs, putRaw, reseal };
