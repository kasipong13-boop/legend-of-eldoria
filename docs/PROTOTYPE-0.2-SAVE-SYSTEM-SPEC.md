# Prototype 0.2 — Character Save System Specification

Status: implementation contract for the first Prototype 0.2 milestone.
Base: existing Prototype 0.1 browser game. This document does not authorize changes to gameplay balance or combat rules.

## 1. Scope
Implement character creation, character selection, continue, and durable per-character save/recovery. Keep the existing Greenvale Village, Novice rules, Poring encounter, card battle, reward values, defeat behavior, and level progression unchanged.

In scope:
- Multiple character profiles.
- Create New Character and Character Select.
- Continue always opens Character Select.
- Save/load for each character.
- Crash/reload recovery and duplicate-reward prevention.
- Storage-unavailable session-only warning; never show a false Continue option.

Out of scope: new monsters, maps, jobs, cards, deck builder, inventory UI, crafting, equipment, status effects, combat balancing, cloud sync, accounts, server storage, and cross-device synchronization.

## 2. Character creation contract
- Character identity is characterId, never a slot number.
- Character names accept 1–16 Unicode grapheme clusters.
- Preserve Thai and other valid Unicode names exactly; do not truncate.
- Reject control characters and invisible formatting characters.
- Multiple characters are supported. Continue opens Character Select every time.
- Creation choices: two genders, six hairstyles, eight hair colors.
- New characters begin as Novice with existing starting stats and gameplay values. No manual stat allocation in 0.2.

## 3. Storage key namespace
- Per character: eldoria.char.<characterId>.main, .backup, and .guard.
- Global: eldoria.index and eldoria.probe.
- Recovery/quarantine records use eldoria.discarded.<characterId>.*.
- Generate IDs only with a cryptographically secure random source (128-bit). If unavailable, stop creation clearly; never fall back to Math.random().

## 4. Save envelope
Every committed save includes schema/version, characterId, monotonically increasing revision, savedAt, lifecycle status (creating/ready), profile (name/gender/hairStyle/hairColor/job/createdAt), stats, gold, items, world position/state, deckId, pendingReward, reward sequence/claim state, and integrity checksum.
The checksum detects accidental corruption; it is not authentication and must not be described as protection against malicious modification.

## 5. Commit and recovery protocol
- A save is not committed merely because one storage write succeeded.
- Maintain Main, Backup, and Guard records with validated checksums and revisions.
- Guard sequence floor prevents recovery from rolling behind a previously committed revision.
- Main revision 2 with status ready is the character-creation commit point; recovery may roll forward from it.
- Recovery chooses only a valid record consistent with guard floor and character identity.
- Never silently overwrite a valid newer record with an older one.
- Quarantine invalid/conflicting records for diagnosis.
- If storage is unavailable or quota/write probing fails, continue only in session memory, show a session-only warning, and do not advertise persistent Continue.

## 6. Reward transaction
- Persist pending reward before displaying the result screen.
- Claiming a reward must be atomic/idempotent using a unique reward sequence.
- Reloading during the result screen must not duplicate EXP, Gold, or items.
- A completed reward sequence cannot be replayed.

## 7. Safe save points
Save at approved safe tiles and defined progression milestones, and on pagehide as a best-effort final save. Do not save during movement/path interpolation, active battle, unresolved pending reward, or recovery. Preserve the Prototype 0.1 defeat rule: return to the village, restore HP as currently implemented, and lose nothing.

## 8. Integration boundaries
- Keep js/data.js and js/battle.js unchanged unless a specific technical blocker is demonstrated and the user approves it first.
- Prefer a separate js/save.js module and narrow integration in index.html / js/main.js.
- Keep the public world API explicit (for example, position getter/setter); do not make private debug objects part of the save contract.
- Debug hooks must be inert in release builds.
- Do not replace or rewrite the Prototype 0.1 project.

## 9. Required verification before merge
1. Secure ID generation and failure when crypto randomness is unavailable.
2. Thai/Unicode grapheme name boundaries, invalid controls, and no truncation.
3. Multiple characters and stable character identity.
4. Create New Character, Character Select, and Continue.
5. Main/Backup/Guard revision selection and checksum corruption.
6. Guard sequence floor and recovery roll-forward.
7. Storage quota/unavailable behavior and session-only warning.
8. Pending reward persisted before result display.
9. Idempotent reward claim across reload/recovery.
10. Autosave safe points; no save during battle/path/reward/recovery.
11. Existing Prototype 0.1 regression: starter deck, card costs/effects, Poring HP/intents, rewards, EXP/level-up, defeat behavior, and world movement.

Acceptance gate: all unit and regression tests pass; browser smoke tests pass for create → enter village → fight → win/lose → reload → continue; protected gameplay files remain unchanged without prior approval; changes are delivered as a feature-branch pull request, never auto-merged to main.