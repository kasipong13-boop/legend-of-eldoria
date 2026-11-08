// Regression tests for the three review findings on save.js (ChatGPT review, 2026-11-07).
//  R-1 resume(tx) re-validates tx.target before writing anything
//  R-2 validateName rejects control characters BEFORE whitespace clean-up
//  R-3 Zero Width Joiner and other invisible characters are rejected
// All special characters are written as \u escapes so they are visible when reviewing.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../lib/save-helpers');
const { Save, memBackend, hooks, sys, newChar, pending, claim, parts, revs, applyStub } = H;
const K = (id, p) => `eldoria.char.${id}.${p}`;

/* ---------------- R-1 resume(tx) ---------------- */

// A real failed claim: Durable Commit reached (fail at W4) -> Save Pending with a tx to resume.
function savePending(step = 'W4') {
  const b = memBackend(); const s = sys(b);
  let v = newChar(s); v = pending(s, v);
  const r = sys(b, hooks({ fail: [step] })).commit(v, Save.withClaim(v, applyStub).save);
  assert.equal(r.ok, false);
  return { b, v, id: v.characterId, tx: r.tx, durable: r.durable };
}
const snapshot = (b, id) => ['main', 'backup', 'guard'].map(p => b.getItem(K(id, p)));
const altered = (tx, patch) => { const t = JSON.parse(JSON.stringify(tx.target)); patch(t); return Object.assign({}, tx, { target: t }); };
const resealed = (tx, patch) => Object.assign({}, tx, { target: Save.seal((() => { const t = JSON.parse(JSON.stringify(tx.target)); patch(t); return t; })()) });

const tamperCases = [
  ['target edited, checksum not updated (gold +1000)', tx => altered(tx, t => { t.gold += 1000; }), /^INVALID_TX:checksum$/],
  ['target edited and re-sealed with an unknown field', tx => resealed(tx, t => { t.cheat = true; }), /^INVALID_TX:keys$/],
  ['schemaVersion changed', tx => resealed(tx, t => { t.schemaVersion = 2; }), /^INVALID_TX:schemaVersion$/],
  ['target belongs to another character', tx => resealed(tx, t => { t.characterId = 'f'.repeat(32); }), /^INVALID_TX:characterIdMismatch$/],
  ['tx.characterId does not match the target', tx => Object.assign({}, tx, { characterId: 'e'.repeat(32) }), /^INVALID_TX:characterIdMismatch$/],
  ['revision skips ahead (+2)', tx => resealed(tx, t => { t.revision += 1; }), /^INVALID_TX:revision$/],
  ['revision goes back', tx => resealed(tx, t => { t.revision -= 1; }), /^INVALID_TX:revision$/],
  ['invariant broken: nextRewardSeq <= lastClaimedSeq', tx => resealed(tx, t => { t.nextRewardSeq = t.lastClaimedSeq; }), /^INVALID_TX:invariant$/],
  ['invariant broken: claimed reward still pending', tx => resealed(tx, t => { t.pendingReward = { seq: t.lastClaimedSeq, characterId: t.characterId, monsterId: 'poring', exp: 12, gold: 7, drops: [], createdAt: 'x' }; }), /^INVALID_TX:invariant$/],
  ['stat out of range (hp > maxHp)', tx => resealed(tx, t => { t.stats.hp = t.stats.maxHp + 1; }), /^INVALID_TX:stats$/],
  ['target missing', tx => Object.assign({}, tx, { target: null }), /^BAD_ARGUMENT$/],
  ['oldRevision missing', tx => Object.assign({}, tx, { oldRevision: undefined }), /^INVALID_TX:old$/],
  ['bad character id format', tx => Object.assign({}, tx, { characterId: '../evil' }), /^INVALID_TX:characterId$/],
];

