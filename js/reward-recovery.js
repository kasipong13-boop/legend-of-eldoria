/* Legend of Eldoria — IndexedDB Companion Reward Journal + Web Locks.
   The journal is separate from Card Collection Sidecar v2 and Character Save Schema v1.
   Journal and quarantine evidence are retained; no reward record is physically deleted.
*/
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  var DB_NAME = 'eldoria-reward-recovery';
  var DB_VERSION = 1;
  var JOURNAL_STORE = 'journal';
  var QUARANTINE_STORE = 'quarantine';
  var STATES = ['prepared', 'sidecarStaged', 'savePending', 'cardsClaimed', 'saveClaimed', 'completed', 'quarantined'];
  var NEXT = {
    prepared: ['sidecarStaged', 'quarantined'],
    sidecarStaged: ['savePending', 'quarantined'],
    savePending: ['cardsClaimed', 'quarantined'],
    cardsClaimed: ['saveClaimed', 'quarantined'],
    saveClaimed: ['completed', 'quarantined'],
    completed: [],
    quarantined: []
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stable(value[key]);
    }).join(',') + '}';
  }
  function makeKey(characterId, rewardId) { return characterId + ':' + rewardId; }
  function validId(value) { return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value); }

  function create(options) {
    options = options || {};
    var indexedDB = Object.prototype.hasOwnProperty.call(options, 'indexedDB') ? options.indexedDB : root.indexedDB;
    var locks = Object.prototype.hasOwnProperty.call(options, 'locks') ? options.locks : (root.navigator && root.navigator.locks);
    var markerStorage = Object.prototype.hasOwnProperty.call(options, 'markerStorage') ? options.markerStorage : null;
    if (!Object.prototype.hasOwnProperty.call(options, 'markerStorage')) {
      try { markerStorage = root.localStorage || null; } catch (storageError) { markerStorage = null; }
    }
    var cryptoApi = Object.prototype.hasOwnProperty.call(options, 'crypto') ? options.crypto : root.crypto;
    var now = options.now || function () { return new Date().toISOString(); };
    var fault = typeof options.fault === 'function' ? options.fault : function () {};
    var adapter = options.adapter || null;
    var dbPromise = null;
    var lockHeld = Object.create(null);
    var quarantineCounter = 0;

    function checkpoint(point, context) { fault(point, context || null); }
    function requireLock(characterId) { return lockHeld[characterId] === true; }
    function activeMarkerKey(characterId) { return 'eldoria.reward.v1.active.' + characterId; }
    function ensureActiveMarker(characterId) {
      try {
        if (!markerStorage) return false;
        markerStorage.setItem(activeMarkerKey(characterId), '1');
        return markerStorage.getItem(activeMarkerKey(characterId)) === '1';
      } catch (error) { return false; }
    }
    function isActive(characterId) {
      try { return !markerStorage || markerStorage.getItem(activeMarkerKey(characterId)) === '1'; }
      catch (error) { return true; }
    }
    // A durable Journal is evidence of activation even if localStorage lost its marker.
    // Refuse to proceed when the marker cannot be restored: losing IndexedDB later
    // must never silently downgrade a journal-backed reward to a legacy reward.
    function reconcileActivation(characterId, entries) {
      if (!requireLock(characterId)) return { ok: false, reason: 'REWARD_LOCK_REQUIRED' };
      if (!Array.isArray(entries)) return { ok: false, reason: 'JOURNAL_EVIDENCE_UNAVAILABLE' };
      if (entries.length && !ensureActiveMarker(characterId)) {
        return { ok: false, reason: 'REWARD_MARKER_WRITE_FAILED' };
      }
      return { ok: true, activated: entries.length > 0 || isActive(characterId) };
    }
    function digest(payload) {
      if (!E.Save || typeof E.Save.checksumOf !== 'function') throw new Error('SAVE_CHECKSUM_UNAVAILABLE');
      return E.Save.checksumOf(payload);
    }
    function createEncounterId() {
      if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') return null;
      try {
        var bytes = new Uint8Array(16);
        cryptoApi.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
      } catch (error) { return null; }
    }
    function normalizeIntent(characterId, intent) {
      if (!validId(characterId) || !intent || typeof intent.rewardId !== 'string' ||
          !/^[1-9][0-9]*$/.test(intent.rewardId) || typeof intent.encounterId !== 'string' ||
          !/^[0-9a-f]{32}$/.test(intent.encounterId) || typeof intent.monsterId !== 'string' ||
          !intent.monsterId || !Number.isInteger(intent.exp) || intent.exp < 0 || intent.exp > 1000000000 ||
          intent.gold !== 0 || !Array.isArray(intent.drops) || intent.drops.length > 100 ||
          !Array.isArray(intent.cards) || intent.cards.length > 100 ||
          typeof intent.createdAt !== 'string' || !intent.createdAt || intent.createdAt.length > 64) return null;
      var drops = [], cards = [];
      for (var i = 0; i < intent.drops.length; i++) {
        var drop = intent.drops[i];
        if (!drop || typeof drop.id !== 'string' || !drop.id || typeof drop.name !== 'string' || !drop.name) return null;
        drops.push({ id: drop.id, name: drop.name });
      }
      for (var j = 0; j < intent.cards.length; j++) {
        var card = intent.cards[j];
        if (!card || typeof card.cardId !== 'string' ||
            (E.CARDS && !Object.prototype.hasOwnProperty.call(E.CARDS, card.cardId)) ||
            !Number.isInteger(card.stars) || card.stars < 1 || card.stars > 3 ||
            !Number.isInteger(card.quantity) || card.quantity < 1 || card.quantity > 1000000) return null;
        cards.push({ cardId: card.cardId, stars: card.stars, quantity: card.quantity });
      }
      return {
        encounterId: intent.encounterId, monsterId: intent.monsterId, exp: intent.exp, gold: 0,
        drops: drops, cards: cards, createdAt: intent.createdAt
      };
    }
    function validateRecord(entry, characterId) {
      if (!entry || entry.schemaVersion !== 1 || entry.characterId !== characterId ||
          entry.key !== makeKey(characterId, entry.rewardId) ||
          typeof entry.rewardId !== 'string' || !/^[1-9][0-9]*$/.test(entry.rewardId) ||
          typeof entry.encounterId !== 'string' || !/^[0-9a-f]{32}$/.test(entry.encounterId) ||
          !entry.payload || entry.payload.encounterId !== entry.encounterId ||
          typeof entry.payloadDigest !== 'string' || typeof entry.payloadCanonical !== 'string' ||
          entry.payloadCanonical !== stable(entry.payload) || STATES.indexOf(entry.status) < 0 ||
          !entry.timestamps || !entry.timestamps.prepared) return false;
      try { return entry.payloadDigest === digest(entry.payload); } catch (error) { return false; }
    }

    function open() {
      try { checkpoint('idb.open.before'); } catch (error) { return Promise.reject(error); }
      if (adapter) return Promise.resolve(adapter);
      if (!indexedDB || typeof indexedDB.open !== 'function') return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'));
      if (!dbPromise) dbPromise = new Promise(function (resolve, reject) {
        var request;
        try { request = indexedDB.open(DB_NAME, DB_VERSION); }
        catch (error) { reject(new Error('INDEXEDDB_OPEN_FAILED')); return; }
        request.onupgradeneeded = function () {
          var db = request.result;
          if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
            var journal = db.createObjectStore(JOURNAL_STORE, { keyPath: 'key' });
            journal.createIndex('byCharacter', 'characterId', { unique: false });
            journal.createIndex('byEncounter', ['characterId', 'encounterId'], { unique: true });
          }
          if (!db.objectStoreNames.contains(QUARANTINE_STORE)) {
            var quarantine = db.createObjectStore(QUARANTINE_STORE, { keyPath: 'key' });
            quarantine.createIndex('byCharacter', 'characterId', { unique: false });
          }
        };
        request.onsuccess = function () {
          var db = request.result;
          db.onversionchange = function () { db.close(); dbPromise = null; };
          try { checkpoint('idb.open.after'); resolve(makeIndexedDbAdapter(db)); }
          catch (error) { reject(error); }
        };
        request.onerror = function () { reject(new Error('INDEXEDDB_OPEN_FAILED')); };
        request.onblocked = function () { reject(new Error('INDEXEDDB_BLOCKED')); };
      });
      return dbPromise.catch(function (error) { dbPromise = null; throw error; });
    }

    function makeIndexedDbAdapter(db) {
      function requestPromise(request) {
        return new Promise(function (resolve, reject) {
          request.onsuccess = function () { resolve(request.result); };
          request.onerror = function () { reject(request.error || new Error('INDEXEDDB_REQUEST_FAILED')); };
        });
      }
      function transactionPromise(tx) {
        return new Promise(function (resolve, reject) {
          tx.oncomplete = function () { resolve(); };
          tx.onabort = tx.onerror = function () { reject(tx.error || new Error('INDEXEDDB_TRANSACTION_FAILED')); };
        });
      }
      return {
        get: function (storeName, key) {
          var tx = db.transaction([storeName], 'readonly');
          var done = transactionPromise(tx);
          return Promise.all([requestPromise(tx.objectStore(storeName).get(key)), done]).then(function (values) { return values[0] || null; });
        },
        put: function (storeName, value) {
          var tx = db.transaction([storeName], 'readwrite');
          var done = transactionPromise(tx);
          tx.objectStore(storeName).put(value);
          return done.then(function () { return clone(value); });
        },
        listByCharacter: function (storeName, characterId) {
          var tx = db.transaction([storeName], 'readonly');
          var done = transactionPromise(tx);
          var request = tx.objectStore(storeName).index('byCharacter').getAll(characterId);
          return Promise.all([requestPromise(request), done]).then(function (values) { return values[0] || []; });
        }
      };
    }

    function runExclusive(characterId, callback) {
      if (!validId(characterId) || typeof callback !== 'function') return Promise.resolve({ ok: false, reason: 'BAD_LOCK_ARGUMENT' });
      if (!locks || typeof locks.request !== 'function') return Promise.resolve({ ok: false, reason: 'WEB_LOCKS_UNAVAILABLE' });
      var entered = false;
      var request;
      try {
        request = locks.request('eldoria:reward:' + characterId, { mode: 'exclusive', ifAvailable: true }, async function (lock) {
          entered = true;
          if (!lock) return { ok: false, reason: 'REWARD_LOCK_BUSY' };
          lockHeld[characterId] = true;
          try {
            checkpoint('lock.acquired', { characterId: characterId });
            var value = await callback();
            return value && typeof value.ok === 'boolean' ? value : { ok: true, value: value };
          } catch (error) {
            return { ok: false, reason: error.message || 'REWARD_CALLBACK_FAILED' };
          } finally { delete lockHeld[characterId]; }
        });
      } catch (error) { return Promise.resolve({ ok: false, reason: 'REWARD_LOCK_FAILED' }); }
      return Promise.resolve(request).then(function (value) {
        if (!entered) return { ok: false, reason: 'REWARD_LOCK_NOT_GRANTED' };
        return value || { ok: false, reason: 'REWARD_LOCK_NOT_GRANTED' };
      }).catch(function () { return { ok: false, reason: 'REWARD_LOCK_FAILED' }; });
    }

    function quarantineRecord(characterId, sourceKey, existing, reason, conflictingPayload) {
      return open().then(function (db) {
        quarantineCounter += 1;
        var key = characterId + ':' + sourceKey + ':' + now() + ':' + quarantineCounter;
        var evidence = {
          schemaVersion: 1, key: key, characterId: characterId, sourceKey: sourceKey, reason: reason,
          existing: existing ? clone(existing) : null,
          conflictingPayload: conflictingPayload ? clone(conflictingPayload) : null,
          quarantinedAt: now()
        };
        checkpoint('quarantine.write.before', { characterId: characterId, reason: reason });
        return db.put(QUARANTINE_STORE, evidence).then(function () {
          checkpoint('quarantine.write.after', { characterId: characterId, reason: reason });
          if (!existing) return { ok: true, evidence: clone(evidence) };
          existing.status = 'quarantined';
          existing.updatedAt = evidence.quarantinedAt;
          existing.timestamps = existing.timestamps || {};
          existing.timestamps.quarantined = evidence.quarantinedAt;
          existing.quarantineReason = reason;
          return db.put(JOURNAL_STORE, existing).then(function () { return { ok: true, evidence: clone(evidence) }; });
        });
      });
    }

    function prepare(characterId, intent) {
      if (!lockHeld[characterId]) return Promise.resolve({ ok: false, reason: 'REWARD_LOCK_REQUIRED' });
      var payload = normalizeIntent(characterId, intent);
      if (!payload) return Promise.resolve({ ok: false, reason: 'BAD_REWARD_INTENT' });
      var payloadDigest;
      try { payloadDigest = digest(payload); } catch (error) { return Promise.resolve({ ok: false, reason: error.message }); }
      return open().then(function (db) {
        var key = makeKey(characterId, intent.rewardId);
        checkpoint('journal.prepare.before', { characterId: characterId, rewardId: intent.rewardId });
        return db.get(JOURNAL_STORE, key).then(function (existing) {
          if (existing) {
            if (!validateRecord(existing, characterId)) {
              return quarantineRecord(characterId, key, existing, 'EXISTING_JOURNAL_INVALID')
                .then(function () { return { ok: false, reason: 'EXISTING_JOURNAL_INVALID', quarantined: true }; });
            }
            if (existing.status === 'quarantined') return { ok: false, reason: 'JOURNAL_QUARANTINED' };
            if (existing.status === 'completed') return { ok: false, reason: 'REWARD_ALREADY_COMPLETED' };
            if (existing.payloadDigest !== payloadDigest || stable(existing.payload) !== stable(payload)) {
              return quarantineRecord(characterId, key + ':incoming', null, 'REWARD_ID_PAYLOAD_CONFLICT', payload)
                .then(function () { return { ok: false, reason: 'REWARD_ID_PAYLOAD_CONFLICT', quarantined: true }; });
            }
            if (!ensureActiveMarker(characterId)) return { ok: false, reason: 'REWARD_MARKER_WRITE_FAILED', durable: true };
            return { ok: true, alreadyPrepared: true, entry: clone(existing) };
          }
          return db.listByCharacter(JOURNAL_STORE, characterId).then(function (entries) {
            var encounter = entries.find(function (entry) { return entry.encounterId === intent.encounterId; });
            if (encounter && encounter.rewardId !== intent.rewardId) {
              return quarantineRecord(characterId, encounter.key, encounter, 'ENCOUNTER_ID_REUSED', payload)
                .then(function () { return quarantineRecord(characterId, key + ':incoming', null, 'ENCOUNTER_ID_REUSED', payload); })
                .then(function () { return { ok: false, reason: 'ENCOUNTER_ID_REUSED', quarantined: true }; });
            }
            var createdAt = payload.createdAt;
            var entry = {
              schemaVersion: 1, key: key, characterId: characterId, rewardId: intent.rewardId,
              encounterId: intent.encounterId, payload: payload, payloadDigest: payloadDigest,
              payloadCanonical: stable(payload), status: 'prepared', createdAt: createdAt, updatedAt: createdAt,
              timestamps: { prepared: createdAt }
            };
            checkpoint('journal.prepare.write', { characterId: characterId, rewardId: intent.rewardId });
            return db.put(JOURNAL_STORE, entry).then(function () {
              checkpoint('journal.prepare.after', { characterId: characterId, rewardId: intent.rewardId });
              if (!ensureActiveMarker(characterId)) return { ok: false, reason: 'REWARD_MARKER_WRITE_FAILED', durable: true };
              return { ok: true, entry: clone(entry) };
            });
          });
        });
      }).catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_WRITE_FAILED' }; });
    }

    function get(characterId, rewardId) {
      if (!validId(characterId) || typeof rewardId !== 'string' || !rewardId) return Promise.resolve({ ok: false, reason: 'BAD_JOURNAL_KEY' });
      return open().then(function (db) { return db.get(JOURNAL_STORE, makeKey(characterId, rewardId)); })
        .then(function (entry) {
          if (entry && !validateRecord(entry, characterId)) return { ok: false, reason: 'JOURNAL_CORRUPT', entry: clone(entry) };
          return { ok: true, entry: entry ? clone(entry) : null };
        })
        .catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_READ_FAILED' }; });
    }

    function list(characterId) {
      if (!validId(characterId)) return Promise.resolve({ ok: false, reason: 'BAD_CHARACTER_ID' });
      return open().then(function (db) { return db.listByCharacter(JOURNAL_STORE, characterId); })
        .then(function (entries) {
          var invalid = entries.filter(function (entry) { return !validateRecord(entry, characterId); });
          return invalid.length ? { ok: false, reason: 'JOURNAL_CORRUPT', entries: invalid.map(clone) } : { ok: true, entries: entries.map(clone) };
        })
        .catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_READ_FAILED' }; });
    }

    function transition(characterId, rewardId, nextStatus, details) {
      if (!lockHeld[characterId]) return Promise.resolve({ ok: false, reason: 'REWARD_LOCK_REQUIRED' });
      if (!validId(characterId) || typeof rewardId !== 'string' || !rewardId || STATES.indexOf(nextStatus) < 0) {
        return Promise.resolve({ ok: false, reason: 'BAD_TRANSITION_ARGUMENT' });
      }
      return open().then(function (db) {
        var key = makeKey(characterId, rewardId);
        checkpoint('journal.transition.before', { characterId: characterId, rewardId: rewardId, nextStatus: nextStatus });
        return db.get(JOURNAL_STORE, key).then(function (entry) {
          if (!entry || !validateRecord(entry, characterId)) return { ok: false, reason: 'JOURNAL_ENTRY_MISSING_OR_CORRUPT' };
          if (entry.status === nextStatus) return { ok: true, alreadyTransitioned: true, entry: clone(entry) };
          if (!NEXT[entry.status] || NEXT[entry.status].indexOf(nextStatus) < 0) return { ok: false, reason: 'INVALID_JOURNAL_TRANSITION' };
          entry.status = nextStatus;
          entry.updatedAt = now();
          entry.timestamps[nextStatus] = entry.updatedAt;
          if (details && typeof details === 'object') entry.details = clone(details);
          checkpoint('journal.transition.write', { characterId: characterId, rewardId: rewardId, nextStatus: nextStatus });
          return db.put(JOURNAL_STORE, entry).then(function () {
            checkpoint('journal.transition.after', { characterId: characterId, rewardId: rewardId, nextStatus: nextStatus });
            return { ok: true, entry: clone(entry) };
          });
        });
      }).catch(function (error) { return { ok: false, reason: error.message || 'JOURNAL_WRITE_FAILED' }; });
    }

    function quarantine(characterId, rewardId, reason, conflictingPayload) {
      if (!lockHeld[characterId]) return Promise.resolve({ ok: false, reason: 'REWARD_LOCK_REQUIRED' });
      if (!validId(characterId) || typeof rewardId !== 'string' || !rewardId || typeof reason !== 'string' || !reason) {
        return Promise.resolve({ ok: false, reason: 'BAD_QUARANTINE_ARGUMENT' });
      }
      return get(characterId, rewardId).then(function (result) {
        if (!result.ok && result.entry) return quarantineRecord(characterId, makeKey(characterId, rewardId), result.entry, reason, conflictingPayload);
        if (!result.ok) return result;
        return quarantineRecord(characterId, makeKey(characterId, rewardId), result.entry, reason, conflictingPayload);
      }).then(function (value) { return value && value.ok ? { ok: true, evidence: value.evidence } : value; })
        .catch(function (error) { return { ok: false, reason: error.message || 'QUARANTINE_FAILED' }; });
    }

    function listQuarantine(characterId) {
      if (!validId(characterId)) return Promise.resolve({ ok: false, reason: 'BAD_CHARACTER_ID' });
      return open().then(function (db) { return db.listByCharacter(QUARANTINE_STORE, characterId); })
        .then(function (entries) { return { ok: true, entries: entries.map(clone) }; })
        .catch(function (error) { return { ok: false, reason: error.message || 'QUARANTINE_READ_FAILED' }; });
    }

    return {
      runExclusive: runExclusive, prepare: prepare, get: get, list: list,
      transition: transition, quarantine: quarantine, listQuarantine: listQuarantine,
      isActive: isActive, reconcileActivation: reconcileActivation, createEncounterId: createEncounterId, checkpoint: checkpoint,
      databaseName: DB_NAME, databaseVersion: DB_VERSION
    };
  }

  E.RewardRecovery = { create: create, STATES: STATES.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.RewardRecovery;
})(typeof window !== 'undefined' ? window : globalThis);