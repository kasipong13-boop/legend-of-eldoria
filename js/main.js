/* Legend of Eldoria - Prototype 0.1
   main.js: connects the title screen, village, battle and result screens. */
(function () {
  var E = window.ELDORIA;
  function $(id) { return document.getElementById(id); }

  var player = {
    level: 1, exp: 0, gold: 0, jelly: 0,
    maxHp: E.RULES.playerMaxHp, hp: E.RULES.playerMaxHp
  };

  var screens = ['screen-title', 'screen-world', 'screen-battle', 'screen-result'];
  function show(id) {
    screens.forEach(function (s) { $(s).classList.toggle('active', s === id); });
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

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 4000);
  }

  function startBattle(monsterId) {
    show('screen-battle');
    E.BattleUI.start({ hp: player.hp, maxHp: player.maxHp }, monsterId, onBattleEnd);
  }

  function onBattleEnd(result) {
    var list = $('result-list');
    list.innerHTML = '';
    function line(text, cls) {
      var li = document.createElement('li');
      li.textContent = text;
      if (cls) li.className = cls;
      list.appendChild(li);
    }

    if (result.won) {
      var rw = E.rollRewards(result.monsterId);
      $('result-title').textContent = 'Victory!';
      line('+' + rw.exp + ' EXP');
      line('+' + rw.gold + ' gold');
      player.exp += rw.exp;
      player.gold += rw.gold;
      rw.drops.forEach(function (d) {
        line('Dropped: ' + d.name, 'loot');
        if (d.id === 'jelly') player.jelly++;
      });
      if (!rw.drops.length) line('No drops this time.');
      while (player.exp >= E.expToNext(player.level)) {
        player.exp -= E.expToNext(player.level);
        player.level++;
        player.maxHp += E.levelUpMaxHp;
        line('Level up! Now Lv ' + player.level + ', max HP ' + player.maxHp, 'level');
      }
      $('btn-result').textContent = 'Return to the village';
    } else {
      $('result-title').textContent = 'Defeated';
      line('You wake up safe in Greenvale Village.');
      line('Nothing was lost.');
      $('btn-result').textContent = 'Wake up';
    }

    // The village is safe: HP is restored after every fight (Prototype 0.1 rule).
    player.hp = player.maxHp;
    $('btn-result').onclick = function () { backToVillage(!result.won); };
    show('screen-result');
  }

  function backToVillage(resetHero) {
    updateHud();
    show('screen-world');
    E.World.respawn(resetHero);
    E.World.resume();
  }

  $('btn-start').addEventListener('click', function () {
    show('screen-world');
    updateHud();
    E.World.start();
    toast('Tap the ground to walk, or use the arrows. Touch the pink Poring to fight.', 5000);
  });

  E.World.init($('world-canvas'));
  E.World.onEncounter = function (monsterId) { startBattle(monsterId); };
  updateHud();
})();
