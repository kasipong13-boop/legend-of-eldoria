# LEGEND OF ELDORIA — ART DIRECTION & ASSET PIPELINE v1.1

**Status:** Approved visual direction / production pipeline plan  
**Scope:** Shared visual standard for Environment, Character, Monster, NPC, Item, Card and UI  
**Reference scene:** Greenvale Village  
**Project:** Prototype 0.2.3 web build (HTML / CSS / JavaScript Canvas)

## 1. Visual Direction — Approved

The current approved direction is **detailed classic MMORPG Pixel Art with an Isometric camera**, inspired by the visual language and readability of Ragnarok Online Classic. This decision supersedes the earlier exploratory 2.5D/high-detail-rendering direction for the game's primary visual style.

- **Art style:** Hand-crafted, detailed Pixel Art. Pixel clusters and deliberate pixel edges must remain visible.
- **Camera:** Isometric 2:1 diamond projection, consistent with the current renderer's 64×32 logical ground tile (TW=64, TH=32).
- **World tone:** High Fantasy, welcoming and colorful in safe areas; stronger contrast and mood in dangerous areas.
- **Character language:** Stylized/chibi fantasy proportions, approximately 2.5–3 heads tall; clear silhouette and readable equipment.
- **Lighting:** Pixel-art highlights and shadow clusters; no soft blur, airbrush gradients or smooth 3D lighting.
- **Outline and shading:** Crisp dark outline where appropriate, controlled palette ramps, deliberate highlights and readable forms.
- **Composition:** Strong foreground/midground/background separation. Gameplay objects and characters must remain readable at normal mobile play scale.
- **Reference use:** Ragnarok Online is a style reference only. Do not copy its characters, maps, sprites, logos, UI, or proprietary assets.

### 1.1 Character benchmark

Carry forward the previously approved Novice character benchmark:

- Baseline frame cell: **96×96 px**.
- 8 directions.
- Idle and frame-based walk animation.
- Transparent background.
- Chibi proportion: approximately 2.5–3 heads tall.
- Crisp outline and classic pixel shading.
- Keep silhouette, face, clothing colors and equipment consistent in every direction and animation frame.

The 96×96 value is a baseline frame cell, not a hard maximum for oversized weapons, effects, mounts or bosses. Those require separately defined bounds.

### 1.2 Palette and readability

Use a shared palette family rather than one identical palette for every asset:

- Greenvale: leafy greens, warm stone, timber browns, blue roof accents, river blues and restrained flower colors.
- Characters: warm skin/hair tones, saturated but controlled clothing colors, high-contrast equipment accents.
- Monsters: clear species silhouettes and a small number of signature colors.
- UI/cards: parchment, dark wood/stone, gold accents and high-contrast text.

Avoid noisy one-pixel texture everywhere. Reserve the highest detail density for focal assets, landmarks and interactable objects.

## 2. Greenvale Village visual target

The generated Greenvale concept image is a **mood and composition reference only**, not a production tileset or sprite sheet.

The production scene should preserve the existing map/gameplay data and translate the concept into modular assets:

1. Ground: grass, dirt, stone road, plaza, river edge and water.
2. Architecture: house, shop, inn, guild, crafting buildings and gates.
3. Nature: trees, bushes, flowers, rocks and pond/river vegetation.
4. Town props: fences, lamps, signs, barrels, crates, benches, banners and bridges.
5. Landmarks: central plaza/fountain and district signifiers.
6. Characters: Novice player, Village Guide, Market Merchant, Blacksmith, Guild Receptionist and Innkeeper.
7. Creature: Poring for Greenvale; Wolf remains a separate forest benchmark.

Do not change map ID, map dimensions, spawn coordinates, walkability, collision, warps, encounter behavior, save data or combat rules as part of the art-only rollout.

## 3. Asset Pipeline — concept to in-game

### Stage A — Art Bible and reference lock
- Use this document as the shared style contract.
- Maintain approved front/side/back/diagonal character references and palette swatches.
- Every new generation prompt must include the approved reference image(s), camera, pixel density, palette and transparent-background requirement where applicable.
- Generate one asset family at a time; do not mix unrelated styles in one production batch.

**Gate:** Art Director approves the benchmark assets before bulk production.

### Stage B — Asset breakdown and specifications
Create an asset manifest before generation. Each record should include:
- Stable asset ID and display name.
- Category and map/biome.
- Source/reference image.
- Canvas/frame dimensions and pivot/anchor.
- Direction and animation frame count.
- Transparency requirement.
- Collision footprint and interaction status (where applicable).
- Export filename, version and approval status.

