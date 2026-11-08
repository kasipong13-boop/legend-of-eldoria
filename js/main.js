/* Legend of Eldoria - Prototype 0.2
   Connects the original 0.1 game loop to the transactional Save system. */
(function () {
  var E = window.ELDORIA;
  function $(id) { return document.getElementById(id); }

  var player = {
    level: 1, exp: 0, gold: 0, jelly: 0,
    maxHp: E.RULES.playerMaxHp, hp: E.RULES.playerMaxHp
  };
  var saveSystem = null;
  var currentSave = null;
  var active = false;
  var saveLocked = false;
  var pendingSaveTx = null;
  var screens = ['screen-title', 'screen-world', 'screen-battle', 'screen-result'];

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
    player.jelly = save.items.jelly;
    if (save.world && save.world.map === 'greenvale') E.World.setPosition({ c: save.world.c, r: save.world.r });
    updateHud();
  }

  function worldSnapshot(target) {
    var p = E.World.getPosition();
    target.world = { map: 'greenvale', c: p.c, r: p.r };
    target.stats.level = player.level;
    target.stats.exp = player.exp;
    target.stats.hp = player.hp;
    target.stats.maxHp = player.maxHp;
    target.gold = player.gold;
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
      $('btn-save-retry').addEventListener('click', function () {
        var result = persist('manual-retry');
        if (result && result.ok && currentSave && currentSave.pendingReward) {
          var settled = settlePendingReward(currentSave);
          if (settled && !settled.pendingReward) currentSave = settled;
          else result = { ok: false };
        }
        if (result && result.ok) {
          saveLocked = false; active = true; overlay.classList.remove('show');
          show('screen-world'); E.World.resume(); toast('Save completed.', 2500);
        } else {
          $('save-lock-message').textContent = 'The save is still not complete. Your progress is locked to prevent data loss. Try again.';
        }
      });
      $('btn-save-title').addEventListener('click', function () {
        // Leaving the game does not discard or overwrite the current save.
        saveLocked = false; active = false; overlay.classList.remove('show'); show('screen-title');
      });
    }
    $('save-lock-message').textContent = message || 'Saving could not be completed. Your progress is locked to prevent data loss.';
    overlay.classList.add('show');
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
  }

  function applyRewardToSave(target, reward) {
    target.stats.exp += reward.exp;
    target.gold += reward.gold;
    reward.drops.forEach(function (d) { if (d.id === 'jelly') target.items.jelly++; });
    while (target.stats.exp >= E.expToNext(target.stats.level)) {
      target.stats.exp -= E.expToNext(target.stats.level);
      target.stats.level++;
      target.stats.maxHp += E.levelUpMaxHp;
    }
    target.stats.hp = target.stats.maxHp;
  }

  function settlePendingReward(save) {
    if (!save || !save.pendingReward) return save;
    var claim = E.Save.withClaim(save, applyRewardToSave);
    if (!claim.ok) return null;
    var committed = saveSystem.commit(save, claim.save);
    if (committed.ok) return committed.save;
    if (committed.tx && committed.durable) {
      var resumed = saveSystem.resume(committed.tx);
      if (resumed.ok) return resumed.save;
      pendingSaveTx = committed.tx;
    }
    return null;
  }

  function beginFromSave(save) {
    applySave(save);
    active = true;
    show('screen-world');
    E.World.respawn(false);
    E.World.resume();
    toast('Tap the ground to walk, or use the arrows. Touch the pink Poring to fight.', 5000);
  }

  function startNewGame() {
    if (!saveSystem || !saveSystem.probe()) {
      $('save-status').textContent = 'Save storage is unavailable in this browser.';
      return;
    }
    // Prototype 0.2 starts directly as a Novice; character creation UI is intentionally deferred.
    var created = saveSystem.createCharacter({ name: 'Novice', gender: 'male', hairStyle: 0, hairColor: 0 }, {
      maxHp: E.RULES.playerMaxHp, start: E.World.startPosition()
    });
    if (!created.ok) {
      $('save-status').textContent = 'Could not create save: ' + created.reason;
      return;
    }
    beginFromSave(created.save);
  }

  function continueGame() {
    if (!saveSystem) return;
    var chars = saveSystem.listCharacters().characters;
    var blocked = chars.filter(function (c) { return c.state === 'damaged' || c.state === 'recoveryIncomplete' || c.state === 'creating'; });
    var list = chars.filter(function (c) { return c.state === 'ready' && c.save; });
    if (!list.length) { refreshTitleState(); $('save-status').textContent = blocked.length ? 'Recovery required. New Game remains disabled.' : 'No saved Novice adventure found.'; return; }
    var selected = list[list.length - 1];
    var loaded = saveSystem.loadCharacter(selected.id);
    if (!loaded.ok) { $('save-status').textContent = 'Save recovery required: ' + loaded.reason + '. New Game is disabled to protect the existing data.'; refreshTitleState(); return; }
    var settled = settlePendingReward(loaded.save);
    if (!settled) {
      beginFromSave(loaded.save);
      lockGame('A saved victory reward still needs to be committed. Retry Save to finish the existing reward before continuing.');
      return;
    }
    beginFromSave(settled);
  }

  function startBattle(monsterId) {
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
      var pending = E.Save.withPendingReward(currentSave, rw, result.monsterId, new Date().toISOString());
      var rewardSaved = false;
      if (pending.ok) {
        var staged = saveSystem.commit(currentSave, pending.save);
        if (staged.ok) {
          currentSave = staged.save;
          var claimed = E.Save.withClaim(currentSave, function (target, reward) {
            applyRewardToSave(target, reward);
          });
          if (claimed.ok) {
            var finalSave = saveSystem.commit(currentSave, claimed.save);
            if (finalSave.ok) { currentSave = finalSave.save; rewardSaved = true; }
            else if (finalSave.tx && finalSave.durable) {
              var retryClaim = saveSystem.resume(finalSave.tx);
              if (retryClaim.ok) { currentSave = retryClaim.save; rewardSaved = true; }
              else pendingSaveTx = finalSave.tx;
            }
          }
        } else if (staged.tx && staged.durable) {
          var retryStage = saveSystem.resume(staged.tx);
          if (retryStage.ok) {
            currentSave = retryStage.save;
            var stagedClaim = E.Save.withClaim(currentSave, function (target, reward) { applyRewardToSave(target, reward); });
            if (stagedClaim.ok) {
              var stagedFinal = saveSystem.commit(currentSave, stagedClaim.save);
              if (stagedFinal.ok) { currentSave = stagedFinal.save; rewardSaved = true; }
              else if (stagedFinal.tx && stagedFinal.durable) {
                var stagedResume = saveSystem.resume(stagedFinal.tx);
                if (stagedResume.ok) { currentSave = stagedResume.save; rewardSaved = true; }
                else pendingSaveTx = stagedFinal.tx;
              }
            }
          } else pendingSaveTx = staged.tx;
        }
      }
      if (rewardSaved) {
        player.exp = currentSave.stats.exp; player.level = currentSave.stats.level;
        player.gold = currentSave.gold; player.jelly = currentSave.items.jelly;
        player.maxHp = currentSave.stats.maxHp; player.hp = currentSave.stats.hp;
        line('+' + rw.exp + ' EXP'); line('+' + rw.gold + ' gold');
        rw.drops.forEach(function (d) { line('Dropped: ' + d.name, 'loot'); });
        if (!rw.drops.length) line('No drops this time.');
        if (player.level > 1) line('Current level: ' + player.level, 'level');
        $('btn-result').textContent = 'Return to the village';
      } else {
        line('Reward is pending and has not been confirmed as saved.');
        line('Do not close the game. Use Retry Save to finish safely.', 'loot');
        lockGame('Victory reward could not be fully saved. The reward is pending; retry will finish the same reward without rolling it again.');
        $('btn-result').textContent = 'Retry Save';
      }
    } else {
      $('result-title').textContent = 'Defeated';
      line('You wake up safe in Greenvale Village.');
      line('Nothing was lost.');
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
    if (resetHero) E.World.respawn(true);
    player.hp = player.maxHp;
    var saved = persist('return-village');
    if (!saved.ok) return;
    updateHud(); active = true;
    show('screen-world'); E.World.resume();
  }

  function openGameMenu() {
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
  E.World.init($('world-canvas'));
  E.World.onEncounter = function (monsterId) { startBattle(monsterId); };

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
    if (blocked.length) {
      $('save-status').textContent = 'Recovery required. Existing save data is protected; New Game is disabled to prevent overwriting it.';
      var recovery = $('recovery-status');
      if (!recovery) {
        recovery = document.createElement('p'); recovery.id = 'recovery-status'; recovery.className = 'recovery-status';
        $('screen-title').appendChild(recovery);
      }
      recovery.textContent = blocked.length + ' save record(s) need recovery. Reload the page to retry automatic recovery. Do not clear website data.';
    } else {
      $('save-status').textContent = ready.length ? 'Saved Novice adventure available.' : 'New adventure — Novice';
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
