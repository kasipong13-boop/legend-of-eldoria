# Gold Source Rule — LEGEND OF ELDORIA

**Status:** GAME_CONFIRMED  
**Scope:** Source of player Gold  
**Implementation branch:** `feature/npc-material-sale-gold-economy`

## Confirmed rule

1. Gold is obtained only by selling materials to NPCs.
2. Defeating monsters does not award Gold.
3. Monster victory rewards may continue to grant EXP, material/item drops, and eligible Monster Special Skill Cards under their separately approved rules.
4. Existing character Gold balances must be preserved. This change does not reset, deduct, or rewrite Gold already stored in a character save.

## Implementation boundary

This task removes Gold from monster victory reward data, reward rolling, pending victory reward creation, and victory result display.

The following are not defined or activated by this change because their details remain UNDER_DISCUSSION:
- Which materials each NPC accepts.
- NPC buy prices and how prices are calculated.
- NPC identity, location, shop interface, and transaction flow.
- Any additional economy fees, taxes, or selling restrictions.

Do not invent these values or mechanics in code. They require separate approval.

## Save compatibility

The existing Save schema and character Gold field remain unchanged. New monster-victory transactions do not contain a Gold reward, so claiming them preserves the character's existing Gold balance. The existing generic pending-reward claim behavior is retained for backward compatibility with already-persisted transactions; this task does not rewrite old saves or existing Gold balances.

## Verification requirements

- Monster definitions do not configure a Gold reward.
- `rollRewards` returns EXP and item drops without a Gold field.
- The victory integration does not enqueue or display monster Gold.
- Claiming a new monster victory reward leaves the character's existing Gold balance unchanged.
- Existing Save, card acquisition, battle, and browser smoke tests continue to run.
