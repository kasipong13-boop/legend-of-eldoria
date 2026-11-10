/* Monster Special Skill Card acquisition rules. Drop chance is independent of rarity. */
(function (root) {
  'use strict';
  var E = root.ELDORIA = root.ELDORIA || {};
  var RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  E.MONSTER_CARD_DROP_TABLE = E.MONSTER_CARD_DROP_TABLE || {
    poring: [], forest_wolf: [], ancient_wolf: []
  };

  function rollMonsterDrops(monsterId, rng, tableOverride) {
    rng = rng || Math.random;
    if (typeof rng !== 'function') throw new Error('A random number function is required.');
    var table = tableOverride || E.MONSTER_CARD_DROP_TABLE;
    if (!table || !Object.prototype.hasOwnProperty.call(table, monsterId)) return [];
    var entries = table[monsterId];
    if (!Array.isArray(entries)) throw new Error('Monster card drop table must be an array.');
    var rewards = [];
    entries.forEach(function (entry) {
      if (!entry || typeof entry.cardId !== 'string' || !entry.cardId ||
          typeof entry.chance !== 'number' || !Number.isFinite(entry.chance) ||
          entry.chance < 0 || entry.chance > 1) throw new Error('Invalid monster card drop entry.');
      if (!E.CARDS || !Object.prototype.hasOwnProperty.call(E.CARDS, entry.cardId)) throw new Error('Unknown card in monster drop table: ' + entry.cardId + '.');
      var card = E.CARDS[entry.cardId];
      if (card.acquisitionType !== 'monster-special-skill') throw new Error('Monsters may only drop Monster Special Skill Cards.');
      if (RARITIES.indexOf(card.rarity) < 0) throw new Error('Monster Special Skill Card requires a valid rarity.');
      if (rng() < entry.chance) rewards.push({ cardId: entry.cardId, stars: 1, quantity: 1, name: card.name || entry.cardId, rarity: card.rarity });
    });
    return rewards;
  }

  E.CardAcquisition = { rarities: RARITIES.slice(), rollMonsterDrops: rollMonsterDrops };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.CardAcquisition;
})(typeof window !== 'undefined' ? window : globalThis);
