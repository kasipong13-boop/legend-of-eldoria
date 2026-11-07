/* Legend of Eldoria - Prototype 0.1
   battle-ui.js: draws the battle screen and connects taps to the battle engine. */
(function (root) {
  var E = root.ELDORIA;
  function $(id) { return document.getElementById(id); }

  var battle = null;
  var onEnd = null;
  var locked = false;

  function flash(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart animation
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 450);
  }

  function pop(who, text, cls) {
    var host = who === 'enemy' ? $('enemy-stage') : $('player-panel');
    var el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.textContent = text;
    if (who === 'player') { el.style.top = '-30px'; el.style.left = '45%'; }
    host.style.position = 'relative';
    host.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950);
  }

  function setLog(msgs) { $('battle-log').textContent = msgs.join(' '); }

  function render() {
    var s = battle.state;

    $('enemy-name').textContent = s.enemy.name;
    $('enemy-hp-fill').style.width = (100 * s.enemy.hp / s.enemy.maxHp) + '%';
    $('enemy-hp-text').textContent = s.enemy.hp + ' / ' + s.enemy.maxHp;
    $('enemy-intent').textContent = s.over ? '' : 'Next: ' + s.enemy.intent.name + ', ' + s.enemy.intent.damage + ' damage';
    $('enemy-intent').style.visibility = s.over ? 'hidden' : 'visible';

    $('player-hp-fill').style.width = (100 * s.player.hp / s.player.maxHp) + '%';
    $('player-hp-text').textContent = 'You  ' + s.player.hp + ' / ' + s.player.maxHp;

    var blk = $('player-block');
    blk.textContent = '\uD83D\uDEE1\uFE0F ' + s.player.block;
    blk.classList.toggle('zero', s.player.block === 0);

    var orbs = '';
    for (var i = 0; i < E.RULES.energy; i++) orbs += (i < s.player.energy ? '\u25CF' : '\u25CB');
    $('player-energy').textContent = '\u26A1 ' + orbs;

    $('piles').textContent = 'Draw ' + s.drawPile.length + '  Discard ' + s.discardPile.length;

    var hand = $('hand');
    hand.innerHTML = '';
    s.hand.forEach(function (id, idx) {
      var c = E.CARDS[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'card ' + c.kind + (c.cost > s.player.energy || s.over ? ' disabled' : '');
      b.innerHTML =
        '<span class="cost">' + c.cost + '</span>' +
        '<span class="icon">' + c.icon + '</span>' +
        '<span class="name">' + c.name + '</span>' +
        '<span class="text">' + c.text + '</span>';
      b.addEventListener('click', function () { onCard(idx); });
      hand.appendChild(b);
    });

    $('btn-end-turn').disabled = !!s.over || locked;
  }

  function finishIfOver() {
    var s = battle.state;
    if (!s.over) return false;
    locked = true;
    render();
    if (s.over === 'win') $('enemy-sprite').classList.add('dead');
    var result = { won: s.over === 'win', monsterId: s.enemy.id };
    setTimeout(function () { if (onEnd) onEnd(result); }, 900);
    return true;
  }

  function onCard(idx) {
    if (locked) return;
    var res = battle.playCard(idx);
    if (!res.ok) {
      if (res.reason === 'energy') setLog(['Not enough energy.']);
      return;
    }
    setLog(res.msgs);
    res.pops.forEach(function (p) { pop(p.who, p.text, p.cls); });
    if (res.pops.some(function (p) { return p.who === 'enemy'; })) flash($('enemy-sprite'), 'hit');
    render();
    finishIfOver();
  }

  function onEndTurn() {
    if (locked) return;
    var res = battle.endTurn();
    if (!res.ok) return;
    setLog(res.msgs);
    flash($('enemy-sprite'), 'attack');
    res.pops.forEach(function (p) { pop(p.who, p.text, p.cls); });
    if (res.pops.some(function (p) { return p.who === 'player' && p.cls === 'dmg'; })) flash($('player-panel'), 'hit');
    render();
    finishIfOver();
  }

  var wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    $('btn-end-turn').addEventListener('click', onEndTurn);
  }

  // playerState: {hp, maxHp}. cb({won, monsterId})
  function start(playerState, monsterId, cb) {
    wire();
    onEnd = cb;
    locked = false;
    $('enemy-sprite').classList.remove('dead', 'hit', 'attack');
    battle = E.createBattle({
      player: { hp: playerState.hp, maxHp: playerState.maxHp },
      monsterId: monsterId,
      deck: E.STARTER_DECK
    });
    setLog(['A wild ' + E.MONSTERS[monsterId].name + ' appears!']);
    render();
  }

  E.BattleUI = { start: start };
})(typeof window !== 'undefined' ? window : globalThis);
