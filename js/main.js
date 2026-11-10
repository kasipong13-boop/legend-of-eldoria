/* Legend of Eldoria - Prototype 0.2
   Connects the original 0.1 game loop to the transactional Save system. */
(function () {
  var E = window.ELDORIA;
  function $(id) { return document.getElementById(id); }

  var player = {
    level: 1, exp: 0, gold: 0, jelly: 0, items: { jelly: 0 },
    maxHp: E.RULES.playerMaxHp, hp: E.RULES.playerMaxHp
  };
  var saveSystem = null;
  var currentSave = null;
  var active = false;
  var saveLocked = false;
  var pendingSaveTx = null;
  var pendingBattleReward = null;
  var rewardRecoveryBlocked = false;
  var rewardRecovery = E.RewardRecovery.create();
  var activeEncounterId = null;
  var screens = ['screen-title', 'screen-select', 'screen-create', 'screen-world', 'screen-card-collection', 'screen-battle', 'screen-result'];
  var characterCreationReturnScreen = 'screen-title';

  function show(id) {
    screens.forEach(function (s) { $(s).classList.toggle('active', s === id); });
  }
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 4000);
  }
  var toastTimer = null;

  function applySave(save) {
    currentSave = save;
    player.level = save.stats.level;
    player.exp = save.stats.exp;
    player.hp = save.stats.hp;
    player.maxHp = save.stats.maxHp;
    player.gold = save.gold;
    player.items = JSON.parse(JSON.stringify(save.items));
    player.jelly = save.items.jelly;
    if (save.world && save.world.map && !E.World.setMap(save.world.map, { c: save.world.c, r: save.world.r })) E.World.setMap('greenvale', E.World.startPosition());
    updateHud();
  }

  function worldSnapshot(target) {
    var p = E.World.getPosition();
    target.world = { map: E.World.getMapId(), c: p.c, r: p.r };
    target.stats.level = player.level;
    target.stats.exp = player.exp;
    target.stats.hp = player.hp;
    target.stats.maxHp = player.maxHp;
    target.gold = player.gold;
    target.items = JSON.parse(JSON.stringify(player.items || { jelly: player.jelly }));
    target.items.jelly = player.jelly;
    return target;
  }

  function persist(reason) {
    if (!saveSystem || !currentSave || !active) return { ok: false, reason: 'NO_ACTIVE_SAVE' };
    if (pendingSaveTx) {
      var resumedPending = saveSystem.resume(pendingSaveTx);
      if (resumedPending.ok) { currentSave = resumedPending.save; pendingSaveTx = null; return resumedPending; }
      return { ok: false, reason: resumedPending.reason || 'RESUME_FAILED', tx: pendingSaveTx };
    }
    var next = worldSnapshot(JSON.parse(JSON.stringify(currentSave)));
    if (E.Save.contentKey(next) === E.Save.contentKey(currentSave)) return { ok: true, unchanged: true, save: currentSave };
    var result = saveSystem.commit(currentSave, next);
    if (result.ok) currentSave = result.save;
    else if (result.tx && result.durable) {
      var resumed = saveSystem.resume(result.tx);
      if (resumed.ok) { currentSave = resumed.save; return resumed; }
      pendingSaveTx = result.tx;
    }
    if (!result.ok) { console.warn('Eldoria save failed (' + (reason || 'autosave') + '):', result); lockGame('Saving failed (' + (result.reason || 'unknown error') + '). Your progress is locked to prevent data loss.'); }
    return result;
  }

  function lockGame(message) {
    saveLocked = true;
    E.World.pause();
    var overlay = $('save-lock');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'save-lock';
      overlay.className = 'save-lock';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = '<div class="save-lock-card"><h2>Save needs attention</h2><p id="save-lock-message"></p><button id="btn-save-retry" class="btn primary" type="button">Retry Save</button><button id="btn-save-title" class="btn" type="button">Return to Title</button></div>';
      $('app').appendChild(overlay);
      $('btn-save-retry').addEventListener('click', async function () {
        var result = persist('manual-retry');
        if (result && result.ok && currentSave) {
          var locked = await rewardRecovery.runExclusive(currentSave.characterId, async function () {
            var recoveredReward = await recoverRewardJournal(currentSave);
            if (!recoveredReward) return { ok: false, reason: 'RECOVERY_FAILED' };
            currentSave = recoveredReward;
            rewardRecoveryBlocked = false;
            syncPlayerFromSave(currentSave);
            return { ok: true };
          });
          if (!locked.ok) result = locked;
        }
        if (result && result.ok) {
          saveLocked = false; active = true; overlay.classList.remove('show');
          show('screen-world'); E.World.resume(); toast('Save completed.', 2500);
        } else {
          $('save-lock-message').textContent = 'The save is still not complete (' + (result.reason || 'recovery failed') + '). Your progress is locked to prevent data loss. Try again.';
        }
      });
      $('btn-save-title').addEventListener('click', function () {
        // Do not abandon a victory reward that exists only as an in-memory retry intent.
        if (pendingBattleReward || rewardRecoveryBlocked) {
          $('save-lock-message').textContent = 'A victory reward is still waiting for recovery. Retry after browser storage is available; returning to the title is temporarily disabled.';
          return;
        }
        // Leaving the game does not discard or overwrite the current save.
        saveLocked = false; active = false; overlay.classList.remove('show'); show('screen-title');
      });
    }
    $('save-lock-message').textContent = message || 'Saving could not be completed. Your progress is locked to prevent data loss.';
    overlay.classList.add('show');
  }

  var ITEM_NAMES = { jelly: 'Poring Jelly', wolf_fang: 'Wolf Fang', ancient_fang: 'Ancient Fang' };
  function renderInventory() {
    var host = $('inventory-list');
    if (!host) return;
    host.innerHTML = '';
    var ids = Object.keys(player.items || {}).filter(function (id) { return player.items[id] > 0; }).sort();
    if (!ids.length) {
      var empty = document.createElement('p'); empty.className = 'inventory-empty'; empty.textContent = 'Your inventory is empty.'; host.appendChild(empty); return;
    }
    ids.forEach(function (id) {
      var row = document.createElement('div'); row.className = 'inventory-row';
      var name = document.createElement('span'); name.textContent = ITEM_NAMES[id] || id.replace(/_/g, ' ');
      var count = document.createElement('strong'); count.textContent = '× ' + player.items[id];
      row.appendChild(name); row.appendChild(count); host.appendChild(row);
    });
  }

  function updateHud() {
    var need = E.expToNext(player.level);
    $('hud-level').textContent = 'Lv ' + player.level;
    $('hud-hp-fill').style.width = (100 * player.hp / player.maxHp) + '%';
    $('hud-hp-text').textContent = 'HP ' + player.hp + ' / ' + player.maxHp;
    $('hud-exp-fill').style.width = (100 * player.exp / need) + '%';
    $('hud-exp-text').textContent = 'EXP ' + player.exp + ' / ' + need;
    $('hud-gold').textContent = player.gold + ' gold';
    $('hud-jelly').textContent = player.jelly + ' jelly';
    renderInventory();
  }

  function applyRewardToSave(target, reward) {
    target.stats.exp += reward.exp;
    // Preserve the character's existing Gold; monster rewards never grant Gold.
    reward.drops.forEach(function (d) {
      if (!Object.prototype.hasOwnProperty.call(target.items, d.id)) target.items[d.id] = 0;
      target.items[d.id]++;
    });
    while (target.stats.exp >= E.expToNext(target.stats.level)) {
      target.stats.exp -= E.expToNext(target.stats.level);
      target.stats.level++;
      target.stats.maxHp += E.levelUpMaxHp;
    }
    target.stats.hp = target.stats.maxHp;
  }

  function commitPendingSave(save, pendingSave) {
    var committed = saveSystem.commit(save, pendingSave);
    if (committed.ok) { currentSave = committed.save; return Promise.resolve(currentSave); }
    if (committed.tx && committed.durable) {
      return Promise.resolve(saveSystem.resume(committed.tx)).then(function (resumed) {
        if (resumed.ok) { currentSave = resumed.save; return currentSave; }
        pendingSaveTx = committed.tx; return null;
      });
    }
    return Promise.resolve(null);
  }

  async function transitionJournal(entry, target) {
    var order = ['prepared', 'sidecarStaged', 'savePending', 'cardsClaimed', 'saveClaimed', 'completed'];
    var current = entry.status;
    while (current !== target) {
      var next = order[order.indexOf(current) + 1];
      if (!next) return { ok: false, reason: 'INVALID_JOURNAL_STATE' };
      var result = await rewardRecovery.transition(entry.characterId, entry.rewardId, next);
      if (!result.ok) return result;
      entry = result.entry;
      current = next;
    }
    return { ok: true, entry: entry };
  }

  async function settleJournalEntry(save, entry) {
    var payload = entry.payload;
    var rewardId = entry.rewardId;
    var seq = Number(rewardId);
    if (!payload || payload.gold !== 0 || payload.monsterId !== entry.payload.monsterId) {
      await rewardRecovery.quarantine(save.characterId, rewardId, 'JOURNAL_PAYLOAD_INVALID');
      return null;
    }
    var stagedCards = E.CardCollection.stageReward(save.characterId, rewardId, payload.cards);
    if (!stagedCards.ok) return null;
    if (entry.status === 'prepared') {
      var stagedState = await transitionJournal(entry, 'sidecarStaged');
      if (!stagedState.ok) return null;
      entry = stagedState.entry;
    }
    if (!save.pendingReward && seq === save.nextRewardSeq) {
      var pending = E.Save.withPendingReward(save,
        { exp: payload.exp, gold: 0, drops: payload.drops }, payload.monsterId, payload.createdAt);
      if (!pending.ok) return null;
      var committedSave = await commitPendingSave(save, pending.save);
      if (!committedSave) return null;
      save = committedSave;
    }
    if (save.pendingReward) {
      if (String(save.pendingReward.seq) !== rewardId ||
          save.pendingReward.monsterId !== payload.monsterId ||
          save.pendingReward.exp !== payload.exp || save.pendingReward.gold !== 0 ||
          JSON.stringify(save.pendingReward.drops) !== JSON.stringify(payload.drops)) {
        await rewardRecovery.quarantine(save.characterId, rewardId, 'SAVE_JOURNAL_PAYLOAD_MISMATCH', save.pendingReward);
        return null;
      }
      if (entry.status === 'sidecarStaged') {
        var pendingState = await transitionJournal(entry, 'savePending');
        if (!pendingState.ok) return null;
        entry = pendingState.entry;
      }
      var cardClaim = E.CardCollection.claimReward(save.characterId, rewardId);
      if (!cardClaim.ok || cardClaim.missingStage) {
        await rewardRecovery.quarantine(save.characterId, rewardId, 'MISSING_SIDECAR_STAGE');
        return null;
      }
      if (entry.status === 'savePending') {
        var cardState = await transitionJournal(entry, 'cardsClaimed');
        if (!cardState.ok) return null;
        entry = cardState.entry;
      }
      var claim = E.Save.withClaim(save, applyRewardToSave);
      if (!claim.ok) return null;
      var claimedSave = await commitPendingSave(save, claim.save);
      if (!claimedSave) return null;
      save = claimedSave;
      if (entry.status === 'cardsClaimed') {
        var saveClaimed = await transitionJournal(entry, 'saveClaimed');
        if (!saveClaimed.ok) return null;
        entry = saveClaimed.entry;
      }
    } else if (seq <= save.lastClaimedSeq) {
      var receiptCheck = E.CardCollection.claimReward(save.characterId, rewardId);
      if (!receiptCheck.ok || receiptCheck.missingStage) {
        await rewardRecovery.quarantine(save.characterId, rewardId, 'CLAIMED_SAVE_WITHOUT_CARD_RECEIPT');
        return null;
      }
      if (entry.status === 'sidecarStaged' || entry.status === 'savePending') {
        var cardFinal = await transitionJournal(entry, 'cardsClaimed');
        if (!cardFinal.ok) return null;
        entry = cardFinal.entry;
      }
      if (entry.status === 'cardsClaimed') {
        var saveFinal = await transitionJournal(entry, 'saveClaimed');
        if (!saveFinal.ok) return null;
        entry = saveFinal.entry;
      }
    } else {
      await rewardRecovery.quarantine(save.characterId, rewardId, 'REWARD_SEQUENCE_GAP');
      return null;
    }
    if (entry.status === 'saveClaimed') {
      var completed = await transitionJournal(entry, 'completed');
      if (!completed.ok) return null;
    }
    return save;
  }

  async function settlePendingReward(save) {
    if (!save || !save.pendingReward) return save;
    var rewardId = String(save.pendingReward.seq);
    var found = await rewardRecovery.get(save.characterId, rewardId);
    if (!found.ok) return null;
    if (found.entry) return settleJournalEntry(save, found.entry);
    var collection = E.CardCollection.get(save.characterId);
    // Only positively identified pre-acquisition sidecars may use the legacy path.
    if (!collection.ok || (collection.source !== 'starter' && collection.source !== 'legacy')) return null;
    var cardClaim = E.CardCollection.claimReward(save.characterId, rewardId);
    if (!cardClaim.ok || !cardClaim.missingStage) return null;
    var claim = E.Save.withClaim(save, applyRewardToSave);
    if (!claim.ok) return null;
    return commitPendingSave(save, claim.save);
  }

  async function recoverRewardJournal(save) {
    if (!save) return null;
    var listed = await rewardRecovery.list(save.characterId);
    if (!listed.ok) return null;
    var entries = listed.entries;
    var incomplete = entries.filter(function (entry) { return entry.status !== 'completed' && entry.status !== 'quarantined'; });
    var collection = E.CardCollection.get(save.characterId);
    if (!collection.ok) return null;
    var sidecarPending = collection.data.pendingRewards || [];
    var orphan = sidecarPending.find(function (pending) {
      return !entries.some(function (entry) { return entry.rewardId === pending.rewardId && entry.status !== 'quarantined'; });
    });
    if (orphan) {
      await rewardRecovery.quarantine(save.characterId, orphan.rewardId, 'ORPHAN_SIDECAR_REWARD');
      return null;
    }
    if (incomplete.length > 1) {
      for (var i = 0; i < incomplete.length; i++) await rewardRecovery.quarantine(save.characterId, incomplete[i].rewardId, 'MULTIPLE_INCOMPLETE_REWARDS');
      return null;
    }
    var completedAhead = entries.some(function (entry) {
      return entry.status === 'completed' && Number(entry.rewardId) > save.lastClaimedSeq;
    });
    if (completedAhead) {
      var ahead = entries.find(function (entry) { return entry.status === 'completed' && Number(entry.rewardId) > save.lastClaimedSeq; });
      await rewardRecovery.quarantine(save.characterId, ahead.rewardId, 'COMPLETED_JOURNAL_AHEAD_OF_SAVE');
      return null;
    }
    if (!incomplete.length) return save.pendingReward ? settlePendingReward(save) : save;
    var entry = incomplete[0], seq = Number(entry.rewardId);
    if (seq > save.nextRewardSeq || (seq > save.lastClaimedSeq + 1 && seq !== save.nextRewardSeq)) {
      await rewardRecovery.quarantine(save.characterId, entry.rewardId, 'REWARD_SEQUENCE_GAP');
      return null;
    }
    if (save.pendingReward && String(save.pendingReward.seq) !== entry.rewardId) {
      await rewardRecovery.quarantine(save.characterId, entry.rewardId, 'SAVE_JOURNAL_ID_MISMATCH', save.pendingReward);
      return null;
    }
    return settleJournalEntry(save, entry);
  }

  async function retryPendingBattleReward() {
    if (!currentSave) return false;
    var recovered = await recoverRewardJournal(currentSave);
    if (!recovered || recovered.pendingReward) return false;
    currentSave = recovered;
    pendingBattleReward = null;
    syncPlayerFromSave(currentSave);
    return true;
  }

  function beginFromSave(save) {
    applySave(save);
    active = true;
    show('screen-world');
    E.World.respawn(false);
    E.World.resume();
    toast('Tap the ground to walk, or use the arrows. Touch the pink Poring to fight.', 5000);
  }

  var hairColors = ['#302018', '#65402a', '#e4c36b', '#a83f32', '#426fb7', '#43834c', '#b9c4cf', '#8052a2'];

  function makeCharacterAvatar(profile, small) {
    var avatar = document.createElement('div');
    avatar.className = 'character-avatar' + (small ? ' small' : '') + (profile.gender === 'female' ? ' female' : '');
    avatar.setAttribute('aria-hidden', 'true');
    var body = document.createElement('span'); body.className = 'avatar-body';
    var head = document.createElement('span'); head.className = 'avatar-head';
    var hair = document.createElement('i'); hair.className = 'avatar-hair style-' + profile.hairStyle;
    hair.style.backgroundColor = hairColors[profile.hairColor] || hairColors[0];
    var eyeL = document.createElement('i'); eyeL.className = 'avatar-eye left';
    var eyeR = document.createElement('i'); eyeR.className = 'avatar-eye right';
    head.appendChild(hair); head.appendChild(eyeL); head.appendChild(eyeR);
    avatar.appendChild(body); avatar.appendChild(head);
    return avatar;
  }

  function updateCreationPreview() {
    var host = $('creation-avatar');
    if (!host) return;
    var profile = {
      gender: $('character-gender').value,
      hairStyle: Number($('character-hair').value),
      hairColor: Number($('character-color').value)
    };
    var avatar = makeCharacterAvatar(profile, false);
    avatar.id = 'creation-avatar';
    host.replaceWith(avatar);
  }

  function openCharacterCreation() {
    if (!saveSystem || !saveSystem.probe()) {
      $('save-status').textContent = 'Save storage is unavailable in this browser.';
      return;
    }
    var listed = saveSystem.listCharacters();
    var chars = listed.characters || [];
    var blocked = chars.filter(function (c) { return c.state === 'damaged' || c.state === 'recoveryIncomplete' || c.state === 'creating'; });
    if (blocked.length) {
      refreshTitleState();
      $('create-error').textContent = 'Recovery required. Existing character data is protected; creating another character is temporarily disabled.';
      return;
    }
    screens.forEach(function (screen) {
      if ($(screen).classList.contains('active')) characterCreationReturnScreen = screen;
    });
    $('btn-create-confirm').disabled = false;
    $('create-error').textContent = '';
    $('character-name').value = '';
    updateCreationPreview();
    show('screen-create');
    $('character-name').focus();
  }

  function createCharacter() {
    $('create-error').textContent = '';
    if (!saveSystem || !saveSystem.probe()) {
      $('create-error').textContent = 'Save storage is unavailable in this browser.';
      return;
    }
    var created = saveSystem.createCharacter({
      name: $('character-name').value,
      gender: $('character-gender').value,
      hairStyle: Number($('character-hair').value),
      hairColor: Number($('character-color').value)
    }, { maxHp: E.RULES.playerMaxHp, start: E.World.startPosition() });
    if (!created.ok) {
      var messages = {
        NAME_empty: 'Enter a character name.',
        NAME_tooLong: 'Name must be 1–16 characters.',
        NAME_control: 'Name contains an unsupported control character.',
        NAME_format: 'Name contains unsupported formatting characters.',
        APPEARANCE_gender: 'Choose a valid gender.',
        APPEARANCE_hairStyle: 'Choose a valid hairstyle.',
        APPEARANCE_hairColor: 'Choose a valid hair color.',
        NO_SECURE_RANDOM: 'Secure character ID generation is unavailable. No save was created.'
      };
      $('create-error').textContent = messages[created.reason] || ('Could not create character (' + created.reason + ').');
      refreshTitleState();
      var afterFailure = saveSystem.listCharacters().characters || [];
      var recoveryBlocked = afterFailure.some(function (c) { return c.state === 'damaged' || c.state === 'recoveryIncomplete' || c.state === 'creating'; });
      $('btn-create-confirm').disabled = recoveryBlocked;
      if (recoveryBlocked) $('create-error').textContent = 'Character creation was interrupted. The save is protected; reload to retry recovery before creating another character.';
      return;
    }
    beginFromSave(created.save);
    refreshTitleState();
  }

  function renderCharacterSelection() {
    var host = $('character-list');
    host.textContent = '';
    var listed = saveSystem ? saveSystem.listCharacters() : { characters: [] };
    var chars = listed.characters || [];
    var ready = chars.filter(function (c) { return c.state === 'ready' && c.save; });
    var blocked = chars.filter(function (c) { return c.state !== 'ready'; });

    if (!chars.length) {
      var empty = document.createElement('p');
      empty.className = 'character-empty';
      empty.textContent = 'No characters yet. Create a character to begin.';
      host.appendChild(empty);
    }

    ready.forEach(function (entry) {
      var row = document.createElement('div'); row.className = 'character-row';
      var info = document.createElement('div'); info.className = 'character-info';
      info.appendChild(makeCharacterAvatar(entry.save.profile, true));
      var details = document.createElement('div');
      var name = document.createElement('strong'); name.textContent = entry.save.profile.name;
      var meta = document.createElement('small');
      meta.textContent = entry.save.profile.job.toUpperCase() + ' · Lv ' + entry.save.stats.level;
      details.appendChild(name); details.appendChild(meta);
      info.appendChild(details);
      var play = document.createElement('button'); play.type = 'button'; play.className = 'btn primary'; play.textContent = 'Play';
      play.addEventListener('click', function () { loadSelectedCharacter(entry.id); });
      row.appendChild(info); row.appendChild(play); host.appendChild(row);
    });

    blocked.forEach(function (entry) {
      var row = document.createElement('div'); row.className = 'character-row blocked';
      var label = document.createElement('span');
      label.textContent = entry.save && entry.save.profile ? entry.save.profile.name + ' — Recovery required' : 'Character save requires recovery';
      row.appendChild(label); host.appendChild(row);
    });
    $('btn-new-character').disabled = blocked.length > 0;
    $('select-warning').textContent = blocked.length
      ? 'Some character records need recovery. They are protected and cannot be loaded or replaced. Reload to retry recovery.'
      : '';
  }

  function startNewGame() { openCharacterCreation(); }

  function loadSelectedCharacter(id) {
    if (!saveSystem) return;
    var loaded = saveSystem.loadCharacter(id);
    if (!loaded.ok) {
      $('select-warning').textContent = 'Save recovery required: ' + loaded.reason + '. Existing data remains protected.';
      refreshTitleState();
      renderCharacterSelection();
      return;
    }
    var recovered = recoverRewardJournal(loaded.save);
    var settled = recovered && (recovered.pendingReward ? settlePendingReward(recovered) : recovered);
    if (!settled) {
      rewardRecoveryBlocked = true;
      beginFromSave(loaded.save);
      lockGame('A saved victory reward needs recovery. Existing data is protected; Retry Save after storage is available.');
      return;
    }
    rewardRecoveryBlocked = false;
    beginFromSave(settled);
  }

  function continueGame() {
    if (!saveSystem) return;
    renderCharacterSelection();
    show('screen-select');
  }

  function startBattle(monsterId) {
    var recovered = recoverRewardJournal(currentSave);
    if (!recovered || recovered.pendingReward) {
      rewardRecoveryBlocked = true;
      lockGame('A previous victory reward must be recovered before another battle can begin.');
      return;
    }
    rewardRecoveryBlocked = false;
    currentSave = recovered;
    var saved = persist('before-battle');
    if (!saved.ok) return;
    show('screen-battle');
    E.BattleUI.start({ hp: player.hp, maxHp: player.maxHp }, monsterId, onBattleEnd);
  }

  function onBattleEnd(result) {
    var list = $('result-list');
    list.innerHTML = '';
    function line(text, cls) {
      var li = document.createElement('li'); li.textContent = text;
      if (cls) li.className = cls; list.appendChild(li);
    }

    if (result.won) {
      var rw = E.rollRewards(result.monsterId);
      $('result-title').textContent = 'Victory!';
      var rewardId = String(currentSave.nextRewardSeq);
      var rolledCards = E.CardAcquisition.rollMonsterDrops(result.monsterId);
      pendingBattleReward = {
        rewardId: rewardId, monsterId: result.monsterId,
        reward: { exp: rw.exp, gold: 0, drops: rw.drops }, cards: rolledCards,
        createdAt: new Date().toISOString()
      };
      // Persist the complete battle reward intent before issuing the transactional Save reward.
      var stagedCards = E.CardCollection.stageBattleReward(currentSave.characterId, pendingBattleReward);
      var rewardSaved = false;
      if (stagedCards.ok) {
        // Save Schema v1 is intentionally unchanged; monster victories still store zero Gold.
        var durableReward = stagedCards.journal;
        var pending = durableReward && E.Save.withPendingReward(currentSave,
          { exp: durableReward.exp, gold: 0, drops: durableReward.drops }, durableReward.monsterId, durableReward.createdAt);
        if (pending && pending.ok) {
          var staged = saveSystem.commit(currentSave, pending.save);
          if (staged.ok) currentSave = staged.save;
          else if (staged.tx && staged.durable) {
            var retryStage = saveSystem.resume(staged.tx);
            if (retryStage.ok) currentSave = retryStage.save;
            else pendingSaveTx = staged.tx;
          }
          if (currentSave && currentSave.pendingReward && String(currentSave.pendingReward.seq) === rewardId) {
            var settled = settlePendingReward(currentSave);
            if (settled) { currentSave = settled; rewardSaved = true; }
          }
        }
      }
      if (rewardSaved) {
        player.exp = currentSave.stats.exp; player.level = currentSave.stats.level;
        player.gold = currentSave.gold; player.items = JSON.parse(JSON.stringify(currentSave.items)); player.jelly = currentSave.items.jelly;
        player.maxHp = currentSave.stats.maxHp; player.hp = currentSave.stats.hp;
        line('+' + rw.exp + ' EXP');
        rw.drops.forEach(function (d) { line('Dropped: ' + d.name, 'loot'); });
        stagedCards.cards.forEach(function (card) { var def = E.CARDS[card.cardId] || {}; line('Card acquired: ' + (def.name || card.cardId) + ' · ' + (def.rarity || 'Rarity unassigned'), 'card-loot'); });
        if (!rw.drops.length && !stagedCards.cards.length) line('No drops this time.');
        if (player.level > 1) line('Current level: ' + player.level, 'level');
        pendingBattleReward = null;
        $('btn-result').textContent = 'Return to the village';
      } else {
        line('Reward is pending and has not been confirmed as saved.');
        line('Do not close the game. Use Retry Save to finish safely.', 'loot');
        lockGame(stagedCards.ok
          ? 'Victory reward could not be fully saved. The reward is pending; retry will finish the same reward without rolling it again.'
          : 'Card reward storage is unavailable. Your victory reward is locked to prevent losing or duplicating cards; retry after storage is available.');
        $('btn-result').textContent = 'Retry Save';
      }
    } else {
      $('result-title').textContent = 'Defeated';
      line('You wake up safe in Greenvale Village.');
      var goldLost = Math.floor(player.gold * 0.10);
      player.gold -= goldLost;
      line(goldLost > 0 ? 'You lost ' + goldLost + ' gold (10%).' : 'No gold was lost.');
      player.hp = player.maxHp;
      $('btn-result').textContent = 'Wake up';
      persist('battle-defeat');
    }

    $('btn-result').onclick = function () {
      if (saveLocked) { var retryButton = $('btn-save-retry'); if (retryButton) retryButton.click(); return; }
      backToVillage(!result.won);
    };
    updateHud();
    show('screen-result');
  }

  function backToVillage(resetHero) {
    // Always move the Poring away after a battle; reset the hero only after defeat.
    if (resetHero) E.World.setMap('greenvale', E.World.startPosition());
    E.World.respawn(false);
    player.hp = player.maxHp;
    var saved = persist('return-village');
    if (!saved.ok) return;
    updateHud(); active = true;
    show('screen-world'); E.World.resume();
  }

  function renderCardCollection() {
    var result = E.CardCollection.get(currentSave.characterId);
    var ownedHost = $('collection-owned'), presetsHost = $('collection-presets');
    ownedHost.textContent = ''; presetsHost.textContent = '';
    if (!result.ok) {
      $('collection-summary').textContent = 'Card collection could not be loaded.';
      $('collection-source').textContent = 'Collection data is protected: ' + result.reason;
      var warning = document.createElement('p'); warning.className = 'collection-empty';
      warning.textContent = 'No data was reset. Check available browser storage before trying again.';
      ownedHost.appendChild(warning);
      return;
    }
    var data = result.data;
    var total = data.owned.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    $('collection-summary').textContent = total + ' owned card copies · ' + data.owned.length + ' card variants · ' + data.presets.length + (data.presets.length === 1 ? ' deck preset' : ' deck presets');
    $('collection-source').textContent = result.source === 'saved' ? 'Saved collection data' : 'Starter deck preview · not yet separately saved';
    if (!data.owned.length) {
      var empty = document.createElement('p'); empty.className = 'collection-empty';
      empty.textContent = 'No cards collected yet. Card rewards will be added in a later milestone.';
      ownedHost.appendChild(empty);
    } else {
      data.owned.forEach(function (item) {
        var def = E.CARDS[item.cardId] || {};
        var row = document.createElement('div'); row.className = 'collection-row';
        var info = document.createElement('div'), icon = document.createElement('span');
        var name = document.createElement('strong'), meta = document.createElement('small');
        icon.className = 'collection-icon'; icon.textContent = def.icon || '✦';
        name.textContent = def.name || item.cardId;
        meta.textContent = 'Star ' + item.stars + ' · ' + (def.rarity || 'Rarity unassigned') + ' · ' + (def.kind || 'Card');
        info.appendChild(icon); info.appendChild(name); info.appendChild(meta);
        var quantity = document.createElement('span'); quantity.className = 'collection-quantity';
        quantity.textContent = '×' + item.quantity;
        row.appendChild(info); row.appendChild(quantity); ownedHost.appendChild(row);
      });
    }
    if (!data.presets.length) {
      var noPresets = document.createElement('p'); noPresets.className = 'collection-empty';
      noPresets.textContent = 'No saved deck presets yet.'; presetsHost.appendChild(noPresets);
    } else {
      data.presets.forEach(function (preset) {
        var row = document.createElement('div'); row.className = 'collection-row';
        var info = document.createElement('div'), name = document.createElement('strong'), meta = document.createElement('small');
        name.textContent = preset.name; meta.textContent = preset.cardRefs.length + ' / 20 cards';
        info.appendChild(name); info.appendChild(meta);
        var state = document.createElement('span'); state.className = 'collection-state';
        state.textContent = preset.id === data.activePresetId ? 'Active' : 'Saved';
        row.appendChild(info); row.appendChild(state); presetsHost.appendChild(row);
      });
    }
  }

  function openCardCollection() {
    if (!active || saveLocked || !currentSave || !$('screen-world').classList.contains('active')) return;
    E.World.pause();
    renderCardCollection();
    show('screen-card-collection');
  }

  function closeCardCollection() {
    if (!$('screen-card-collection').classList.contains('active')) return;
    show('screen-world');
    if (active && !saveLocked) E.World.resume();
  }

  function openGameMenu() {
    renderInventory();
    if (!active || saveLocked) return;
    $('game-menu').hidden = false;
    $('btn-menu-resume').focus();
  }
  function closeGameMenu() {
    $('game-menu').hidden = true;
  }
  function returnToTitleFromMenu() {
    if (!active || saveLocked) return;
    var saved = persist('menu-return-title');
    if (!saved.ok) return;
    active = false;
    E.World.pause();
    closeGameMenu();
    show('screen-title');
    refreshTitleState();
  }
  $('btn-card-collection').addEventListener('click', openCardCollection);
  $('btn-card-collection-back').addEventListener('click', closeCardCollection);
  $('btn-menu').addEventListener('click', openGameMenu);
  $('btn-battle-menu').addEventListener('click', openGameMenu);
  $('btn-menu-resume').addEventListener('click', closeGameMenu);
  $('btn-menu-title').addEventListener('click', returnToTitleFromMenu);
  $('game-menu').addEventListener('click', function (event) {
    if (event.target === $('game-menu')) closeGameMenu();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('game-menu').hidden) closeGameMenu();
  });

  $('btn-start').addEventListener('click', startNewGame);
  $('btn-continue').addEventListener('click', continueGame);
  $('btn-new-character').addEventListener('click', openCharacterCreation);
  $('btn-select-back').addEventListener('click', function () { show('screen-title'); });
  $('btn-create-back').addEventListener('click', function () {
    if (characterCreationReturnScreen === 'screen-select') {
      renderCharacterSelection();
      show('screen-select');
    } else {
      show('screen-title');
    }
  });
  $('btn-create-confirm').addEventListener('click', createCharacter);
  ['character-gender', 'character-hair', 'character-color'].forEach(function (id) {
    $(id).addEventListener('change', updateCreationPreview);
  });
  $('character-name').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') createCharacter();
  });
  updateCreationPreview();
  E.World.init($('world-canvas'));
  E.World.onEncounter = function (monsterId) { startBattle(monsterId); };
  E.World.onMapChange = function (mapId, mapName) {
    $('hud-zone').textContent = mapName;
    toast('Entered ' + mapName + '.', 3000);
    persist('map-transition');
  };

  // A small public surface for deterministic integration tests and diagnostics.
  E.GameSave = {
    getCurrentSave: function () { return currentSave ? JSON.parse(JSON.stringify(currentSave)) : null; },
    saveNow: function () { return persist('manual'); },
    continueGame: continueGame
  };

  function refreshTitleState() {
    if (!saveSystem) return;
    var listed = saveSystem.listCharacters();
    var chars = listed.characters || [];
    var ready = chars.filter(function (c) { return c.state === 'ready' && c.save; });
    var blocked = chars.filter(function (c) { return c.state === 'damaged' || c.state === 'recoveryIncomplete' || c.state === 'creating'; });
    $('btn-continue').hidden = ready.length === 0;
    $('btn-start').disabled = blocked.length > 0;
    $('btn-new-character').disabled = blocked.length > 0;
    $('btn-create-confirm').disabled = blocked.length > 0;
    $('btn-start').textContent = 'Create New Character';
    if (blocked.length) {
      $('save-status').textContent = 'Recovery required. Existing save data is protected; New Game is disabled to prevent overwriting it.';
      var recovery = $('recovery-status');
      if (!recovery) {
        recovery = document.createElement('p'); recovery.id = 'recovery-status'; recovery.className = 'recovery-status';
        $('screen-title').appendChild(recovery);
      }
      recovery.textContent = blocked.length + ' save record(s) need recovery. Reload the page to retry automatic recovery. Do not clear website data.';
    } else {
      $('save-status').textContent = ready.length ? (ready.length + ' saved character(s) available.') : 'Create your first character';
      var recovery = $('recovery-status'); if (recovery) recovery.remove();
    }
  }

  try {
    saveSystem = E.Save.createSystem({ backend: E.Save.getBrowserBackend() });
    if (!saveSystem.probe()) {
      $('save-status').textContent = 'Save storage is unavailable in this browser.';
      $('btn-start').disabled = true;
    } else refreshTitleState();
  } catch (err) {
    console.error('Save system initialization failed:', err);
    $('save-status').textContent = 'Save system unavailable.';
    $('btn-start').disabled = true;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') persist('visibility-hidden');
  });
  window.addEventListener('pagehide', function () { persist('pagehide'); });
  window.setInterval(function () {
    if (active && !saveLocked && $('screen-world').classList.contains('active')) persist('autosave');
  }, 5000);
  updateHud();
})();