for (const step of ['W4', 'W3']) {
  for (const [label, make, expect] of tamperCases) {
    test(`R-1 resume after failure at ${step} refuses: ${label}; nothing written`, () => {
      const { b, id, tx } = savePending(step);
      const before = snapshot(b, id);
      const rec = [];
      const r = sys(b, hooks({ record: rec })).resume(make(tx));
      assert.equal(r.ok, false);
      assert.match(r.reason, expect);
      assert.deepEqual(rec, [], 'no write step started');
      assert.deepEqual(snapshot(b, id), before, 'storage unchanged byte-for-byte');
    });
  }
  test(`R-1 after refusing tampered input, the genuine tx (failure at ${step}) still resumes and applies the reward once`, () => {
    const { b, id, tx } = savePending(step);
    for (const [, make] of tamperCases) sys(b).resume(make(tx));
    const r = sys(b).resume(tx);
    assert.equal(r.ok, true); assert.equal(r.full, true);
    const save = sys(b).loadCharacter(id).save;
    assert.equal(save.items.jelly, 1); assert.equal(save.gold, 7); assert.equal(save.pendingReward, null);
  });
}

test('R-1 the target kept in a failed transaction is frozen (cannot be changed in place)', () => {
  const { tx } = savePending('W4');
  assert.ok(Object.isFrozen(tx.target) && Object.isFrozen(tx.target.stats) && Object.isFrozen(tx.target.items));
  assert.throws(() => { tx.target.gold = 999999; }, TypeError);
  assert.throws(() => { tx.target.stats.level = 99; }, TypeError);
});

test('R-1 resume W2 path refuses when the Guard is ahead of Main (another tab moved on)', () => {
  const { b, id, tx } = savePending('W3'); // Main still the old save
  const m = parts(b, id).main;
  b.setItem(K(id, 'guard'), JSON.stringify(Save.seal({ characterId: id, revision: m.revision + 5, lastClaimedSeq: m.lastClaimedSeq, maxSeqIssued: m.nextRewardSeq - 1 })));
  const before = snapshot(b, id);
  const r = sys(b).resume(tx);
  assert.equal(r.ok, false); assert.equal(r.reason, 'GUARD_AHEAD');
  assert.deepEqual(snapshot(b, id), before);
});

/* ---------------- R-2 control characters ---------------- */

const controls = {
  'TAB U+0009': '\u0009', 'LF U+000A': '\u000A', 'VT U+000B': '\u000B', 'FF U+000C': '\u000C', 'CR U+000D': '\u000D',
  'NUL U+0000': '\u0000', 'ESC U+001B': '\u001B', 'DEL U+007F': '\u007F', 'NEL U+0085': '\u0085', 'CSI U+009B': '\u009B',
  'LINE SEPARATOR U+2028': ' ', 'PARAGRAPH SEPARATOR U+2029': ' '
};
for (const [label, ch] of Object.entries(controls)) {
  for (const [where, name] of [['middle', 'Ann' + ch + 'Bob'], ['start', ch + 'Ann'], ['end', 'Ann' + ch], ['only', ch]]) {
    test(`R-2 ${label} at ${where} is rejected as control (not turned into a space)`, () => {
      const r = Save.validateName(name);
      assert.equal(r.ok, false); assert.equal(r.reason, 'control'); assert.equal(r.value, undefined);
    });
  }
}

test('R-2 ordinary spaces are still tidied after the control check', () => {
  assert.equal(Save.validateName('  Ann   Bob  ').value, 'Ann Bob');
  assert.equal(Save.validateName('Ann Bob').value, 'Ann Bob', 'no-break space');
  assert.equal(Save.validateName('Ann　Bob').value, 'Ann Bob', 'ideographic space (Thai/Japanese keyboards)');
  assert.equal(Save.validateName('สม  ชาย').value, 'สม ชาย');
  assert.equal(Save.validateName('　  ').reason, 'empty');
});

test('R-2 a saved profile name containing a control character is an invalid save', () => {
  const b = memBackend(); const v = newChar(sys(b));
  const forged = Save.seal(Object.assign(JSON.parse(JSON.stringify(v)), { profile: Object.assign({}, v.profile, { name: 'Ann\u0009Bob' }) }));
  assert.equal(Save.validateSave(forged, v.characterId).reason, 'profile.name');
});

