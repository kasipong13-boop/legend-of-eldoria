# Gold Source Rule — LEGEND OF ELDORIA

**Status:** GAME_CONFIRMED  
**Implementation branch:** `fix/gold-source-current-main`

## Confirmed rule

1. Gold is obtained only by selling materials to NPCs.
2. Defeating monsters does not award Gold.
3. Monster victories may continue to grant EXP and eligible item/material drops under their separately approved rules.
4. Existing character Gold balances must be preserved. This implementation does not reset, deduct, or rewrite Gold already stored in a character save.

## Implementation boundary

- Monster definitions no longer configure Gold reward ranges.
- `E.rollRewards()` returns EXP and item drops only; it has no Gold field.
- Victory UI does not display monster Gold.
- The victory claim handler never adds Gold from a pending reward, including legacy pending rewards containing a nonzero Gold value.
- One retired RNG draw is intentionally consumed before item-drop rolls so existing seeded item-drop outcomes remain unchanged.

The following remain **UNDER_DISCUSSION** and are not implemented:
- Which materials each NPC accepts.
- NPC buy prices or price calculation.
- NPC identity, location, shop interface, and selling transaction flow.
- Any economy fees, taxes, or selling restrictions.

Do not invent these values or mechanics. They require separate approval.

## Save compatibility

- `js/save.js` is unchanged.
- Save Schema version and all save keys remain unchanged.
- The current schema requires `pendingReward.gold` to be a non-negative integer. Therefore new monster-victory pending rewards store `gold: 0` strictly for schema compatibility; this is not a Gold award and is never applied to the character.
- Existing character Gold remains untouched when a reward is staged or claimed.
- Legacy pending rewards may contain an old nonzero `gold` value. Claiming such a reward ignores that field while still granting eligible EXP and item drops.
- No migration, reset, deduction, or destructive rewrite is performed.

## Verification requirements

- No monster definition configures a Gold reward.
- `rollRewards` returns EXP and item drops without a Gold field.
- The victory integration stages schema-compatible zero and never displays or applies monster Gold.
- A character with an existing Gold balance retains it after claiming both a legacy pending reward and a new monster victory.
- Existing Save, regression, unit, integration, mutation, and browser smoke tests continue to pass.
