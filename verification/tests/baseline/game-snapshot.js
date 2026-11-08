// Produces a deterministic snapshot of every game value and of 300 seeded battles + reward rolls.
// Run against 0.1 (baseline) and 0.2 (regression): outputs must be byte-identical.
const load = require('../lib/load-game-logic');
module.exports = function snapshot(dir) {
  const E = load(dir);
  const values = {
    RULES: E.RULES, CARDS: E.CARDS, STARTER_DECK: E.STARTER_DECK, MONSTERS: E.MONSTERS,
    expToNext: Array.from({ length: 20 }, (_, i) => E.expToNext(i + 1)), levelUpMaxHp: E.levelUpMaxHp
  };
  const battles = [];
  for (let seed = 1; seed <= 300; seed++) {
    const rng = load.mulberry32(seed);
    const b = E.createBattle({ player: { hp: 50, maxHp: 50 }, monsterId: 'poring', deck: E.STARTER_DECK, rng });
    const log = [];
    let guard = 0;
    while (!b.state.over && guard++ < 200) {
      const s = b.state;
      const idx = s.hand.findIndex(id => E.CARDS[id].cost <= s.player.energy);
      const r = idx >= 0 ? b.playCard(idx) : b.endTurn();
      log.push(r.msgs.join('|'));
    }
    const rw = E.rollRewards('poring', load.mulberry32(seed * 7919));
    battles.push({ seed, over: b.state.over, turn: b.state.turn, hp: b.state.player.hp, enemyHp: b.state.enemy.hp, log, reward: rw });
  }
  // Defeat path: low HP, never plays cards
  const defeats = [];
  for (let seed = 1; seed <= 50; seed++) {
    const b = E.createBattle({ player: { hp: 8, maxHp: 50 }, monsterId: 'poring', deck: E.STARTER_DECK, rng: load.mulberry32(seed) });
    const log = []; let guard = 0;
    while (!b.state.over && guard++ < 50) log.push(b.endTurn().msgs.join('|'));
    defeats.push({ seed, over: b.state.over, turn: b.state.turn, hp: b.state.player.hp, log });
  }
  return JSON.stringify({ values, battles, defeats });
};
if (require.main === module) process.stdout.write(module.exports(process.argv[2]));