### Stage C — Generate modular source art
Recommended generation order:
1. Novice character benchmark.
2. Poring benchmark.
3. Greenvale ground tiles and water edges.
4. One representative house, shop stall, tree, lamp, fence and bridge.
5. Greenvale NPC set.
6. Remaining district buildings and decorative props.

Generate isolated assets on transparent backgrounds whenever possible. Use a separate orthographic/isometric asset sheet for modular environment pieces; avoid baking the whole village into one image.

### Stage D — Pixel cleanup and slicing
- Inspect every output at 100% and nearest-neighbor enlarged scale.
- Correct inconsistent pixel size, stray pixels, outlines, palette drift, perspective and contact shadows.
- Remove unwanted background pixels and verify alpha transparency.
- Slice sprite sheets to exact frame bounds; keep animation frame alignment consistent.
- Create collision footprints separately from visible art.
- Keep editable source files (for example, Aseprite/PNG source sheets) outside the runtime bundle where practical.

AI output is a draft: do not ship an unreviewed generated image as a final game asset.

### Stage E — Export and asset registration
- Runtime format: optimized PNG with alpha for sprites; use lossless WebP only for large static artwork if transparency and browser support are verified.
- Preserve native pixel resolution. Scale with nearest-neighbor only.
- Use deterministic filenames and a manifest/registry so code never depends on manually guessed filenames.
- Suggested naming: `environment/greenvale/ground/grass_a.png`, `characters/novice/novice_walk_s.png`, `monsters/poring/poring_idle.png`.
- Keep source art, approved exports and runtime assets in separate folders.

### Stage F — Game integration
- Integrate incrementally into the existing Canvas renderer.
- Preserve the logical map grid and existing 64×32 isometric projection.
- Draw ground first, then low props, depth-sorted actors/objects, tall structures and foreground occluders.
- Use a consistent foot-point anchor for characters and creatures; sort actors by their world-space foot Y (and stable tie-breaker).
- Keep collision, walkability, interaction areas and warp data in map data, not inferred from image transparency.
- Replace procedural drawing in controlled categories; retain a fallback renderer until each category passes regression.
- Do not rewrite save schema or gameplay systems for visual replacement.

### Stage G — Visual QA and release gate
Test on desktop and real mobile devices:
- Tile seams and edge transitions at all joins.
- Isometric alignment and consistent scale.
- Character foot placement, 8-direction facing and animation timing.
- Occlusion behind buildings/trees and foreground overlap.
- Tap targets and monster interaction remain accurate.
- Pixel sharpness at multiple device-pixel ratios; no smoothing blur.
- Frame rate, memory and load time on mobile.
- Existing movement, collision, encounters, combat, save/resume and map warps remain unchanged.

**Release gate:** no broad asset rollout until Novice + Poring + a small Greenvale tile/prop set pass visual and gameplay regression.

## 4. Suggested repository structure

```text
assets/
  source/
    concepts/
    characters/
    monsters/
    environment/
    ui/
  game/
    characters/
      novice/
      npcs/
    monsters/
      poring/
      wolf/
    environment/
      greenvale/
        ground/
        water/
        buildings/
        nature/
        props/
        landmarks/
    items/
    cards/
    ui/
    vfx/
  manifests/
    assets.json
    greenvale.json
```

Keep original concept boards in `assets/source/concepts/`; never use a full-scene concept board as the runtime map background.

## 5. First production milestone — Greenvale Art Benchmark

**Deliverables**
- Novice: idle + walk, 8 directions, 96×96 baseline frame cell.
- Poring: idle + bounce/move, clear silhouette and transparent background.
- Ground: grass, dirt path, stone plaza, water and transition/edge tiles, aligned to the existing 64×32 isometric grid.
- Props: one tree, bush, flower patch, lamp, sign, fence segment, barrel and bridge segment.
- Buildings: one small house and one market stall as modular building benchmarks.
- Manifest entries and in-game test scene.

**Acceptance criteria**
- All assets visibly share one pixel scale, outline language and palette discipline.
- No visible seams in a representative map patch.
- Player and Poring remain readable on phone screens.
- Tap/movement/collision/encounter behavior remains unchanged.
- Existing save data loads without migration.

## 6. Change control

This is an art-only direction and pipeline. It does not authorize changes to confirmed game mechanics, map logic, progression, card rules, save format or content balance. Any such change requires a separate design decision. The earlier 2.5D exploratory direction is retained as history, but is not the current primary style after the user's explicit Pixel Art selection.
