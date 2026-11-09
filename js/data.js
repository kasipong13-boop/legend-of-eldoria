/* Legend of Eldoria - Prototype 0.1
   data.js: all game numbers live here so they are easy to change or move to GDevelop later. */
(function (root) {
  var E = root.ELDORIA = root.ELDORIA || {};

  E.VERSION = '0.1';

  E.RULES = {
    playerMaxHp: 50,
    energy: 3,      // energy per turn
    handSize: 5     // cards drawn per turn
  };

  // kind only affects the card border colour
  E.CARDS = {
    strike:   { id: 'strike',   name: 'Strike',    cost: 1, kind: 'attack', icon: '\u2694\uFE0F', damage: 6,           text: 'Deal 6 damage.' },
    guard:    { id: 'guard',    name: 'Guard',     cost: 1, kind: 'skill',  icon: '\uD83D\uDEE1\uFE0F', block: 5,       text: 'Gain 5 block.' },
    bash:     { id: 'bash',     name: 'Bash',      cost: 2, kind: 'attack', icon: '\uD83D\uDD28', damage: 8, block: 4, text: 'Deal 8 damage. Gain 4 block.' },
    firebolt: { id: 'firebolt', name: 'Fire Bolt', cost: 2, kind: 'spell',  icon: '\uD83D\uDD25', damage: 12,          text: 'Deal 12 damage.' },
    heal:     { id: 'heal',     name: 'Heal',      cost: 1, kind: 'spell',  icon: '\uD83D\uDC9A', heal: 8,             text: 'Restore 8 HP.' }
  };

  E.STARTER_DECK = [
    'strike', 'strike', 'strike', 'strike',
    'guard', 'guard', 'guard',
    'bash', 'firebolt', 'heal'
  ];

  E.MONSTERS = {
    poring: {
      id: 'poring',
      name: 'Poring',
      hp: 20,
      exp: 12,
      drops: [{ id: 'jelly', name: 'Poring Jelly', chance: 0.6 }],
      moves: [
        { name: 'Bounce', damage: 4 },
        { name: 'Slam',   damage: 6 },
        { name: 'Wobble', damage: 3 }
      ]
    },
    forest_wolf: {
      id: 'forest_wolf', name: 'Forest Wolf', hp: 34, exp: 22,
      drops: [{ id: 'wolf_fang', name: 'Wolf Fang', chance: 0.35 }],
      moves: [{ name: 'Bite', damage: 6 }, { name: 'Pounce', damage: 8 }, { name: 'Claw Swipe', damage: 5 }]
    },
    ancient_wolf: {
      id: 'ancient_wolf', name: 'Ancient Wolf', hp: 65, exp: 55,
      drops: [{ id: 'ancient_fang', name: 'Ancient Fang', chance: 0.5 }],
      moves: [{ name: 'Ancient Bite', damage: 9 }, { name: 'Moonlit Pounce', damage: 12 }, { name: 'Rending Claw', damage: 8 }]
    }
  };

  // Level up rules (Prototype 0.1 keeps these very small)
  E.expToNext = function (level) { return 20 * level; };
  E.levelUpMaxHp = 5;

})(typeof window !== 'undefined' ? window : globalThis);
