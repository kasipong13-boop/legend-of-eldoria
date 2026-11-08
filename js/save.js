/* Legend of Eldoria - Prototype 0.2
   save.js: character-specific saves with Main / Backup / Guard records and recovery.

   - No DOM here. Runs in the browser (window.ELDORIA.Save) and in Node (module.exports) for tests.
   - Every write is read back and compared before the next step runs.
   - The checksum (FNV-1a 32-bit) only detects accidental corruption. It is NOT a security feature.
   - Nothing in this file deletes save data on its own. "Discard" moves records aside and needs
     an explicit confirmation from the player.

   Storage keys (localStorage):
     eldoria.index                              order of characters (a cache; can be rebuilt)
     eldoria.char.<id>.main | backup | guard    one character
     eldoria.discarded.<id>.<stamp>.<part>      records the player chose to discard (never read back)
     eldoria.probe                              temporary key used to test that storage works
*/
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};

  // Delivered build: false. When true AND the page URL has ?debug=save, testers can simulate
  // failures at each save step. Ordinary players never get this.
  var DEBUG_SAVE_HOOKS = false;

  var SCHEMA_VERSION = 1;
  var CHAR_PREFIX = 'eldoria.char.';
  var DISCARD_PREFIX = 'eldoria.discarded.';
  var INDEX_KEY = 'eldoria.index';
  var PROBE_KEY = 'eldoria.probe';
  var ID_RE = /^[0-9a-f]{32}$/;
  var CHAR_KEY_RE = /^eldoria\.char\.([0-9a-f]{32})\.(main|backup|guard)$/;

  var GENDERS = ['male', 'female'];
  var HAIR_STYLE_COUNT = 6;
  var HAIR_COLOR_COUNT = 8;
  var NAME_MIN = 1, NAME_MAX = 16, NAME_MAX_CODEPOINTS = 64;
  var CLAIM_HISTORY = 10;
  var MAX_INT = 1000000000;

  /* ------------------------------------------------------------------ errors */

  // Thrown only by debug/test hooks to simulate the app closing right after a step.
  function SaveHalt(step) { this.name = 'SaveHalt'; this.step = step; this.message = 'Simulated app close after ' + step; }
  SaveHalt.prototype = Object.create(Error.prototype);
  SaveHalt.prototype.constructor = SaveHalt;

  /* ------------------------------------------------------- canonical + checksum */

  // Canonical JSON: no spaces, object keys sorted (UTF-16 code unit order) at every level,
  // arrays keep their order. Rejects values that do not survive a JSON round trip.
  function canonical(v) {
    if (v === null) return 'null';
    var t = typeof v;
    if (t === 'string') return JSON.stringify(v);
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'number') {
      if (!isFinite(v)) throw new Error('canonical: non-finite number');
      if (v === 0 && 1 / v < 0) throw new Error('canonical: negative zero');
      return JSON.stringify(v);
    }
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (t === 'object') {
      var keys = Object.keys(v).sort();
      var out = [];
      for (var i = 0; i < keys.length; i++) {
        if (v[keys[i]] === undefined) throw new Error('canonical: undefined value at ' + keys[i]);
        out.push(JSON.stringify(keys[i]) + ':' + canonical(v[keys[i]]));
      }
      return '{' + out.join(',') + '}';
    }
    throw new Error('canonical: unsupported type ' + t);
  }

  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
        else c = 0xFFFD;
      } else if (c >= 0xD800 && c <= 0xDFFF) c = 0xFFFD;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function fnv1a32Hex(str) {
    var b = utf8Bytes(str), h = 0x811c9dc5;
    for (var i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function without(obj, keys) {
    var o = {};
    Object.keys(obj).forEach(function (k) { if (keys.indexOf(k) < 0) o[k] = obj[k]; });
    return o;
  }
  // The record's own "checksum" field is never part of its checksum.
  function checksumOf(obj) { return 'fnv1a32:' + fnv1a32Hex(canonical(without(obj, ['checksum']))); }
  // Used to decide whether recovery changed the content (revision/savedAt/checksum ignored).
  function contentKey(save) { return canonical(without(save, ['checksum', 'revision', 'savedAt'])); }
  function seal(obj) { var o = without(obj, ['checksum']); o.checksum = checksumOf(o); return o; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ------------------------------------------------------------------ names */

  var segmenter = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
  } catch (e) { segmenter = null; }

  var markRe = null;
  try { markRe = new RegExp('^\\p{M}$', 'u'); } catch (e) { markRe = null; } // older engines: use ranges below

  function codePoints(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { out.push(0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00)); i++; continue; }
      }
      out.push(c);
    }
    return out;
  }

  function isMark(cp) {
    if (markRe) return markRe.test(String.fromCodePoint(cp));
    return (cp >= 0x0300 && cp <= 0x036F) || cp === 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E3A) ||
      (cp >= 0x0E47 && cp <= 0x0E4E) || (cp >= 0x1AB0 && cp <= 0x1AFF) || (cp >= 0x1DC0 && cp <= 0x1DFF) ||
      (cp >= 0x20D0 && cp <= 0x20FF) || (cp >= 0xFE20 && cp <= 0xFE2F);
  }
  // Thai SARA AM (U+0E33) is a spacing mark that stays in the same cluster as its consonant.
  function joinsPrevious(cp) {
    return isMark(cp) || cp === 0x0E33 || cp === 0x200D || (cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0x1F3FB && cp <= 0x1F3FF) || (cp >= 0xE0020 && cp <= 0xE007F);
  }

  // Counts user-perceived characters. A consonant with its vowel and tone marks counts as one.
  // Used only when Intl.Segmenter is missing (older browsers). Covers Thai, combining marks,
  // emoji modifiers, ZWJ sequences and flag pairs.
  function countGraphemesFallback(s) {
    var cps = codePoints(s), n = 0, prevZwj = false, riOpen = false;
    for (var i = 0; i < cps.length; i++) {
      var cp = cps[i], isRI = cp >= 0x1F1E6 && cp <= 0x1F1FF;
      var joins = i > 0 && (joinsPrevious(cp) || prevZwj);
      if (isRI) {
        if (riOpen) { joins = true; riOpen = false; } // second half of a flag
        else riOpen = true;
      } else riOpen = false;
      if (!joins) n++;
      prevZwj = cp === 0x200D;
    }
    return n;
  }
  function countGraphemes(s) {
    if (segmenter) { var n = 0, it = segmenter.segment(s)[Symbol.iterator](); while (!it.next().done) n++; return n; }
    return countGraphemesFallback(s);
  }

  // Characters a name may not contain at all.
  //  control   : C0/C1 controls (Tab, Newline, CR, NEL ...) and line/paragraph separators.
  //              They are rejected, never turned into spaces.
  //  invisible : characters that draw nothing or change how other text is shown, including
  //              Zero Width Joiner U+200D (so emoji joined with ZWJ are not allowed in names),
  //              variation selectors, bidi controls, fillers and tag characters.
  //  invalid   : lone surrogates, private use, noncharacters.
  function isForbiddenCodePoint(cp) {
    if (cp < 0x20 || (cp >= 0x7F && cp <= 0x9F) || cp === 0x2028 || cp === 0x2029) return 'control';
    if (cp >= 0xD800 && cp <= 0xDFFF) return 'invalid';
    if ((cp >= 0xE000 && cp <= 0xF8FF) || cp >= 0xF0000) return 'invalid';
    if ((cp & 0xFFFE) === 0xFFFE || (cp >= 0xFDD0 && cp <= 0xFDEF)) return 'invalid';
    if (cp === 0x00AD ||                      // soft hyphen
        cp === 0x034F ||                      // combining grapheme joiner
        cp === 0x061C ||                      // Arabic letter mark
        cp === 0x115F || cp === 0x1160 ||     // Hangul choseong / jungseong fillers
        cp === 0x17B4 || cp === 0x17B5 ||     // Khmer inherent vowels (invisible)
        (cp >= 0x180B && cp <= 0x180F) ||     // Mongolian variation selectors / vowel separator
        (cp >= 0x200B && cp <= 0x200F) ||     // ZWSP, ZWNJ, ZWJ, LRM, RLM
        (cp >= 0x202A && cp <= 0x202E) ||     // bidi embedding / override
        (cp >= 0x2060 && cp <= 0x206F) ||     // word joiner, invisible operators, bidi isolates
        cp === 0x2800 ||                      // braille blank
        cp === 0x3164 || cp === 0xFFA0 ||     // Hangul fillers
        (cp >= 0xFE00 && cp <= 0xFE0F) ||     // variation selectors
        cp === 0xFEFF ||                      // byte order mark / zero width no-break space
        (cp >= 0xFFF0 && cp <= 0xFFFB) ||     // interlinear annotation and reserved specials
        (cp >= 0x1BCA0 && cp <= 0x1BCA3) ||   // shorthand format controls
        (cp >= 0x1D173 && cp <= 0x1D17A) ||   // musical invisible formatting
        (cp >= 0xE0000 && cp <= 0xE007F) ||   // tag characters
        (cp >= 0xE0100 && cp <= 0xE01EF)) return 'invisible'; // variation selectors supplement
    return null;
  }
  function firstForbidden(s) {
    var cps = codePoints(s);
    for (var i = 0; i < cps.length; i++) { var bad = isForbiddenCodePoint(cps[i]); if (bad) return bad; }
    return null;
  }

  // Ordinary spaces of any width (U+0020, no-break space, ideographic space ...) count as one space.
  var SPACES_RE = /[    -   　]+/g;

  // Never shortens a name: a name that is too long is rejected so no vowel or tone mark is cut off.
  function validateName(raw) {
    if (typeof raw !== 'string') return { ok: false, reason: 'type', length: 0 };
    // 1. Reject forbidden characters in the text exactly as typed, before any clean-up.
    var bad = firstForbidden(raw);
    if (bad) return { ok: false, reason: bad, length: countGraphemes(raw) };
    // 2. Unicode normalisation (NFC) and a second check of its result.
    var s = raw;
    try { if (s.normalize) s = s.normalize('NFC'); } catch (e) { /* keep as is */ }
    bad = firstForbidden(s);
    if (bad) return { ok: false, reason: bad, length: countGraphemes(s) };
    // 3. Only now tidy ordinary spaces: collapse runs to one space and trim the ends.
    s = s.replace(SPACES_RE, ' ').replace(/^ | $/g, '');
    if (!s) return { ok: false, reason: 'empty', length: 0 };
    var cps = codePoints(s);
    if (cps.length > NAME_MAX_CODEPOINTS) return { ok: false, reason: 'tooLong', length: countGraphemes(s) };
    if (joinsPrevious(cps[0])) return { ok: false, reason: 'startsWithMark', length: countGraphemes(s) };
    for (var j = 1; j < cps.length; j++) {
      if (cps[j - 1] === 0x20 && joinsPrevious(cps[j])) return { ok: false, reason: 'markAfterSpace', length: countGraphemes(s) };
    }
    var len = countGraphemes(s);
    if (len < NAME_MIN) return { ok: false, reason: 'empty', length: len };
    if (len > NAME_MAX) return { ok: false, reason: 'tooLong', length: len };
    return { ok: true, value: s, length: len };
  }

  /* ------------------------------------------------------------- validation */

  function isInt(n, min, max) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n &&
      n >= (min === undefined ? -MAX_INT : min) && n <= (max === undefined ? MAX_INT : max);
  }
  function isStr(s, maxLen) { return typeof s === 'string' && s.length <= (maxLen || 64); }
  function hasExactKeys(o, keys) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    var k = Object.keys(o).sort(), e = keys.slice().sort();
    if (k.length !== e.length) return false;
    for (var i = 0; i < k.length; i++) if (k[i] !== e[i]) return false;
    return true;
  }

  var SAVE_KEYS = ['schemaVersion', 'characterId', 'revision', 'savedAt', 'status', 'profile', 'stats', 'gold',
    'items', 'world', 'deckId', 'pendingReward', 'nextRewardSeq', 'lastClaimedSeq', 'claimedRewardIds', 'checksum'];
  var PENDING_KEYS = ['seq', 'characterId', 'monsterId', 'exp', 'gold', 'drops', 'createdAt'];
  var GUARD_KEYS = ['characterId', 'revision', 'lastClaimedSeq', 'maxSeqIssued', 'checksum'];
  var INDEX_KEYS = ['schemaVersion', 'revision', 'order', 'checksum'];

  function validatePending(p, characterId) {
    if (!hasExactKeys(p, PENDING_KEYS)) return 'keys';
    if (!isInt(p.seq, 1)) return 'seq';
    if (p.characterId !== characterId) return 'characterId';
    if (!isStr(p.monsterId, 40) || !p.monsterId) return 'monsterId';
    if (!isInt(p.exp, 0) || !isInt(p.gold, 0)) return 'amount';
    if (!Array.isArray(p.drops) || p.drops.length > 10) return 'drops';
    for (var i = 0; i < p.drops.length; i++) {
      var d = p.drops[i];
      if (!hasExactKeys(d, ['id', 'name']) || !isStr(d.id, 40) || !d.id || !isStr(d.name, 60)) return 'drops';
    }
    if (!isStr(p.createdAt, 40)) return 'createdAt';
    return null;
  }

  function validateSaveInner(o, expectId) {
    if (!hasExactKeys(o, SAVE_KEYS)) return 'keys';
    if (o.schemaVersion !== SCHEMA_VERSION) return 'schemaVersion';
    if (typeof o.characterId !== 'string' || !ID_RE.test(o.characterId)) return 'characterId';
    if (expectId && o.characterId !== expectId) return 'characterIdMismatch';
    if (!isInt(o.revision, 1)) return 'revision';
    if (!isStr(o.savedAt, 40)) return 'savedAt';
    if (o.status !== 'creating' && o.status !== 'ready') return 'status';
    var p = o.profile;
    if (!hasExactKeys(p, ['name', 'gender', 'hairStyle', 'hairColor', 'job', 'createdAt'])) return 'profile';
    var nv = validateName(p.name);
    if (!nv.ok || nv.value !== p.name) return 'profile.name';
    if (GENDERS.indexOf(p.gender) < 0) return 'profile.gender';
    if (!isInt(p.hairStyle, 0, HAIR_STYLE_COUNT - 1)) return 'profile.hairStyle';
    if (!isInt(p.hairColor, 0, HAIR_COLOR_COUNT - 1)) return 'profile.hairColor';
    if (p.job !== 'novice') return 'profile.job';
    if (!isStr(p.createdAt, 40)) return 'profile.createdAt';
    var s = o.stats;
    if (!hasExactKeys(s, ['level', 'exp', 'hp', 'maxHp'])) return 'stats';
    if (!isInt(s.level, 1) || !isInt(s.exp, 0) || !isInt(s.maxHp, 1) || !isInt(s.hp, 0, s.maxHp)) return 'stats';
    if (!isInt(o.gold, 0)) return 'gold';
    if (!hasExactKeys(o.items, ['jelly']) || !isInt(o.items.jelly, 0)) return 'items';
    var w = o.world;
    if (!hasExactKeys(w, ['map', 'c', 'r']) || (w.map !== 'greenvale' && w.map !== 'whispering_forest') || !isInt(w.c, 0, 999) || !isInt(w.r, 0, 999)) return 'world';
    if (o.deckId !== 'starter') return 'deckId';
    if (!isInt(o.nextRewardSeq, 1) || !isInt(o.lastClaimedSeq, 0)) return 'rewardSeq';
    var ids = o.claimedRewardIds;
    if (!Array.isArray(ids) || ids.length > CLAIM_HISTORY) return 'claimedRewardIds';
    for (var i = 0; i < ids.length; i++) if (!isInt(ids[i], 1)) return 'claimedRewardIds';
    if (o.pendingReward !== null) { var pr = validatePending(o.pendingReward, o.characterId); if (pr) return 'pendingReward.' + pr; }
    if (typeof o.checksum !== 'string' || o.checksum !== checksumOf(o)) return 'checksum';
    return null;
  }
  function validateSave(o, expectId) {
    try { var r = validateSaveInner(o, expectId); return r ? { ok: false, reason: r } : { ok: true }; }
    catch (e) { return { ok: false, reason: 'exception' }; }
  }

  function validateGuard(g, expectId) {
    try {
      if (!hasExactKeys(g, GUARD_KEYS)) return { ok: false, reason: 'keys' };
      if (typeof g.characterId !== 'string' || !ID_RE.test(g.characterId) || (expectId && g.characterId !== expectId)) return { ok: false, reason: 'characterId' };
      if (!isInt(g.revision, 1) || !isInt(g.lastClaimedSeq, 0) || !isInt(g.maxSeqIssued, 0)) return { ok: false, reason: 'fields' };
      if (g.maxSeqIssued < g.lastClaimedSeq) return { ok: false, reason: 'maxSeqIssued<lastClaimedSeq' };
      if (g.checksum !== checksumOf(g)) return { ok: false, reason: 'checksum' };
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'exception' }; }
  }

  function validateIndex(x) {
    try {
      if (!hasExactKeys(x, INDEX_KEYS) || x.schemaVersion !== SCHEMA_VERSION || !isInt(x.revision, 1)) return { ok: false, reason: 'fields' };
      if (!Array.isArray(x.order) || x.order.length > 100000) return { ok: false, reason: 'order' };
      var seen = {};
      for (var i = 0; i < x.order.length; i++) {
        var id = x.order[i];
        if (typeof id !== 'string' || !ID_RE.test(id) || seen[id]) return { ok: false, reason: 'order' };
        seen[id] = true;
      }
      if (x.checksum !== checksumOf(x)) return { ok: false, reason: 'checksum' };
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'exception' }; }
  }

  /* -------------------------------------------------------- ids + new saves */

  // Uses crypto.getRandomValues only. Returns null (creation stops safely) when it is unavailable.
  function newCharacterId(cryptoSource) {
    var c = cryptoSource === undefined ? (root.crypto || null) : cryptoSource;
    if (!c || typeof c.getRandomValues !== 'function') return null;
    var b = new Uint8Array(16);
    try { c.getRandomValues(b); } catch (e) { return null; }
    var hex = '';
    for (var i = 0; i < b.length; i++) hex += ('0' + b[i].toString(16)).slice(-2);
    if (!ID_RE.test(hex) || /^0+$/.test(hex)) return null;
    return hex;
  }

  function validateAppearance(input) {
    if (!input || GENDERS.indexOf(input.gender) < 0) return 'gender';
    if (!isInt(input.hairStyle, 0, HAIR_STYLE_COUNT - 1)) return 'hairStyle';
    if (!isInt(input.hairColor, 0, HAIR_COLOR_COUNT - 1)) return 'hairColor';
    return null;
  }

  // rules: { maxHp, start: {c, r} } come from data.js / world.js so this file holds no game numbers.
  function makeInitialSave(id, profile, rules, nowIso) {
    return seal({
      schemaVersion: SCHEMA_VERSION, characterId: id, revision: 1, savedAt: nowIso, status: 'creating',
      profile: { name: profile.name, gender: profile.gender, hairStyle: profile.hairStyle, hairColor: profile.hairColor, job: 'novice', createdAt: nowIso },
      stats: { level: 1, exp: 0, hp: rules.maxHp, maxHp: rules.maxHp },
      gold: 0, items: { jelly: 0 },
      world: { map: 'greenvale', c: rules.start.c, r: rules.start.r },
      deckId: 'starter', pendingReward: null,
      nextRewardSeq: 1, lastClaimedSeq: 0, claimedRewardIds: []
    });
  }

  /* ------------------------------------------------- pure state transforms */
  // These return new content. Nothing is stored until it goes through commit().

  function withPendingReward(save, reward, monsterId, nowIso) {
    if (save.status !== 'ready') return { ok: false, reason: 'NOT_READY' };
    if (save.pendingReward) return { ok: false, reason: 'PENDING_EXISTS' };
    var n = clone(save);
    n.pendingReward = {
      seq: save.nextRewardSeq, characterId: save.characterId, monsterId: String(monsterId),
      exp: reward.exp, gold: reward.gold,
      drops: (reward.drops || []).map(function (d) { return { id: String(d.id), name: String(d.name) }; }),
      createdAt: nowIso
    };
    n.nextRewardSeq = save.nextRewardSeq + 1;
    return { ok: true, save: n };
  }

  // applyFn(newSave, reward) adds EXP / Gold / items / level-ups / HP using the game's own rules.
  function withClaim(save, applyFn) {
    var p = save.pendingReward;
    if (save.status !== 'ready') return { ok: false, reason: 'NOT_READY' };
    if (!p) return { ok: false, reason: 'NO_PENDING' };
    if (p.characterId !== save.characterId) return { ok: false, reason: 'WRONG_CHARACTER' };
    if (p.seq <= save.lastClaimedSeq) return { ok: false, reason: 'ALREADY_CLAIMED' };
    var n = clone(save);
    applyFn(n, clone(p));
    n.pendingReward = null;
    n.lastClaimedSeq = p.seq;
    n.claimedRewardIds = save.claimedRewardIds.concat([p.seq]).slice(-CLAIM_HISTORY);
    return { ok: true, save: n, reward: clone(p) };
  }

  /* ------------------------------------------------------------ the system */

  function key(id, part) { return CHAR_PREFIX + id + '.' + part; }

  function guardFor(save) {
    return seal({ characterId: save.characterId, revision: save.revision, lastClaimedSeq: save.lastClaimedSeq, maxSeqIssued: save.nextRewardSeq - 1 });
  }

  function createSystem(opts) {
    opts = opts || {};
    var backend = opts.backend;
    var now = opts.now || function () { return new Date().toISOString(); };
    var cryptoSource = opts.crypto; // undefined -> global crypto
    var hooks = opts.hooks || null;

    function actionFor(step) { return hooks && typeof hooks.actionFor === 'function' ? hooks.actionFor(step) : null; }
    function haltCheck(step) { if (hooks && typeof hooks.haltAfter === 'function' && hooks.haltAfter(step)) throw new SaveHalt(step); }

    function raw(k) {
      try { var v = backend.getItem(k); return v === undefined ? null : v; } catch (e) { return null; }
    }
    // Writes, then reads back and compares. Returns true only when the stored text is exactly what was written.
    function write(k, value, step) {
      var a = actionFor(step);
      if (a !== 'fail') {
        try { backend.setItem(k, a === 'corrupt' ? value.slice(0, Math.max(1, value.length >> 1)) : value); }
        catch (e) { haltCheck(step); return false; }
      }
      var ok = a !== 'fail' && raw(k) === value;
      haltCheck(step);
      return ok;
    }
    function remove(k) { try { backend.removeItem(k); } catch (e) { /* checked by caller */ } return raw(k) === null; }

    function allKeys() {
      var out = [], n = 0;
      try { n = backend.length; } catch (e) { n = 0; }
      for (var i = 0; i < n; i++) { try { var k = backend.key(i); if (typeof k === 'string') out.push(k); } catch (e) { /* skip */ } }
      return out;
    }

    function readPart(id, part) {
      var s = raw(key(id, part));
      if (s === null) return { present: false, valid: false, raw: null, obj: null, reason: 'missing' };
      var obj = null;
      try { obj = JSON.parse(s); } catch (e) { return { present: true, valid: false, raw: s, obj: null, reason: 'json' }; }
      var v = part === 'guard' ? validateGuard(obj, id) : validateSave(obj, id);
      return { present: true, valid: v.ok, raw: s, obj: v.ok ? obj : null, reason: v.ok ? null : v.reason };
    }
    function guardMatches(G, save) {
      return G.valid && G.obj.revision === save.revision && G.obj.lastClaimedSeq === save.lastClaimedSeq && G.obj.maxSeqIssued === save.nextRewardSeq - 1;
    }

    function probe() {
      try {
        backend.setItem(PROBE_KEY, '1');
        var ok = backend.getItem(PROBE_KEY) === '1';
        backend.removeItem(PROBE_KEY);
        return ok;
      } catch (e) { return false; }
    }

    /* ---------- commit: the 5-step write (W1 check, W2 old->Backup, W3 new Main, W4 new Backup, W5 Guard) */

    function runFrom(id, oldRaw, target, oldChecksum, oldRevision, fromStep) {
      var tRaw = JSON.stringify(target);
      var tx = { characterId: id, target: target, oldChecksum: oldChecksum, oldRevision: oldRevision };
      function fail(stage, durable) { return { ok: false, durable: durable, stage: stage, reason: 'WRITE_FAILED', tx: tx }; }
      if (fromStep === 'W2') {
        if (!write(key(id, 'backup'), oldRaw, 'W2')) return fail('W2', false);
        if (!write(key(id, 'main'), tRaw, 'W3')) return fail('W3', false);
      }
      // Durable Commit reached: Main holds the new data.
      if (!write(key(id, 'backup'), tRaw, 'W4')) return fail('W4', true);
      if (!write(key(id, 'guard'), JSON.stringify(guardFor(target)), 'W5')) return fail('W5', true);
      // Full Commit: only now may the game tell the player that saving succeeded.
      return { ok: true, durable: true, full: true, save: target };
    }

    function checkInvariants(s) {
      if (!(s.nextRewardSeq > s.lastClaimedSeq)) return false;
      if (s.pendingReward && !(s.pendingReward.seq > s.lastClaimedSeq && s.pendingReward.seq < s.nextRewardSeq)) return false;
      return true;
    }

    // A commit/resume target must be a complete, sealed, consistent save for this character,
    // exactly one revision after the save it replaces.
    function checkTarget(target, id, oldRevision) {
      if (!target || typeof target !== 'object') return 'missing';
      var v = validateSave(target, id); // schema, every field, characterId, checksum
      if (!v.ok) return v.reason;
      if (!checkInvariants(target)) return 'invariant';
      if (target.revision !== oldRevision + 1) return 'revision';
      return null;
    }

    function guardAhead(id, mainObj) {
      var G = readPart(id, 'guard');
      return G.valid && (G.obj.revision > mainObj.revision || G.obj.lastClaimedSeq > mainObj.lastClaimedSeq || G.obj.maxSeqIssued > mainObj.nextRewardSeq - 1);
    }

    function deepFreeze(o) {
      if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); }
      return o;
    }

    function commit(oldSave, newContent) {
      var id = oldSave && oldSave.characterId;
      if (!id || !ID_RE.test(id)) return { ok: false, durable: false, stage: 'W1', reason: 'BAD_ARGUMENT' };
      var M = readPart(id, 'main');
      if (!M.valid) return { ok: false, durable: false, stage: 'W1', reason: 'MAIN_INVALID' };
      if (M.obj.checksum !== oldSave.checksum || M.obj.revision !== oldSave.revision) return { ok: false, durable: false, stage: 'W1', reason: 'STALE' };
      if (guardAhead(id, M.obj)) return { ok: false, durable: false, stage: 'W1', reason: 'GUARD_AHEAD' };
      var target = clone(newContent);
      target.characterId = id;
      target.revision = oldSave.revision + 1;
      target.savedAt = now();
      target = seal(target);
      var v = validateSave(target, id);
      if (!v.ok) return { ok: false, durable: false, stage: 'W1', reason: 'INVALID_TARGET:' + v.reason };
      if (!checkInvariants(target)) return { ok: false, durable: false, stage: 'W1', reason: 'INVARIANT' };
      // Frozen so the target kept in a failed transaction cannot be changed before Resume.
      return runFrom(id, M.raw, deepFreeze(target), oldSave.checksum, oldSave.revision, 'W2');
    }

    // Retry = Resume. Never recomputes the reward: it finishes writing the same target.
    // The target is checked again in full before anything is written, so a transaction object
    // that was altered after the failed commit is refused. (The checksum detects accidental
    // change only; it is not protection against someone deliberately editing data.)
    function resume(tx) {
      function refuse(reason) { return { ok: false, durable: false, stage: 'RESUME', reason: reason }; }
      if (!tx || typeof tx !== 'object' || !tx.target) return refuse('BAD_ARGUMENT');
      var id = tx.characterId;
      if (typeof id !== 'string' || !ID_RE.test(id)) return refuse('INVALID_TX:characterId');
      if (!isInt(tx.oldRevision, 1) || typeof tx.oldChecksum !== 'string') return refuse('INVALID_TX:old');
      var target;
      try { target = clone(tx.target); } catch (e) { return refuse('INVALID_TX:target'); }
      var bad = checkTarget(target, id, tx.oldRevision);
      if (bad) return refuse('INVALID_TX:' + bad);
      deepFreeze(target);
      var tRaw = JSON.stringify(target);
      var M = readPart(id, 'main');
      if (M.valid && M.raw === tRaw) return runFrom(id, null, target, tx.oldChecksum, tx.oldRevision, 'W4');
      if (M.valid && M.obj.checksum === tx.oldChecksum && M.obj.revision === tx.oldRevision) {
        if (guardAhead(id, M.obj)) return refuse('GUARD_AHEAD');
        return runFrom(id, M.raw, target, tx.oldChecksum, tx.oldRevision, 'W2');
      }
      var rec = recover(id);
      if (rec.status !== 'ok') return { ok: false, durable: false, stage: 'RESUME', reason: 'RECOVERY_' + rec.status, recovery: rec };
      if (contentKey(rec.save) === contentKey(target)) return { ok: true, durable: true, full: true, save: rec.save, recovered: true, recovery: rec };
      if (rec.save.checksum === tx.oldChecksum) {
        var again = commit(rec.save, without(target, ['checksum']));
        again.recovery = rec;
        return again;
      }
      // Disk moved on to something else: the caller must reload rec.save (nothing is applied twice).
      return { ok: false, durable: false, stage: 'RESUME', reason: 'DIVERGED', recovery: rec };
    }

    /* ---------- recovery for one character */

    function recover(id) {
      var M = readPart(id, 'main'), B = readPart(id, 'backup'), G = readPart(id, 'guard');
      var parts = { main: M.reason, backup: B.reason, guard: G.reason };
      if (!M.present && !B.present && !G.present) return { status: 'missing', parts: parts };
      var S = null;
      if (M.valid) S = { part: 'main', rec: M };
      if (B.valid && (!S || B.obj.revision > S.rec.obj.revision)) S = { part: 'backup', rec: B };
      if (!S) return { status: 'damaged', parts: parts };

      var s = S.rec.obj, gv = G.valid ? G.obj : null, notices = [];
      if (!gv) notices.push(G.present ? 'guardInvalid' : 'guardMissing');
      if (S.part === 'backup') notices.push('restoredFromBackup');
      if (gv && gv.revision < s.revision) notices.push('rolledForward');

      // floor, Pending, Reward sequence (plan 7.3)
      var floor = Math.max(s.lastClaimedSeq, gv ? gv.lastClaimedSeq : 0);
      var n = clone(s);
      if (n.pendingReward && n.pendingReward.seq <= floor) { n.pendingReward = null; notices.push('droppedClaimedPending'); }
      n.lastClaimedSeq = floor;
      var maxSeqIssued = gv ? gv.maxSeqIssued : s.nextRewardSeq - 1;
      var next = Math.max(s.nextRewardSeq, maxSeqIssued + 1);
      if (!(next > floor) || (n.pendingReward && !(next > n.pendingReward.seq))) {
        next = Math.max(next, floor + 1, n.pendingReward ? n.pendingReward.seq + 1 : 0);
      }
      n.nextRewardSeq = next;

      var contentChanged = contentKey(n) !== contentKey(s);
      var rolledBack = !!gv && gv.revision > s.revision;
      if (rolledBack) notices.push('restoredOlderCopy');
      function incomplete(stage) { return { status: 'incomplete', stage: stage, parts: parts, notices: notices }; }

      if (contentChanged || rolledBack) {
        // New revision, written with the source preserved first (plan 7.5.1, RS1-RS7).
        var revs = [s.revision];
        if (M.valid) revs.push(M.obj.revision);
        if (B.valid) revs.push(B.obj.revision);
        if (gv) revs.push(gv.revision);
        n.revision = Math.max.apply(null, revs) + 1;
        n.savedAt = now();
        n = seal(n);
        if (!validateSave(n, id).ok || !checkInvariants(n)) return incomplete('RS3');
        var nRaw = JSON.stringify(n);
        if (!(B.valid && B.raw === S.rec.raw)) { if (!write(key(id, 'backup'), S.rec.raw, 'RS2')) return incomplete('RS2'); }
        if (!write(key(id, 'main'), nRaw, 'RS4')) return incomplete('RS4');
        if (!write(key(id, 'backup'), nRaw, 'RS5')) return incomplete('RS5');
        if (!write(key(id, 'guard'), JSON.stringify(guardFor(n)), 'RS6')) return incomplete('RS6');
        notices.push('newRevision');
        return { status: 'ok', save: n, repaired: true, notices: notices, parts: parts };
      }

      // Copy repair: same content, same revision; never overwrite the only valid copy of S.
      var repaired = false;
      if (S.part === 'main') {
        if (!(B.valid && B.raw === S.rec.raw)) { if (!write(key(id, 'backup'), S.rec.raw, 'CR-backup')) return incomplete('CR-backup'); repaired = true; }
      } else if (!(M.valid && M.raw === S.rec.raw)) {
        if (!write(key(id, 'main'), S.rec.raw, 'CR-main')) return incomplete('CR-main');
        repaired = true;
      }
      if (!guardMatches(G, s)) {
        if (!write(key(id, 'guard'), JSON.stringify(guardFor(s)), 'CR-guard')) return incomplete('CR-guard');
        repaired = true;
      }
      return { status: 'ok', save: s, repaired: repaired, notices: notices, parts: parts };
    }

    /* ---------- index + listing */

    function readIndex() {
      var s = raw(INDEX_KEY);
      if (s === null) return { present: false, valid: false, obj: null };
      var obj = null;
      try { obj = JSON.parse(s); } catch (e) { return { present: true, valid: false, obj: null }; }
      var v = validateIndex(obj);
      return { present: true, valid: v.ok, obj: v.ok ? obj : null };
    }
    function writeIndex(order, prevRevision) {
      var x = seal({ schemaVersion: SCHEMA_VERSION, revision: (prevRevision || 0) + 1, order: order });
      return write(INDEX_KEY, JSON.stringify(x), 'IDX');
    }
    function scanCharacterIds() {
      var ids = {};
      allKeys().forEach(function (k) { var m = CHAR_KEY_RE.exec(k); if (m) ids[m[1]] = true; });
      return Object.keys(ids);
    }

    // Every character is checked (Main/Backup/Guard + recovery) before it is listed.
    // Discarded records use another prefix and are never scanned, so they never come back.
    function listCharacters() {
      var notices = [];
      var idx = readIndex();
      if (idx.present && !idx.valid) notices.push('indexInvalid');
      var found = scanCharacterIds();
      var byId = {};
      found.forEach(function (id) {
        var r = recover(id);
        var state = r.status === 'ok' ? (r.save.status === 'ready' ? 'ready' : 'creating') : (r.status === 'incomplete' ? 'recoveryIncomplete' : 'damaged');
        byId[id] = { id: id, state: state, save: r.status === 'ok' ? r.save : null, recovery: r };
      });
      var order = idx.valid ? idx.obj.order.filter(function (id) { return !!byId[id]; }) : [];
      var dropped = idx.valid ? idx.obj.order.length - order.length : 0;
      var rest = found.filter(function (id) { return order.indexOf(id) < 0; }).sort(function (a, b) {
        var ca = byId[a].save ? byId[a].save.profile.createdAt : '', cb = byId[b].save ? byId[b].save.profile.createdAt : '';
        return ca < cb ? -1 : ca > cb ? 1 : (a < b ? -1 : 1);
      });
      if (idx.valid && rest.length) notices.push('indexRecoveredCharacters');
      if (dropped) notices.push('indexDroppedMissing');
      var finalOrder = order.concat(rest);
      var needWrite = idx.valid ? canonical(idx.obj.order) !== canonical(finalOrder) : (idx.present || finalOrder.length > 0);
      if (needWrite) {
        if (!writeIndex(finalOrder, idx.valid ? idx.obj.revision : 0)) notices.push('indexWriteFailed');
        else if (!idx.valid && idx.present) notices.push('indexRebuilt');
      }
      return { characters: finalOrder.map(function (id) { return byId[id]; }), notices: notices };
    }

    function idInUse(id) {
      var ks = allKeys();
      for (var i = 0; i < ks.length; i++) {
        if (ks[i].indexOf(CHAR_PREFIX + id + '.') === 0 || ks[i].indexOf(DISCARD_PREFIX + id + '.') === 0) return true;
      }
      return false;
    }

    function addToIndex(id) {
      var idx = readIndex();
      var order = idx.valid ? idx.obj.order.slice() : scanCharacterIds().filter(function (x) { return x !== id; });
      if (order.indexOf(id) < 0) order.push(id);
      return writeIndex(order, idx.valid ? idx.obj.revision : 0);
    }
    function removeFromIndex(id) {
      var idx = readIndex();
      if (!idx.valid) return true; // the next listing rebuilds it from the records
      return writeIndex(idx.obj.order.filter(function (x) { return x !== id; }), idx.obj.revision);
    }

    /* ---------- character creation (status: creating -> ready) */

    function createCharacter(input, rules) {
      var nv = validateName(input && input.name);
      if (!nv.ok) return { ok: false, reason: 'NAME_' + nv.reason };
      var ap = validateAppearance(input);
      if (ap) return { ok: false, reason: 'APPEARANCE_' + ap };
      if (!rules || !isInt(rules.maxHp, 1) || !rules.start || !isInt(rules.start.c, 0) || !isInt(rules.start.r, 0)) return { ok: false, reason: 'BAD_RULES' };
      var id = null;
      for (var t = 0; t < 5 && !id; t++) {
        var c = newCharacterId(cryptoSource);
        if (c === null) return { ok: false, reason: 'NO_SECURE_RANDOM' };
        if (!idInUse(c)) id = c;
      }
      if (!id) return { ok: false, reason: 'ID_COLLISION' };

      var r1 = makeInitialSave(id, { name: nv.value, gender: input.gender, hairStyle: input.hairStyle, hairColor: input.hairColor }, rules, now());
      var s1 = JSON.stringify(r1);
      if (!write(key(id, 'main'), s1, 'CC3')) return { ok: false, reason: 'WRITE_FAILED', stage: 'CC3', id: id };
      if (!write(key(id, 'backup'), s1, 'CC4')) return { ok: false, reason: 'WRITE_FAILED', stage: 'CC4', id: id };
      if (!write(key(id, 'guard'), JSON.stringify(guardFor(r1)), 'CC5')) return { ok: false, reason: 'WRITE_FAILED', stage: 'CC5', id: id };
      var ready = clone(r1); ready.status = 'ready';
      var res = commit(r1, ready);
      if (!res.ok) return { ok: false, reason: 'WRITE_FAILED', stage: res.stage, durable: res.durable, id: id, tx: res.tx };
      var notices = addToIndex(id) ? [] : ['indexWriteFailed'];
      return { ok: true, id: id, save: res.save, notices: notices };
    }

    // For a character left in "creating": finish it (becomes ready) — the player decides.
    function finishCreation(id) {
      var rec = recover(id);
      if (rec.status !== 'ok') return { ok: false, reason: 'RECOVERY_' + rec.status, recovery: rec };
      if (rec.save.status === 'ready') return { ok: true, save: rec.save, already: true };
      var ready = clone(rec.save); ready.status = 'ready';
      var res = commit(rec.save, ready);
      if (res.ok && !addToIndex(id)) res.notices = ['indexWriteFailed'];
      return res;
    }

    // Load a character for play. Only a fully checked, ready character may be played.
    function loadCharacter(id) {
      if (typeof id !== 'string' || !ID_RE.test(id)) return { ok: false, reason: 'BAD_ID' };
      var rec = recover(id);
      if (rec.status !== 'ok') return { ok: false, reason: 'RECOVERY_' + rec.status, recovery: rec };
      if (rec.save.status !== 'ready') return { ok: false, reason: 'NOT_READY', recovery: rec };
      return { ok: true, save: rec.save, recovery: rec };
    }

    /* ---------- discard (player-confirmed; moves records aside, never deletes them) */

    function discardCharacter(id, confirm) {
      if (!confirm || confirm.confirmed !== true) return { ok: false, reason: 'NOT_CONFIRMED' };
      if (typeof id !== 'string' || !ID_RE.test(id)) return { ok: false, reason: 'BAD_ID' };
      var stamp = now().replace(/[^0-9]/g, '').slice(0, 17) || '0';
      var parts = ['main', 'backup', 'guard'], copied = [];
      for (var i = 0; i < parts.length; i++) {
        var v = raw(key(id, parts[i]));
        if (v === null) continue;
        var dk = DISCARD_PREFIX + id + '.' + stamp + '.' + parts[i];
        if (!write(dk, v, 'DS-copy')) return { ok: false, reason: 'COPY_FAILED', stage: 'DS-copy' };
        copied.push(parts[i]);
      }
      if (!copied.length) return { ok: false, reason: 'NOT_FOUND' };
      for (var j = 0; j < copied.length; j++) {
        if (!remove(key(id, copied[j]))) return { ok: false, reason: 'REMOVE_FAILED', stage: 'DS-remove' };
      }
      haltCheck('DS-remove');
      var notices = removeFromIndex(id) ? [] : ['indexWriteFailed'];
      return { ok: true, discardedAs: DISCARD_PREFIX + id + '.' + stamp, notices: notices };
    }

    return {
      probe: probe,
      commit: commit,
      resume: resume,
      recover: recover,
      listCharacters: listCharacters,
      createCharacter: createCharacter,
      finishCreation: finishCreation,
      loadCharacter: loadCharacter,
      discardCharacter: discardCharacter
    };
  }

  /* ------------------------------------------------------- browser helpers */

  function getBrowserBackend() {
    try { var ls = root.localStorage; return ls || null; } catch (e) { return null; }
  }

  // Returns test hooks only in a debug build opened with ?debug=save. Otherwise null.
  function debugHooksFromLocation() {
    if (!DEBUG_SAVE_HOOKS) return null;
    var search = '';
    try { search = root.location ? String(root.location.search) : ''; } catch (e) { return null; }
    if (!/[?&]debug=save(&|$)/.test(search)) return null;
    var cfg = { fail: {}, corrupt: {}, halt: {} };
    return {
      actionFor: function (step) { return cfg.fail[step] ? 'fail' : cfg.corrupt[step] ? 'corrupt' : null; },
      haltAfter: function (step) { return !!cfg.halt[step]; },
      set: function (mode, step, on) { if (cfg[mode]) cfg[mode][step] = on !== false; },
      clear: function () { cfg = { fail: {}, corrupt: {}, halt: {} }; }
    };
  }

  E.Save = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEBUG_SAVE_HOOKS: DEBUG_SAVE_HOOKS,
    GENDERS: GENDERS.slice(),
    HAIR_STYLE_COUNT: HAIR_STYLE_COUNT,
    HAIR_COLOR_COUNT: HAIR_COLOR_COUNT,
    NAME_MIN: NAME_MIN,
    NAME_MAX: NAME_MAX,
    KEYS: { INDEX: INDEX_KEY, CHAR_PREFIX: CHAR_PREFIX, DISCARD_PREFIX: DISCARD_PREFIX, PROBE: PROBE_KEY },
    SaveHalt: SaveHalt,
    canonical: canonical,
    fnv1a32Hex: fnv1a32Hex,
    checksumOf: checksumOf,
    contentKey: contentKey,
    seal: seal,
    validateName: validateName,
    countGraphemes: countGraphemes,
    _countGraphemesFallback: countGraphemesFallback,
    validateSave: validateSave,
    validateGuard: validateGuard,
    validateIndex: validateIndex,
    newCharacterId: newCharacterId,
    makeInitialSave: makeInitialSave,
    guardFor: guardFor,
    withPendingReward: withPendingReward,
    withClaim: withClaim,
    createSystem: createSystem,
    getBrowserBackend: getBrowserBackend,
    debugHooksFromLocation: debugHooksFromLocation
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E.Save;
})(typeof window !== 'undefined' ? window : globalThis);
