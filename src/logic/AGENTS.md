# AGENTS.md — Agent-Logic (`/src/logic/`)

You own **game state, physics, tanks, AI, items, modes, and audio**.  
Rubric traces: **REQ-COL-LIGHT** (AABB), **REQ-DIFF**, **REQ-MODES**, **REQ-SND-ITM**, **REQ-AI-PART** (FOV/AI).

## Allowed scope

`/src/logic/**` and read-only `/public/audio/`.  
Imports: `/src/core/*`, Three.js **math/primitives only** as needed (`Clock`, `Box3`, `Sphere`, `Raycaster`, `Vector3`), plus narrow `/src/engine` facades for spawn/dispose — never UI or network protocol modules.

## Responsibilities

- State machine: Boot → Menu → Playing → Paused → GameOver.
- Tank kinematics: chassis steer/throttle (WASD); independent turret via **left/right arrow keys**, scaled by `dt`. Do not query DOM style for aim.
- AABB collisions via `THREE.Box3` (no Cannon/Ammo/Rapier).
- Enemy AI:
  - FOV: `dot(u, v)` cone
  - LOS: `THREE.Raycaster` against obstacles
  - FSM: Patrol, Investigate, Pursue, Engage
- Difficulty (non-time-based):
  - EASY: 60° FOV, 1.2 s reaction, low fire rate
  - HARD: 120° FOV, 0.3 s reaction, trajectory prediction
- Modes: `PVE` horde waves, `PVP` duel rules (transport is Agent-Network).
- Items: Shield, Triple Shell, Repair Kit.
- Web Audio: BGM + engine/fire/explosion SFX; volumes from `SETTINGS_UPDATED`.

## Prohibitions

- Do not manipulate CSS or write DOM elements.
- Do not own REST/WebSocket clients (emit bus events; Network agent transports).
- Do not implement GLSL, map mesh authoring, or HUD layout.
- Do not assume 60 Hz; multiply all motion, AI timers, and ballistics by delta time from `THREE.Clock`.

## Contracts you own as publisher

- `GAME_OVER`, `TANK_DAMAGED`, `ITEM_COLLECTED`, `PLAYER_FIRE` (local simulation), `HUD_STATE` (radar + power-up remaining), `CLIENT_STATE_UPDATE` (local PVP pose)
- Subscribe: `GAME_START`, `GAME_PAUSE`, `SETTINGS_UPDATED`, `ROOM_READY` (PVP pads), `MATCH_END` (PVP abort / peer leave), remote fire / remote `CLIENT_STATE_UPDATE` translated by Network onto the bus

## Audio note

Playback stays in logic. UI only stores slider values and emits `SETTINGS_UPDATED`.
