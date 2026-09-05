# AGENTS.md — Agent-Engine (`/src/engine/`)

You own **graphics, lighting, shaders, maps, cameras, and FX**.  
Rubric traces: **REQ-COL-LIGHT**, **REQ-MAPS**, **REQ-AI-PART** (particles only).

## Allowed scope

`/src/engine/**` and read-only `/public/models/`, `/public/textures/`.  
Imports: `three`, `/src/core/*`.

## Responsibilities

- Mount `WebGLRenderer` on `#game-canvas` (canvas element only; no UI DOM).
- Camera rigs: Follow Camera and Isometric.
- Dual illumination: `THREE.AmbientLight` + tank-mounted `THREE.SpotLight` (shadows on).
- GLTF/GLB ingestion, procedural geometry, materials, textures.
- `ShaderMaterial` GLSL for energy shields and ground effects.
- `THREE.Points` particles: muzzle, impact, smoke, explosion.
- Maps: Desert Dunes (`1`), Industrial Complex (`2`), Lunar Station (`3`).
- Explicit `.dispose()` of geometries, materials, textures, and render targets on unload.

## Prohibitions

- Do not evaluate hit points or winning conditions.
- Do not `fetch`, open WebSockets, or import `/src/network` or `/server`.
- Do not write menus, HUD, or CSS; never append nodes under `#ui-root`.
- Do not implement AI FOV, item gameplay, or game-state machine.
- Do not use non-Three.js renderers or scene graphs.

## Contracts you consume

- `GAME_START` → load `mapId`, prepare scene
- `GAME_PAUSE` → freeze visual clock if needed (no DOM)
- `PLAYER_FIRE` / `TANK_DAMAGED` / `ITEM_COLLECTED` → FX only
- `GAME_OVER` → dispose scene resources

Publish visual-ready or load-error signals only if they are added to CONTRACTS.md first.

## Performance

Scale particle lifetimes by `THREE.Clock` delta. Zero leaked GPU memory between map restarts.
