/* Card Acquisition Foundation: monster card drops are data-driven and separate from item drops. */
(function(root){
  'use strict';
  var E=root.ELDORIA=root.ELDORIA||{};
  var RARITIES=['Common','Uncommon','Rare','Epic','Legendary'];

  // Deliberately empty until card identities and drop rates are approved.
  // Item drops remain in E.MONSTERS[].drops and are not read by this module.
  E.MONSTER_CARD_DROP_TABLE=E.MONSTER_CARD_DROP_TABLE||{poring:[]};

  function rollMonsterDrops(monsterId,rng,tableOverride){
    rng=rng||Math.random;
    if(typeof rng!=='function')throw Error('A random number function is required.');
    var table=tableOverride||E.MONSTER_CARD_DROP_TABLE;
    var entries=table&&table[monsterId];
    if(entries===undefined)return [];
    if(!Array.isArray(entries))throw Error('Monster card drop table must be an array.');
    var rewards=[];
    entries.forEach(function(entry){
      if(!entry||typeof entry.cardId!=='string'||!entry.cardId||typeof entry.chance!=='number'||!Number.isFinite(entry.chance)||entry.chance<0||entry.chance>1)throw Error('Invalid monster card drop entry.');
      var card=E.CARDS&&E.CARDS[entry.cardId];
      if(!card)throw Error('Unknown card in monster drop table: '+entry.cardId+'.');
      if(card.acquisitionType!=='monster-special-skill')throw Error('Monsters may only drop Monster Special Skill Cards.');
      if(RARITIES.indexOf(card.rarity)<0)throw Error('Monster Special Skill Card requires a valid rarity.');
      if(rng()<entry.chance){
        rewards.push({cardId:entry.cardId,stars:1,quantity:1,name:card.name||entry.cardId,rarity:card.rarity});
      }
    });
    return rewards;
  }

  E.CardAcquisition={
    rarities:RARITIES.slice(),
    rollMonsterDrops:rollMonsterDrops
  };
})(typeof window!=='undefined'?window:globalThis);
