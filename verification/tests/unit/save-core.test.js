// S1 unit tests: checksum, names, ids, validation. Run: node --test tests/unit
const test = require('node:test');
const assert = require('node:assert/strict');
const { Save, memBackend, sys, newChar, RULES, clock } = require('../lib/save-helpers');

/* ---------------- Checksum / canonical (CK) ---------------- */

test('CK-1 FNV-1a 32 test vectors', () => {
  assert.equal(Save.fnv1a32Hex(''), '811c9dc5');
  assert.equal(Save.fnv1a32Hex('a'), 'e40c292c');
  assert.equal(Save.fnv1a32Hex('foobar'), 'bf9cf968');
});

test('CK-1b UTF-8 encoding matches Node Buffer for Thai / emoji', () => {
  const ref = s => { let h = 0x811c9dc5; for (const b of Buffer.from(s, 'utf8')) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
  for (const s of ['สมชาย', 'น้ำใจ', '👨\u200D👩\u200D👧', '🇹🇭', 'é', 'Ünïcødé 勇者 용사']) assert.equal(Save.fnv1a32Hex(s), ref(s), s);
});

test('CK-2 key order does not change checksum (canonical form)', () => {
  assert.equal(Save.checksumOf({ a: 1, b: { y: 2, x: [3, 1] } }), Save.checksumOf({ b: { x: [3, 1], y: 2 }, a: 1 }));
  assert.notEqual(Save.checksumOf({ a: [1, 3] }), Save.checksumOf({ a: [3, 1] }), 'array order matters');
});

test('CK-3 changing one character makes the record invalid', () => {
  const b = memBackend(); const s = sys(b); const save = newChar(s);
  const k = `eldoria.char.${save.characterId}.main`;
  const tampered = b.getItem(k).replace('"gold":0', '"gold":1');
  assert.notEqual(tampered, b.getItem(k));
  assert.equal(Save.validateSave(JSON.parse(tampered), save.characterId).reason, 'checksum');
});

test('CK-4 the checksum field itself is excluded', () => {
  const o = { a: 1, checksum: 'x' };
  assert.equal(Save.checksumOf(o), Save.checksumOf({ a: 1, checksum: 'something else' }));
  assert.equal(Save.checksumOf(o), Save.checksumOf({ a: 1 }));
});

test('CK-5 contentKey ignores revision / savedAt / checksum', () => {
  const b = memBackend(); const s = sys(b); const save = newChar(s);
  const other = Save.seal(Object.assign({}, save, { revision: 99, savedAt: 'later' }));
  assert.equal(Save.contentKey(save), Save.contentKey(other));
  assert.notEqual(save.checksum, other.checksum);
});

test('canonical rejects values that would not round-trip', () => {
  for (const bad of [{ a: NaN }, { a: Infinity }, { a: -0 }, { a: undefined }, [undefined], { f() {} }]) assert.throws(() => Save.canonical(bad));
  assert.equal(Save.canonical({ b: 1, a: 'x' }), '{"a":"x","b":1}');
});

/* ---------------- Names (Thai / Unicode) ---------------- */

const count = s => Save.validateName(s).length;

test('NAME Thai: vowels and tone marks stay with their consonant', () => {
  assert.equal(count('สมชาย'), 5);
  assert.equal(count('น้ำ'), 1, 'น + ไม้โท + สระอำ = 1');
  assert.equal(count('กี่'), 1);
  assert.equal(count('เก่ง'), 3);
  assert.equal(count('ผู้ใหญ่'), 4);
  assert.equal(count('ปัญญา'), 4);
  assert.equal(count('น้ำใจ'), 3);
});

test('NAME 16 user-perceived characters allowed even with many marks; 17 rejected without cutting', () => {
  const ok16 = 'กี่'.repeat(16);
  const r = Save.validateName(ok16);
  assert.equal(r.ok, true); assert.equal(r.length, 16); assert.equal(r.value, ok16);
  const r17 = Save.validateName('ผู้'.repeat(17));
  assert.equal(r17.ok, false); assert.equal(r17.reason, 'tooLong'); assert.equal(r17.length, 17);
  assert.equal(r17.value, undefined, 'never returns a shortened name');
});

test('NAME rejects marks without a base character', () => {
  assert.equal(Save.validateName('\u0E34กา').reason, 'startsWithMark');
  assert.equal(Save.validateName('ำก').reason, 'startsWithMark');
  assert.equal(Save.validateName('ก \u0E49').reason, 'markAfterSpace');
  assert.equal(Save.validateName('a' + '\u0301'.repeat(70)).reason, 'tooLong', 'stacked marks are bounded');
});

test('NAME whitespace is trimmed and collapsed; invisible/control characters rejected', () => {
  assert.equal(Save.validateName('  สม   ชาย  ').value, 'สม ชาย');
  assert.equal(Save.validateName('   ').reason, 'empty');
  assert.equal(Save.validateName('\u200Bab').reason, 'invisible');
  assert.equal(Save.validateName('ab\u202E').reason, 'invisible');
  assert.equal(Save.validateName('a\u0007').reason, 'control');
  assert.equal(Save.validateName('\uE000x').reason, 'invalid');
  assert.equal(Save.validateName('\uD800a').reason, 'invalid');
  assert.equal(Save.validateName(42).reason, 'type');
});

test('NAME NFC normalisation and emoji clusters', () => {
  const r = Save.validateName('Jose\u0301');
  assert.equal(r.value, 'José'); assert.equal(r.length, 4);
  assert.equal(Save.validateName('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}').reason, 'invisible', 'ZWJ sequences are not allowed in names');
  assert.equal(Save.countGraphemes('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'), 1, 'the counter itself still treats it as one cluster');
  assert.equal(Save.validateName('\u{1F1F9}\u{1F1ED}').ok, true, 'flag allowed');
  assert.equal(Save.validateName('\u{1F44D}\u{1F3FD}').ok, true, 'skin-tone emoji allowed');
  assert.equal(count('🇹🇭'), 1);
  assert.equal(count('👍🏽'), 1);
  assert.equal(count('<b>&</b>'), 8, 'markup is plain text (UI uses textContent)');
});

test('NAME fallback counter (no Intl.Segmenter) agrees with Intl.Segmenter', () => {
  const corpus = ['สมชาย', 'น้ำใจ', 'ผู้ใหญ่', 'เก่งกล้า', 'ปัญญา', 'กี่ครั้ง', 'Zoë', 'José', 'Ängström', '勇者', 'ゆうしゃ', '용사', 'A🇹🇭B', '👨\u200D👩\u200D👧x', '👍🏽👍', 'ไก่ ไข่', 'ฤๅษี', 'ก็', 'นํ้า'];
  for (const s of corpus) assert.equal(Save._countGraphemesFallback(s.normalize('NFC')), Save.countGraphemes(s.normalize('NFC')), s);
});

/* ---------------- characterId (crypto only) ---------------- */

test('ID uses crypto.getRandomValues: 32 hex chars, unique', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) { const id = Save.newCharacterId(); assert.match(id, /^[0-9a-f]{32}$/); seen.add(id); }
  assert.equal(seen.size, 2000);
  let called = 0;
  const spy = { getRandomValues: a => { called++; return globalThis.crypto.getRandomValues(a); } };
  assert.match(Save.newCharacterId(spy), /^[0-9a-f]{32}$/); assert.equal(called, 1);
});

