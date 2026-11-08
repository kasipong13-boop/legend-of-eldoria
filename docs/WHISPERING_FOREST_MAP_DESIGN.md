# Whispering Forest — Map Design Foundation

## Design direction
Whispering Forest uses the selected hybrid direction (C): an open, RO-inspired isometric overworld with readable trails and multiple routes, combined with RPG-style exploration pockets, concealed-feeling side paths, water barriers, and deeper danger zones. The implementation uses original map data and does not import Ragnarok Online maps or assets.

## Current map-data contract
- Map ID: `whispering_forest`
- Grid: 16 × 16 logical tiles; tile projection remains 64 × 32 for the existing isometric renderer.
- Start point: `forest_entrance` at (1, 1).
- Reciprocal travel contract: forest entrance returns to Greenvale's `village_gate`; Greenvale has the corresponding forest exit.
- Terrain legend: `#` blocked forest/tree/cliff, `~` water, `=` trail, `.` forest floor.
- Exploration zones: `forest_wolf_west` near the entrance and `forest_wolf_deep` in the deeper forest.
- Normal spawn slots: three Forest Wolf slots with independent 45–60 second respawn timers.
- Rare spawn: Ancient Wolf slot with an 8% attempt chance and a 60-second retry after a missed roll; it is separate from normal Wolf quota.

## Intended player experience
1. Enter from Greenvale at the marked trailhead.
2. Explore an open forest with several connected routes rather than a single corridor.
3. Encounter ordinary Wolves in the western/near-entrance hunting grounds.
4. Find a deeper route with more dangerous Wolf activity and a low-chance Ancient Wolf appearance.
5. Return to Greenvale through the forest entrance warp.

## Implementation boundary for this phase
This change adds and validates map data, spawn-zone definitions, and transition destination contracts. It does **not** yet switch the live renderer to the 16 × 16 map, enable in-world map transitions, or spawn Wolf entities in the current Poring-only world runtime. Those are the next runtime-integration tasks; keeping this boundary explicit prevents the current renderer from accidentally treating Wolf instances as Poring.
