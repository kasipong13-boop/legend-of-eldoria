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
    heal:     { id: 'heal',     name: 'Heal',      cost: 1, kind: 'spell',  icon: '\uD83D\uDC9A', heal: 8,             text: 'Restore 8 HP.' },
    'msc-por-001': {
      id: 'msc-por-001', name: 'Slime Splash', cost: 1, kind: 'special', icon: '\uD83D\uDCA7',
      cardFamily: 'monster-special-skill', acquisitionType: 'monster-special-skill', rarity: 'Uncommon',
      sourceMonsterId: 'poring', deckCopyLimit: 2, element: 'neutral', damage: 5,
      statusEffects: [{ type: 'vulnerable', stacks: 1, duration: 1 }],
      text: 'Deal 5 damage and apply Vulnerable for 1 turn.',
      starUpgrades: {
        2: { element: 'water', propertyChange: 'Damage becomes Water element.' },
        3: { effect: { type: 'bonus-hit-if-target-vulnerable', hits: 1, damage: 3 }, description: 'If the target is already Vulnerable, hit one additional time for 3 damage.' }
      }, implementationStatus: 'catalog-only'
    },
    'msc-wolf-001': {
      id: 'msc-wolf-001', name: 'Savage Bite', cost: 1, kind: 'special', icon: '\uD83E\uDDB7',
      cardFamily: 'monster-special-skill', acquisitionType: 'monster-special-skill', rarity: 'Rare',
      sourceMonsterId: 'wolf', deckCopyLimit: 2, element: 'neutral', damage: 7,
      statusEffects: [{ type: 'bleed', stacks: 2 }],
      text: 'Deal 7 damage and apply 2 Bleed stacks.',
      starUpgrades: {
        2: { effect: { type: 'bonus-bleed-if-target-hp-at-most-percent', threshold: 50, stacks: 1 }, description: 'If the target is at or below 50% HP, apply 1 additional Bleed stack.' },
        3: { effect: { type: 'apply-vulnerable-if-target-has-status', status: 'bleed', stacks: 1, duration: 1 }, description: 'If the target has Bleed, also apply Vulnerable for 1 turn.' }
      }, implementationStatus: 'catalog-only'
    }
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
      gold: [5, 10],
      drops: [{ id: 'jelly', name: 'Poring Jelly', chance: 0.6 }],
      moves: [
        { name: 'Bounce', damage: 4 },
        { name: 'Slam',   damage: 6 },
        { name: 'Wobble', damage: 3 }
      ]
    }
  };

  // Level up rules (Prototype 0.1 keeps these very small)
  E.expToNext = function (level) { return 20 * level; };
  E.levelUpMaxHp = 5;

})(typeof window !== 'undefined' ? window : globalThis);
