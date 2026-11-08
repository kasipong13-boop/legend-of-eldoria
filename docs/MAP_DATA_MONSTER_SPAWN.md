# Map Data & Monster Spawn – Implementation Notes

Confirmed: individual respawn timers; realtime timestamps continue while offline; random positions in assigned zones; walkable/unoccupied tiles only; configured player exclusion distance; rare monsters have dedicated slots.

Map coordinates use logical tile columns and rows, independent of isometric rendering. Each map defines ID, dimensions through its tile grid, start tile, legend, NPC placements, warps, spawn zones, normal slots, and rare slots.

Implementation files: js/map-data.js validates and queries map definitions. js/monster-spawn.js manages slot lifecycle independently of rendering and DOM.

The existing Greenvale renderer remains unchanged in this first foundation step. Its tile grid is mirrored in map data to permit a safe later migration. This commit does not yet replace the current single-Poring simulation or add playable maps, NPCs, or warps.

Defaults: 5 logical tiles minimum player distance; 30 candidate position checks; all respawn intervals, rare chances, and retry intervals are per-slot configurable. Local browser timestamps are not tamper-proof; multiplayer requires server-authoritative time and spawn state.
