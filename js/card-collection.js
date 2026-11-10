/* Legend of Eldoria - Card Collection sidecar.
   Card rewards are staged and claimed here, outside the transactional character Save Engine.
   A single verified sidecar write atomically records owned cards + reward receipt.
*/
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  var PREFIX = 'eldoria.cards.';
  var SCHEMA_VERSION = 2;
  var LEGACY_SCHEMA_VERSION = 1;
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
  function isKnownCard(cardId) { return !!E.CARDS && Object.prototype.hasOwnProperty.call(E.CARDS, cardId); }
  function seal(data) { return E.Save.seal(data); }

  function starterData(characterId) {
    var quantities = Object.create(null), refs = [];
    (E.STARTER_DECK || []).forEach(function (cardId) {
      if (!isKnownCard(cardId)) return;
      var key = cardId + '@1';
      quantities[key] = (quantities[key] || 0) + 1;
      refs.push({ cardId: cardId, stars: 1 });
    });
    return {
      schemaVersion: SCHEMA_VERSION, characterId: characterId,
      owned: Object.keys(quantities).map(function (key) {
        var split = key.lastIndexOf('@');
        return { cardId: key.slice(0, split), stars: 1, quantity: quantities[key] };
      }),
      presets: [{ id: 'starter', name: 'Starter Deck', cardRefs: refs }],
      activePresetId: 'starter', pendingRewards: [], claimedRewardIds: []
    };
  }

  function validateLegacy(data, characterId) {
    if (!exactKeys(data, ['schemaVersion', 'characterId', 'owned', 'presets', 'activePresetId', 'checksum'])) return 'keys';
    if (data.schemaVersion !== LEGACY_SCHEMA_VERSION || data.characterId !== characterId) return 'identity';
    if (!Array.isArray(data.owned) || !Array.isArray(data.presets)) return 'collections';
    if (!E.Save || data.checksum !== E.Save.checksumOf(data)) return 'checksum';
    return validateCollections(data);
  }

  function validateCollections(data) {
    if (!Array.isArray(data.owned) || !Array.isArray(data.presets)) return 'collections';
    var owned = Object.create(null);
    for (var i = 0; i < data.owned.length; i++) {
      var item = data.owned[i];
      if (!exactKeys(item, ['cardId', 'stars', 'quantity']) ||
          typeof item.cardId !== 'string' || !isKnownCard(item.cardId) ||
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
            !isKnownCard(ref.cardId) || !Number.isInteger(ref.stars) || ref.stars < 1 || ref.stars > 3) return 'cardRef';
        var refKey = ref.cardId + '@' + ref.stars;
        used[refKey] = (used[refKey] || 0) + 1;
        if (used[refKey] > (owned[refKey] || 0)) return 'unownedReference';
      }
    }
    if (data.presets.length ? !presetIds[data.activePresetId] : data.activePresetId !== null) return 'activePreset';
    return null;
  }

  function validate(data, characterId) {
    if (!exactKeys(data, ['schemaVersion', 'characterId', 'owned', 'presets', 'activePresetId', 'pendingRewards', 'claimedRewardIds', 'checksum'])) return 'keys';
    if (data.schemaVersion !== SCHEMA_VERSION || data.characterId !== characterId) return 'identity';
    var collectionsReason = validateCollections(data);
    if (collectionsReason) return collectionsReason;
    if (!Array.isArray(data.pendingRewards) || data.pendingRewards.length > 1000 ||
        !Array.isArray(data.claimedRewardIds) || data.claimedRewardIds.length > 10000) return 'rewardHistory';
    var pending = Object.create(null);
    for (var i = 0; i < data.pendingRewards.length; i++) {
      var reward = data.pendingRewards[i];
      if (!exactKeys(reward, ['rewardId', 'cards']) || typeof reward.rewardId !== 'string' ||
          !reward.rewardId || reward.rewardId.length > 100 || pending[reward.rewardId] ||
          !Array.isArray(reward.cards) || reward.cards.length > 100) return 'pendingRewards';
      pending[reward.rewardId] = true;
      for (var j = 0; j < reward.cards.length; j++) {
        var card = reward.cards[j];
        if (!exactKeys(card, ['cardId', 'stars', 'quantity']) || !isKnownCard(card.cardId) ||
            !Number.isInteger(card.stars) || card.stars < 1 || card.stars > 3 ||
            !Number.isInteger(card.quantity) || card.quantity < 1 || card.quantity > 1000000) return 'pendingCard';
      }
    }
    var receipts = Object.create(null);
    for (var k = 0; k < data.claimedRewardIds.length; k++) {
      var id = data.claimedRewardIds[k];
      if (typeof id !== 'string' || !id || id.length > 100 || receipts[id]) return 'claimedRewardIds';
      receipts[id] = true;
      if (pending[id]) return 'rewardState';
    }
    if (!E.Save || typeof E.Save.checksumOf !== 'function' || data.checksum !== E.Save.checksumOf(data)) return 'checksum';
    return null;
  }

  function read(characterId) {
    if (typeof characterId !== 'string' || !ID_RE.test(characterId)) return { ok: false, reason: 'BAD_CHARACTER_ID' };
    var storage = backend();
    if (!storage) return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    var raw;
    try { raw = storage.getItem(keyFor(characterId)); } catch (error) { return { ok: false, reason: 'READ_FAILED' }; }
    if (raw === null) return { ok: true, source: 'starter', data: starterData(characterId) };
    var data;
    try { data = JSON.parse(raw); } catch (error) { return { ok: false, reason: 'CORRUPT' }; }
    if (data && data.schemaVersion === LEGACY_SCHEMA_VERSION) {
      var legacyReason = validateLegacy(data, characterId);
      if (legacyReason) return { ok: false, reason: 'CORRUPT:' + legacyReason };
      var migrated = {
        schemaVersion: SCHEMA_VERSION, characterId: characterId,
        owned: clone(data.owned), presets: clone(data.presets), activePresetId: data.activePresetId,
        pendingRewards: [], claimedRewardIds: []
      };
      return { ok: true, source: 'legacy', data: migrated };
    }
    var reason = validate(data, characterId);
    return reason ? { ok: false, reason: 'CORRUPT:' + reason } : { ok: true, source: 'saved', data: clone(data) };
  }

  function write(characterId, input) {
    if (typeof characterId !== 'string' || !ID_RE.test(characterId)) return { ok: false, reason: 'BAD_CHARACTER_ID' };
    if (!input || !Array.isArray(input.owned) || !Array.isArray(input.presets)) return { ok: false, reason: 'BAD_DATA' };
    var data = {
      schemaVersion: SCHEMA_VERSION, characterId: characterId,
      owned: clone(input.owned), presets: clone(input.presets),
      activePresetId: input.activePresetId === undefined ? null : input.activePresetId,
      pendingRewards: clone(input.pendingRewards || []),
      claimedRewardIds: clone(input.claimedRewardIds || [])
    };
    data = seal(data);
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

  function stageReward(characterId, rewardId, rewards) {
    if (typeof rewardId !== 'string' || !rewardId || rewardId.length > 100 || !Array.isArray(rewards)) return { ok: false, reason: 'BAD_REWARD' };
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    var data = loaded.data;
    if (data.claimedRewardIds.indexOf(rewardId) >= 0) return { ok: true, alreadyClaimed: true, cards: [] };
    var existing = data.pendingRewards.find(function (entry) { return entry.rewardId === rewardId; });
    if (existing) return { ok: true, alreadyStaged: true, cards: clone(existing.cards) };
    var cards = rewards.map(function (card) {
      if (!card || typeof card.cardId !== 'string' || !isKnownCard(card.cardId) ||
          !Number.isInteger(card.stars) || card.stars < 1 || card.stars > 3 ||
          !Number.isInteger(card.quantity) || card.quantity < 1 || card.quantity > 1000000) throw new Error('Invalid card reward.');
      return { cardId: card.cardId, stars: card.stars, quantity: card.quantity };
    });
    data.pendingRewards.push({ rewardId: rewardId, cards: cards });
    var saved = write(characterId, data);
    return saved.ok ? { ok: true, cards: cards, data: saved.data } : saved;
  }

  function claimReward(characterId, rewardId) {
    if (typeof rewardId !== 'string' || !rewardId) return { ok: false, reason: 'BAD_REWARD_ID' };
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    var data = loaded.data;
    if (data.claimedRewardIds.indexOf(rewardId) >= 0) return { ok: true, alreadyClaimed: true, cards: [] };
    var index = data.pendingRewards.findIndex(function (entry) { return entry.rewardId === rewardId; });
    if (index < 0) return { ok: true, missingStage: true, cards: [] }; // compatibility for pre-acquisition pending Save rewards
    var entry = data.pendingRewards[index];
    entry.cards.forEach(function (card) {
      var owned = data.owned.find(function (item) { return item.cardId === card.cardId && item.stars === card.stars; });
      if (owned) owned.quantity += card.quantity;
      else data.owned.push(clone(card));
    });
    data.pendingRewards.splice(index, 1);
    data.claimedRewardIds.push(rewardId);
    if (data.claimedRewardIds.length > 10000) data.claimedRewardIds.shift();
    var saved = write(characterId, data);
    return saved.ok ? { ok: true, cards: clone(entry.cards), data: saved.data } : saved;
  }

  E.CardCollection = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    get: read,
    save: write,
    stageReward: stageReward,
    claimReward: claimReward,
    keyFor: keyFor
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.CardCollection;
})(typeof window !== 'undefined' ? window : globalThis);