test('ID returns null without crypto (never falls back to Math.random)', () => {
  assert.equal(Save.newCharacterId(null), null);
  assert.equal(Save.newCharacterId({}), null);
  assert.equal(Save.newCharacterId({ getRandomValues() { throw new Error('nope'); } }), null);
  assert.equal(Save.newCharacterId({ getRandomValues: a => a }), null, 'all-zero output rejected');
});

test('ID creation stops safely without crypto: nothing written, Math.random untouched', () => {
  const b = memBackend();
  const s = Save.createSystem({ backend: b, crypto: null, now: clock() });
  const orig = Math.random; let used = false;
  Math.random = () => { used = true; return 0.5; };
  try {
    const r = s.createCharacter({ name: 'Ann', gender: 'female', hairStyle: 1, hairColor: 2 }, RULES);
    assert.equal(r.ok, false); assert.equal(r.reason, 'NO_SECURE_RANDOM');
  } finally { Math.random = orig; }
  assert.equal(used, false); assert.equal(b.length, 0);
});

/* ---------------- Validation ---------------- */

test('VAL initial save is valid and holds the original starting values', () => {
  const b = memBackend(); const save = newChar(sys(b));
  assert.equal(Save.validateSave(save, save.characterId).ok, true);
  assert.deepEqual(save.stats, { level: 1, exp: 0, hp: 50, maxHp: 50 });
  assert.deepEqual(save.world, { map: 'greenvale', c: 5, r: 5 });
  assert.equal(save.gold, 0); assert.deepEqual(save.items, { jelly: 0 });
  assert.equal(save.profile.job, 'novice'); assert.equal(save.deckId, 'starter'); assert.equal(save.status, 'ready');
  assert.equal(save.revision, 2, 'r1 creating -> r2 ready');
});

