/* Legend of Eldoria - Card Collection sidecar.
   This module deliberately stores collection data outside the character Save Engine.
   It never mutates character saves, Save Schema, Main / Backup / Guard, or Gold.
*/
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  var PREFIX = 'eldoria.cards.';
  var SCHEMA_VERSION = 1;
  var ID_RE = /^[0-9a-f]{32}$/;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function exactKeys(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var actual = Object.keys(value).sort(), expected = keys.slice().sort();
    return actual.length === expected.length && actual.every(function (key, index) { return key === expected[index]; });
  }
  function backend() {
    try { return root.localStorage || null; } catch (error) { return null; }
  }
  function keyFor(characterId) { return PREFIX + characterId; }

  function starterData(characterId) {
    var quantities = Object.create(null);
    var refs = [];
    (E.STARTER_DECK || []).forEach(function (cardId) {
      var card = E.CARDS && E.CARDS[cardId];
      if (!card) return;
      var key = cardId + '@1';
      quantities[key] = (quantities[key] || 0) + 1;
      refs.push({ cardId: cardId, stars: 1 });
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      characterId: characterId,
      owned: Object.keys(quantities).map(function (key) {
        var split = key.lastIndexOf('@');
        return { cardId: key.slice(0, split), stars: 1, quantity: quantities[key] };
      }),
      presets: [{ id: 'starter', name: 'Starter Deck', cardRefs: refs }],
      activePresetId: 'starter'
    };
  }

  function validate(data, characterId) {
    if (!exactKeys(data, ['schemaVersion', 'characterId', 'owned', 'presets', 'activePresetId', 'checksum'])) return 'keys';
    if (data.schemaVersion !== SCHEMA_VERSION || data.characterId !== characterId) return 'identity';
    if (!Array.isArray(data.owned) || !Array.isArray(data.presets)) return 'collections';
    var owned = Object.create(null);
    for (var i = 0; i < data.owned.length; i++) {
      var item = data.owned[i];
      if (!exactKeys(item, ['cardId', 'stars', 'quantity']) ||
          typeof item.cardId !== 'string' || !E.CARDS[item.cardId] ||
          !Number.isInteger(item.stars) || item.stars < 1 || item.stars > 3 ||
          !Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > 1000000000) return 'owned';
      var ownedKey = item.cardId + '@' + item.stars;
      if (Object.prototype.hasOwnProperty.call(owned, ownedKey)) return 'ownedDuplicate';
      owned[ownedKey] = item.quantity;
    }
    var presetIds = Object.create(null);
    for (var p = 0; p < data.presets.length; p++) {
      var preset = data.presets[p];
      if (!exactKeys(preset, ['id', 'name', 'cardRefs']) ||
          typeof preset.id !== 'string' || !preset.id || preset.id.length > 64 ||
          typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 64 ||
          !Array.isArray(preset.cardRefs) || preset.cardRefs.length > 20 ||
          Object.prototype.hasOwnProperty.call(presetIds, preset.id)) return 'preset';
      presetIds[preset.id] = true;
      var used = Object.create(null);
      for (var c = 0; c < preset.cardRefs.length; c++) {
        var ref = preset.cardRefs[c];
        if (!exactKeys(ref, ['cardId', 'stars']) || typeof ref.cardId !== 'string' ||
            !E.CARDS[ref.cardId] || !Number.isInteger(ref.stars) || ref.stars < 1 || ref.stars > 3) return 'cardRef';
        var refKey = ref.cardId + '@' + ref.stars;
        used[refKey] = (used[refKey] || 0) + 1;
        if (used[refKey] > (owned[refKey] || 0)) return 'unownedReference';
      }
    }
    if (data.presets.length ? !presetIds[data.activePresetId] : data.activePresetId !== null) return 'activePreset';
    if (!E.Save || typeof E.Save.checksumOf !== 'function' || data.checksum !== E.Save.checksumOf(data)) return 'checksum';
    return null;
  }

  function get(characterId) {
    if (typeof characterId !== 'string' || !ID_RE.test(characterId)) return { ok: false, reason: 'BAD_CHARACTER_ID' };
    var storage = backend();
    if (!storage) return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    var raw;
    try { raw = storage.getItem(keyFor(characterId)); } catch (error) { return { ok: false, reason: 'READ_FAILED' }; }
    if (raw === null) return { ok: true, source: 'starter', data: starterData(characterId) };
    var data;
    try { data = JSON.parse(raw); } catch (error) { return { ok: false, reason: 'CORRUPT' }; }
    var reason = validate(data, characterId);
    return reason ? { ok: false, reason: 'CORRUPT:' + reason } : { ok: true, source: 'saved', data: clone(data) };
  }

  function save(characterId, input) {
    if (typeof characterId !== 'string' || !ID_RE.test(characterId)) return { ok: false, reason: 'BAD_CHARACTER_ID' };
    if (!input || !Array.isArray(input.owned) || !Array.isArray(input.presets)) return { ok: false, reason: 'BAD_DATA' };
    var data = {
      schemaVersion: SCHEMA_VERSION,
      characterId: characterId,
      owned: clone(input.owned),
      presets: clone(input.presets),
      activePresetId: input.activePresetId === undefined ? null : input.activePresetId
    };
    data = E.Save.seal(data);
    var reason = validate(data, characterId);
    if (reason) return { ok: false, reason: 'INVALID:' + reason };
    var storage = backend();
    if (!storage) return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    var raw = JSON.stringify(data);
    try {
      storage.setItem(keyFor(characterId), raw);
      if (storage.getItem(keyFor(characterId)) !== raw) return { ok: false, reason: 'WRITE_VERIFY_FAILED' };
    } catch (error) { return { ok: false, reason: 'WRITE_FAILED' }; }
    return { ok: true, data: clone(data) };
  }

  E.CardCollection = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    get: get,
    save: save,
    keyFor: keyFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.CardCollection;
})(typeof window !== 'undefined' ? window : globalThis);