test('R-2 createCharacter refuses a name with a newline and writes nothing', () => {
  const b = memBackend();
  const r = sys(b).createCharacter({ name: 'Ann\nBob', gender: 'male', hairStyle: 0, hairColor: 0 }, H.RULES);
  assert.equal(r.reason, 'NAME_control'); assert.equal(b.length, 0);
});

/* ---------------- R-3 ZWJ and invisible characters ---------------- */

const invisible = {
  'ZERO WIDTH JOINER U+200D': '‍', 'ZERO WIDTH NON-JOINER U+200C': '‌', 'ZERO WIDTH SPACE U+200B': '​',
  'LRM U+200E': '‎', 'RLM U+200F': '‏', 'RLO U+202E': '‮', 'LRI U+2066': '⁦', 'PDI U+2069': '⁩',
  'WORD JOINER U+2060': '⁠', 'INVISIBLE TIMES U+2062': '⁢', 'SOFT HYPHEN U+00AD': '­',
  'COMBINING GRAPHEME JOINER U+034F': '͏', 'ARABIC LETTER MARK U+061C': '؜', 'MONGOLIAN VOWEL SEPARATOR U+180E': '᠎',
  'MONGOLIAN FVS1 U+180B': '᠋', 'HANGUL CHOSEONG FILLER U+115F': 'ᅟ', 'HANGUL FILLER U+3164': 'ㅤ',
  'HALFWIDTH HANGUL FILLER U+FFA0': 'ﾠ', 'KHMER VOWEL INHERENT AQ U+17B4': '឴', 'BRAILLE BLANK U+2800': '⠀',
  'VARIATION SELECTOR-16 U+FE0F': '️', 'VARIATION SELECTOR-1 U+FE00': '︀', 'BOM U+FEFF': '﻿',
  'INTERLINEAR ANCHOR U+FFF9': '￹', 'SHORTHAND FORMAT U+1BCA0': '\u{1BCA0}', 'MUSICAL INVISIBLE U+1D173': '\u{1D173}',
  'TAG LATIN A U+E0041': '\u{E0041}', 'CANCEL TAG U+E007F': '\u{E007F}', 'VS-17 U+E0100': '\u{E0100}'
};
for (const [label, ch] of Object.entries(invisible)) {
  test(`R-3 ${label} is rejected as invisible`, () => {
    for (const name of ['a' + ch + 'b', ch + 'Ann', 'Ann' + ch]) {
      const r = Save.validateName(name);
      assert.equal(r.ok, false, JSON.stringify(name)); assert.equal(r.reason, 'invisible', JSON.stringify(name));
    }
  });
}

test('R-3 emoji built with ZWJ or a variation selector are rejected; plain visible emoji are allowed', () => {
  assert.equal(Save.validateName('\u{1F468}‍\u{1F469}‍\u{1F467}').reason, 'invisible'); // family
  assert.equal(Save.validateName('\u{1F3F3}️‍\u{1F308}').reason, 'invisible');          // rainbow flag
  assert.equal(Save.validateName('❤️').reason, 'invisible');                            // red heart + VS16
  assert.equal(Save.validateName('\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}').reason, 'invisible'); // tag flag
  assert.equal(Save.validateName('❤').ok, true);
  assert.equal(Save.validateName('\u{1F44D}\u{1F3FD}').ok, true);
  assert.equal(Save.validateName('\u{1F1F9}\u{1F1ED}').ok, true);
});

test('R-3 Thai, accented Latin, CJK and Korean names are unaffected', () => {
  for (const n of ['สมชาย', 'น้ำใจ', 'ผู้ใหญ่', 'Zoë', '勇者', '용사'])
    assert.equal(Save.validateName(n).ok, true, n);
  assert.equal(Save.validateName('น้ำ').length, 1);
});

test('R-3 a stored name containing ZWJ makes the save invalid', () => {
  const b = memBackend(); const v = newChar(sys(b));
  const forged = Save.seal(Object.assign(JSON.parse(JSON.stringify(v)), { profile: Object.assign({}, v.profile, { name: 'a‍b' }) }));
  assert.equal(Save.validateSave(forged, v.characterId).reason, 'profile.name');
});