test('VAL rejects unknown fields, wrong types, other character id, bad pending owner', () => {
  const b = memBackend(); const save = newChar(sys(b));
  const bad = patch => { const o = JSON.parse(JSON.stringify(save)); patch(o); return Save.validateSave(Save.seal(o), save.characterId); };
  assert.equal(bad(o => { o.extra = 1; }).reason, 'keys');
  assert.equal(bad(o => { o.gold = 1.5; }).reason, 'gold');
  assert.equal(bad(o => { o.stats.hp = 51; }).reason, 'stats');
  assert.equal(bad(o => { o.world.c = -1; }).reason, 'world');
  assert.equal(bad(o => { o.profile.job = 'swordsman'; }).reason, 'profile.job');
  assert.equal(bad(o => { o.profile.name = ' padded '; }).reason, 'profile.name');
  assert.equal(bad(o => { o.characterId = 'f'.repeat(32); }).reason, 'characterIdMismatch');
  assert.equal(bad(o => { o.pendingReward = { seq: 1, characterId: 'a'.repeat(32), monsterId: 'poring', exp: 1, gold: 1, drops: [], createdAt: 'x' }; }).reason, 'pendingReward.characterId');
  assert.equal(bad(o => { o.schemaVersion = 2; }).reason, 'schemaVersion');
});

test('VAL guard: maxSeqIssued must be >= lastClaimedSeq (C1 / C7)', () => {
  const id = 'a'.repeat(32);
  assert.equal(Save.validateGuard(Save.seal({ characterId: id, revision: 3, lastClaimedSeq: 8, maxSeqIssued: 5 }), id).ok, false);
  assert.equal(Save.validateGuard(Save.seal({ characterId: id, revision: 3, lastClaimedSeq: 8, maxSeqIssued: 8 }), id).ok, true);
  assert.equal(Save.validateGuard(Save.seal({ characterId: id, revision: 3, lastClaimedSeq: 8, maxSeqIssued: 8 }), 'b'.repeat(32)).ok, false);
});

test('H9 Debug hooks are off in this build even with ?debug=save', () => {
  assert.equal(Save.DEBUG_SAVE_HOOKS, false);
  const prev = globalThis.location;
  globalThis.location = { search: '?debug=save' };
  try { assert.equal(Save.debugHooksFromLocation(), null); } finally { if (prev === undefined) delete globalThis.location; else globalThis.location = prev; }
});

test('probe: works on normal storage, false when storage throws; probe key cleaned up', () => {
  const b = memBackend();
  assert.equal(sys(b).probe(), true); assert.equal(b.length, 0);
  assert.equal(sys(memBackend({ throwOnSet: true })).probe(), false);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {}, key() { return null; }, length: 0 };
  assert.equal(sys(broken).probe(), false);
});


/* ---------------- Extensible inventory items ---------------- */

test('INV-1 save validation accepts new monster material IDs without changing legacy jelly saves', () => {
  const b = memBackend(); const save = newChar(sys(b));
  assert.deepEqual(save.items, { jelly: 0 }, 'legacy/new character baseline remains compatible');
  const withMaterials = Save.seal(Object.assign({}, save, { items: { jelly: 2, wolf_fang: 3, ancient_fang: 1 } }));
  assert.equal(Save.validateSave(withMaterials, save.characterId).ok, true);
});

test('INV-2 inventory rejects unsafe item IDs and invalid counts', () => {
  const b = memBackend(); const save = newChar(sys(b));
  const badId = Save.seal(Object.assign({}, save, { items: { jelly: 0, '../gold': 1 } }));
  const badCount = Save.seal(Object.assign({}, save, { items: { jelly: 0, wolf_fang: -1 } }));
  const badType = Save.seal(Object.assign({}, save, { items: { jelly: 0, ancient_fang: 1.5 } }));
  assert.equal(Save.validateSave(badId, save.characterId).reason, 'items');
  assert.equal(Save.validateSave(badCount, save.characterId).reason, 'items');
  assert.equal(Save.validateSave(badType, save.characterId).reason, 'items');
});

test('INV-3 pending rewards retain and claim Wolf materials exactly once', () => {
  const b = memBackend(); const s = sys(b); const save = newChar(s);
  const pendingReward = Save.withPendingReward(save, {
    exp: 22, gold: 12, drops: [{ id: 'wolf_fang', name: 'Wolf Fang' }]
  }, 'forest_wolf', '2026-11-08T00:00:00.000Z');
  assert.equal(pendingReward.ok, true);
  const staged = s.commit(save, pendingReward.save);
  assert.equal(staged.ok, true);
  const claimResult = Save.withClaim(staged.save, (target, reward) => {
    reward.drops.forEach(drop => { target.items[drop.id] = (target.items[drop.id] || 0) + 1; });
  });
  assert.equal(claimResult.ok, true);
  assert.equal(claimResult.save.items.wolf_fang, 1);
  assert.equal(claimResult.save.pendingReward, null);
  assert.equal(Save.withClaim(claimResult.save, () => {}).reason, 'NO_PENDING');
});
