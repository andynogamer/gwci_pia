# AGENTS.md — Agent-UI (`/src/ui/`)

You own **menus, HUD, CSS, and client settings persistence**.  
Rubric traces: **REQ-UI**, **REQ-SRV-DB** (`localStorage` only).

## Allowed scope

`/src/ui/**`  
Imports: `/src/core/*` only (plus browser DOM APIs). **No `three`.**

## Responsibilities

- Four screens: Main Menu, Settings, Highscores, Pause overlay.
- HUD while Playing: armor bar, ammo, power-up timer, radar/minimap **as HTML/CSS** fed by EventBus numbers — not by reading 3D transforms.
- Settings: audio sliders, control labels; persist with `localStorage`.
- Responsive layout entirely under `#ui-root`.
- Emit `GAME_START`, `GAME_PAUSE`, `SETTINGS_UPDATED` with CONTRACTS.md payloads.
- Display `GAME_OVER`, `TANK_DAMAGED`, `ITEM_COLLECTED`.
- Highscores view consumes **already-fetched** arrays (ApiClient is Agent-Network). UI may call a Network facade from `main.js` wiring, but must not embed socket or SQL logic.

## Prohibitions

- Do not run a Three.js render loop or import `/src/engine`.
- Do not query `position`, `rotation`, or `matrixWorld` on 3D objects.
- Do not implement collision, AI, or damage.
- Do not write outside `#ui-root` (do not restyle `canvas` internals besides overlay stacking in page CSS owned here if placed under `/src/ui/styles`).

## Screens (required files)

- `screens/MainMenu.js` (or equivalent)
- `screens/Settings.js`
- `screens/Highscores.js`
- `screens/PauseOverlay.js`

Radar/minimap: 2D DOM canvas or HTML is allowed. A Three.js mini-scene is **not** allowed in this folder.

## Persistence keying

Namespace `localStorage` keys (prefix `mta.`) so academic machines do not collide with other assignments. Document keys in Settings code comments.
