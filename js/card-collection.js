/* Legend of Eldoria - Card Collection sidecar.
   Schema v3 adds a durable battle reward journal and a verified backup.
   Character Save Engine and Save Schema remain independent and unchanged.
*/
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  var PREFIX = 'eldoria.cards.';
  var SCHEMA_VERSION = 3;
  var LEGACY_SCHEMA_VERSION = 1;
  var PREVIOUS_SCHEMA_VERSION = 2;
  var ID_RE = /^[0-9a-f]{32}$/;
  var MAX_REWARD_HISTORY = 10000;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function exactKeys(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    var actual = Object.keys(value).sort(), expected = keys.slice().sort();
    return actual.length === expected.length && actual.every(function (key, index) { return key === expected[index]; });
  }
  function backend() { try { return root.localStorage || null; } catch (error) { return null; } }
  function keyFor(characterId) { return PREFIX + characterId; }
  function backupKeyFor(characterId) { return PREFIX + characterId + '.backup'; }
  function activeMarkerKey(characterId) { return PREFIX + 'v3.active.' + characterId; }
  function isRewardSystemActive(characterId) {
    var storage = backend();
    try { return !!storage && storage.getItem(activeMarkerKey(characterId)) === '1'; } catch (error) { return true; }
  }
  function ensureActiveMarker(characterId) {
    var storage = backend();
    if (!storage) return false;
    try { storage.setItem(activeMarkerKey(characterId), '1'); return storage.getItem(activeMarkerKey(characterId)) === '1'; }
    catch (error) { return false; }
  }
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
      schemaVersion: SCHEMA_VERSION, revision: 0, characterId: characterId,
      owned: Object.keys(quantities).map(function (key) {
        var split = key.lastIndexOf('@');
        return { cardId: key.slice(0, split), stars: 1, quantity: quantities[key] };
      }),
      presets: [{ id: 'starter', name: 'Starter Deck', cardRefs: refs }],
      activePresetId: 'starter', pendingRewards: [], claimedRewardIds: [], rewardJournal: []
    };
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

  function validateRewardLists(data) {
    if (!Array.isArray(data.pendingRewards) || data.pendingRewards.length > 1000 ||
        !Array.isArray(data.claimedRewardIds) || data.claimedRewardIds.length > MAX_REWARD_HISTORY) return 'rewardHistory';
    var pending = Object.create(null);
    for (var i = 0; i < data.pendingRewards.length; i++) {
      var reward = data.pendingRewards[i];
      if (!exactKeys(reward, ['rewardId', 'cards']) || typeof reward.rewardId !== 'string' ||
          !reward.rewardId || reward.rewardId.length > 100 || pending[reward.rewardId] ||
          !Array.isArray(reward.cards) || reward.cards.length > 100) return 'pendingRewards';
      pending[reward.rewardId] = true;
      for (var j = 0; j < reward.cards.length; j++) {
        var card = reward.cards[j];
        if (!validCardReward(card)) return 'pendingCard';
      }
    }
    var receipts = Object.create(null);
    for (var k = 0; k < data.claimedRewardIds.length; k++) {
      var id = data.claimedRewardIds[k];
      if (typeof id !== 'string' || !id || id.length > 100 || receipts[id]) return 'claimedRewardIds';
      receipts[id] = true;
      if (pending[id]) return 'rewardState';
    }
    return null;
  }

  function validCardReward(card) {
    return !!card && exactKeys(card, ['cardId', 'stars', 'quantity']) &&
      typeof card.cardId === 'string' && isKnownCard(card.cardId) &&
      Number.isInteger(card.stars) && card.stars >= 1 && card.stars <= 3 &&
      Number.isInteger(card.quantity) && card.quantity >= 1 && card.quantity <= 1000000;
  }

  function validateJournal(data) {
    if (!Array.isArray(data.rewardJournal) || data.rewardJournal.length > MAX_REWARD_HISTORY) return 'rewardJournal';
    var ids = Object.create(null);
    for (var i = 0; i < data.rewardJournal.length; i++) {
      var entry = data.rewardJournal[i];
      if (!exactKeys(entry, ['rewardId', 'monsterId', 'exp', 'gold', 'drops', 'cards', 'createdAt', 'status']) ||
          typeof entry.rewardId !== 'string' || !/^[1-9][0-9]*$/.test(entry.rewardId) ||
          ids[entry.rewardId] || typeof entry.monsterId !== 'string' || !entry.monsterId ||
          !Number.isInteger(entry.exp) || entry.exp < 0 || entry.exp > 1000000000 ||
          entry.gold !== 0 || !Array.isArray(entry.drops) || entry.drops.length > 100 ||
          !Array.isArray(entry.cards) || entry.cards.length > 100 ||
          typeof entry.createdAt !== 'string' || !entry.createdAt || entry.createdAt.length > 64 ||
          ['staged', 'cardsClaimed', 'completed'].indexOf(entry.status) < 0) return 'rewardJournalEntry';
      ids[entry.rewardId] = true;
      for (var d = 0; d < entry.drops.length; d++) {
        var drop = entry.drops[d];
        if (!exactKeys(drop, ['id', 'name']) || typeof drop.id !== 'string' || !drop.id ||
            typeof drop.name !== 'string' || !drop.name) return 'rewardJournalDrop';
      }
      for (var c = 0; c < entry.cards.length; c++) if (!validCardReward(entry.cards[c])) return 'rewardJournalCard';
    }
    return null;
  }

  function validateLegacy(data, characterId) {
    if (!exactKeys(data, ['schemaVersion', 'characterId', 'owned', 'presets', 'activePresetId', 'checksum'])) return 'keys';
    if (data.schemaVersion !== LEGACY_SCHEMA_VERSION || data.characterId !== characterId) return 'identity';
    var collectionsReason = validateCollections(data);
    if (collectionsReason) return collectionsReason;
    if (!E.Save || data.checksum !== E.Save.checksumOf(data)) return 'checksum';
    return null;
  }

  function validatePrevious(data, characterId) {
    if (!exactKeys(data, ['schemaVersion', 'characterId', 'owned', 'presets', 'activePresetId', 'pendingRewards', 'claimedRewardIds', 'checksum'])) return 'keys';
    if (data.schemaVersion !== PREVIOUS_SCHEMA_VERSION || data.characterId !== characterId) return 'identity';
    var collectionsReason = validateCollections(data);
    if (collectionsReason) return collectionsReason;
    var rewardsReason = validateRewardLists(data);
    if (rewardsReason) return rewardsReason;
    if (!E.Save || data.checksum !== E.Save.checksumOf(data)) return 'checksum';
    return null;
  }

  function validate(data, characterId) {
    if (!exactKeys(data, ['schemaVersion', 'revision', 'characterId', 'owned', 'presets', 'activePresetId', 'pendingRewards', 'claimedRewardIds', 'rewardJournal', 'checksum'])) return 'keys';
    if (data.schemaVersion !== SCHEMA_VERSION || data.characterId !== characterId) return 'identity';
    if (!Number.isInteger(data.revision) || data.revision < 0 || data.revision > 1000000000) return 'revision';
    var collectionsReason = validateCollections(data);
    if (collectionsReason) return collectionsReason;
    var rewardsReason = validateRewardLists(data);
    if (rewardsReason) return rewardsReason;
    var journalReason = validateJournal(data);
    if (journalReason) return journalReason;
    if (!E.Save || typeof E.Save.checksumOf !== 'function' || data.checksum !== E.Save.checksumOf(data)) return 'checksum';
    return null;
  }

  function migrate(data, characterId) {
    return {
      schemaVersion: SCHEMA_VERSION, revision: 0, characterId: characterId,
      owned: clone(data.owned), presets: clone(data.presets), activePresetId: data.activePresetId,
      pendingRewards: clone(data.pendingRewards || []), claimedRewardIds: clone(data.claimedRewardIds || []),
      rewardJournal: []
    };
  }

  function parseRecord(raw, characterId) {
    if (raw === null) return { ok: false, missing: true };
    var data;
    try { data = JSON.parse(raw); } catch (error) { return { ok: false, reason: 'CORRUPT' }; }
    if (data && data.schemaVersion === LEGACY_SCHEMA_VERSION) {
      var legacyReason = validateLegacy(data, characterId);
      return legacyReason ? { ok: false, reason: 'CORRUPT:' + legacyReason } : { ok: true, source: 'legacy-v1', data: migrate(data, characterId) };
    }
    if (data && data.schemaVersion === PREVIOUS_SCHEMA_VERSION) {
      var previousReason = validatePrevious(data, characterId);
      return previousReason ? { ok: false, reason: 'CORRUPT:' + previousReason } : { ok: true, source: 'legacy-v2', data: migrate(data, characterId) };
    }
    var reason = validate(data, characterId);
    return reason ? { ok: false, reason: 'CORRUPT:' + reason } : { ok: true, source: 'saved', data: clone(data) };
  }

  function read(characterId) {
    if (typeof characterId !== 'string' || !ID_RE.test(characterId)) return { ok: false, reason: 'BAD_CHARACTER_ID' };
    var storage = backend();
    if (!storage) return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    var primaryRaw, backupRaw;
    try {
      primaryRaw = storage.getItem(keyFor(characterId));
      backupRaw = storage.getItem(backupKeyFor(characterId));
    } catch (error) { return { ok: false, reason: 'READ_FAILED' }; }
    var primary = parseRecord(primaryRaw, characterId);
    var backup = parseRecord(backupRaw, characterId);
    if (primary.ok && backup.ok) {
      var primaryRevision = primary.data.revision || 0;
      var backupRevision = backup.data.revision || 0;
      if (backupRevision > primaryRevision) return { ok: true, source: 'backup', recovered: true, data: backup.data };
      if (backupRevision === primaryRevision && primary.data.checksum !== backup.data.checksum) return { ok: false, reason: 'SIDECAR_REVISION_CONFLICT' };
      return primary;
    }
    if (primary.ok) return primary;
    if (backup.ok) return { ok: true, source: 'backup', recovered: true, data: backup.data };
    if (primary.missing && backup.missing) {
      if (isRewardSystemActive(characterId)) return { ok: false, reason: 'ACTIVE_SIDECAR_MISSING' };
      return { ok: true, source: 'starter', data: starterData(characterId) };
    }
    if (primary.missing) return { ok: false, reason: backup.reason || 'BACKUP_INVALID' };
    if (backup.missing) return { ok: false, reason: primary.reason || 'CORRUPT' };
    return { ok: false, reason: (primary.reason || 'CORRUPT') + '|BACKUP:' + (backup.reason || 'CORRUPT') };
  }

  function write(characterId, input) {
    if (typeof characterId !== 'string' || !ID_RE.test(characterId)) return { ok: false, reason: 'BAD_CHARACTER_ID' };
    if (!input || !Array.isArray(input.owned) || !Array.isArray(input.presets)) return { ok: false, reason: 'BAD_DATA' };
    var storage = backend();
    if (!storage) return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    if (input.revision !== undefined && input.revision !== loaded.data.revision) return { ok: false, reason: 'STALE_SIDECAR_WRITE' };
    var data = {
      schemaVersion: SCHEMA_VERSION, revision: (loaded.data.revision || 0) + 1, characterId: characterId,
      owned: clone(input.owned), presets: clone(input.presets),
      activePresetId: input.activePresetId === undefined ? null : input.activePresetId,
      pendingRewards: clone(input.pendingRewards || []),
      claimedRewardIds: clone(input.claimedRewardIds || []),
      rewardJournal: clone(input.rewardJournal || [])
    };
    data = seal(data);
    var reason = validate(data, characterId);
    if (reason) return { ok: false, reason: 'INVALID:' + reason };
    var raw = JSON.stringify(data), backupDurable = false;
    try {
      // Write the newest revision to backup first. Reads select the highest valid revision,
      // so a crash before primary write still recovers this complete journal entry.
      storage.setItem(backupKeyFor(characterId), raw);
      if (storage.getItem(backupKeyFor(characterId)) !== raw) return { ok: false, reason: 'BACKUP_WRITE_VERIFY_FAILED' };
      backupDurable = true;
      var latest = read(characterId);
      if (!latest.ok || latest.data.checksum !== data.checksum) return { ok: false, reason: 'STALE_SIDECAR_WRITE', durable: true };
      storage.setItem(keyFor(characterId), raw);
      if (storage.getItem(keyFor(characterId)) !== raw) return { ok: true, degraded: true, data: clone(data) };
      var verified = read(characterId);
      if (!verified.ok || verified.data.checksum !== data.checksum) return { ok: false, reason: 'SIDECAR_WRITE_CONFLICT', durable: true };
    } catch (error) {
      if (backupDurable) return { ok: true, degraded: true, data: clone(data) };
      return { ok: false, reason: 'WRITE_FAILED' };
    }
    return { ok: true, data: clone(data) };
  }

  function normalizeCards(rewards) {
    if (!Array.isArray(rewards) || rewards.length > 100) throw new Error('Invalid card reward list.');
    return rewards.map(function (card) {
      if (!validCardReward(card)) throw new Error('Invalid card reward.');
      return { cardId: card.cardId, stars: card.stars, quantity: card.quantity };
    });
  }

  function stageReward(characterId, rewardId, rewards) {
    if (typeof rewardId !== 'string' || !rewardId || rewardId.length > 100 || !Array.isArray(rewards)) return { ok: false, reason: 'BAD_REWARD' };
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    var data = loaded.data;
    if (data.claimedRewardIds.indexOf(rewardId) >= 0) return { ok: true, alreadyClaimed: true, cards: [] };
    var existing = data.pendingRewards.find(function (entry) { return entry.rewardId === rewardId; });
    if (existing) return { ok: true, alreadyStaged: true, cards: clone(existing.cards) };
    var cards = normalizeCards(rewards);
    data.pendingRewards.push({ rewardId: rewardId, cards: cards });
    var saved = write(characterId, data);
    return saved.ok ? { ok: true, cards: cards, data: saved.data } : saved;
  }

  function stageBattleReward(characterId, intent) {
    if (!intent || typeof intent.rewardId !== 'string' || !/^[1-9][0-9]*$/.test(intent.rewardId) ||
        typeof intent.monsterId !== 'string' || !intent.monsterId || !intent.reward ||
        !Number.isInteger(intent.reward.exp) || intent.reward.exp < 0 ||
        !Array.isArray(intent.reward.drops) || intent.reward.gold !== 0) return { ok: false, reason: 'BAD_BATTLE_REWARD' };
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    var data = loaded.data;
    var existing = data.rewardJournal.find(function (entry) { return entry.rewardId === intent.rewardId; });
    if (existing) {
      if (!ensureActiveMarker(characterId)) return { ok: false, reason: 'ACTIVE_MARKER_WRITE_FAILED', durable: true };
      return { ok: true, alreadyStaged: true, journal: clone(existing), cards: clone(existing.cards) };
    }
    while (data.rewardJournal.length >= MAX_REWARD_HISTORY && data.rewardJournal.length && data.rewardJournal[0].status === 'completed') data.rewardJournal.shift();
    if (data.rewardJournal.length >= MAX_REWARD_HISTORY) return { ok: false, reason: 'REWARD_JOURNAL_FULL' };
    var cards = normalizeCards(intent.cards || []);
    var drops = intent.reward.drops.map(function (drop) {
      if (!drop || typeof drop.id !== 'string' || !drop.id || typeof drop.name !== 'string' || !drop.name) throw new Error('Invalid item reward.');
      return { id: drop.id, name: drop.name };
    });
    var entry = {
      rewardId: intent.rewardId, monsterId: intent.monsterId, exp: intent.reward.exp, gold: 0,
      drops: drops, cards: cards, createdAt: intent.createdAt || new Date().toISOString(), status: 'staged'
    };
    data.rewardJournal.push(entry);
    data.pendingRewards.push({ rewardId: intent.rewardId, cards: clone(cards) });
    var saved = write(characterId, data);
    if (!saved.ok) return saved;
    if (!ensureActiveMarker(characterId)) return { ok: false, reason: 'ACTIVE_MARKER_WRITE_FAILED', durable: true };
    return { ok: true, degraded: !!saved.degraded, journal: clone(entry), cards: cards, data: saved.data };
  }

  function claimReward(characterId, rewardId) {
    if (typeof rewardId !== 'string' || !rewardId) return { ok: false, reason: 'BAD_REWARD_ID' };
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    var data = loaded.data;
    if (data.claimedRewardIds.indexOf(rewardId) >= 0) return { ok: true, alreadyClaimed: true, cards: [], schemaVersion: SCHEMA_VERSION };
    var index = data.pendingRewards.findIndex(function (entry) { return entry.rewardId === rewardId; });
    if (index < 0) return { ok: true, missingStage: true, cards: [], schemaVersion: data.schemaVersion, source: loaded.source };
    var entry = data.pendingRewards[index];
    entry.cards.forEach(function (card) {
      var owned = data.owned.find(function (item) { return item.cardId === card.cardId && item.stars === card.stars; });
      if (owned) owned.quantity += card.quantity;
      else data.owned.push(clone(card));
    });
    data.pendingRewards.splice(index, 1);
    data.claimedRewardIds.push(rewardId);
    if (data.claimedRewardIds.length > MAX_REWARD_HISTORY) data.claimedRewardIds.shift();
    var journal = data.rewardJournal.find(function (item) { return item.rewardId === rewardId; });
    if (journal) journal.status = 'cardsClaimed';
    var saved = write(characterId, data);
    return saved.ok ? { ok: true, cards: clone(entry.cards), data: saved.data } : saved;
  }

  function completeReward(characterId, rewardId) {
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    var data = loaded.data;
    var entry = data.rewardJournal.find(function (item) { return item.rewardId === rewardId; });
    if (!entry) return { ok: false, reason: 'JOURNAL_MISSING' };
    if (entry.status === 'completed') return { ok: true, alreadyCompleted: true };
    if (data.claimedRewardIds.indexOf(rewardId) < 0) return { ok: false, reason: 'CARDS_NOT_CLAIMED' };
    entry.status = 'completed';
    var saved = write(characterId, data);
    return saved.ok ? { ok: true, data: saved.data } : saved;
  }

  function getRewardJournal(characterId) {
    var loaded = read(characterId);
    if (!loaded.ok) return loaded;
    var entries = clone(loaded.data.rewardJournal || []);
    if (entries.length && !ensureActiveMarker(characterId)) return { ok: false, reason: 'ACTIVE_MARKER_WRITE_FAILED' };
    return { ok: true, source: loaded.source, data: loaded.data, entries: entries };
  }

  E.CardCollection = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    get: read, save: write, stageReward: stageReward, stageBattleReward: stageBattleReward,
    claimReward: claimReward, completeReward: completeReward, getRewardJournal: getRewardJournal,
    keyFor: keyFor, backupKeyFor: backupKeyFor, isRewardSystemActive: isRewardSystemActive
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.CardCollection;
})(typeof window !== 'undefined' ? window : globalThis);