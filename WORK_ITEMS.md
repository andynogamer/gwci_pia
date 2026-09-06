# WORK_ITEMS — Micro-Tanks Arena 3D

This file is the **only implementation queue**.  
Do not start coding from a free-form prompt. Pick a work item, paste its prompt, stay in its agent scope.

**How this relates to other docs**

| Doc | Job |
| --- | --- |
| [SPEC.md](./SPEC.md) | *What* must be true (`REQ-*`) |
| [CONTRACTS.md](./CONTRACTS.md) | *Shapes* of EventBus / REST / WS |
| [docs/SAD.md](./docs/SAD.md) | *How* an item is executed (4 gates) |
| **This file** | *Which slice* is next, and who owns it |

---

## Workflow (human + agent)

```
SPEC.md (frozen)  →  pick WI  →  set IN_PROGRESS
        →  paste Prompt into Cursor (one agent)
        →  4 gates in docs/SAD.md
        →  verify in Chrome
        →  mark WI DONE
        →  if that REQ is fully demonstrable, set SPEC.md status to PARTIAL or DONE
```

Rules:

1. **One WI at a time per agent.** Two agents may run in parallel only when their scopes do not overlap and neither is blocked.
2. **One agent per WI.** If a rubric row has two owners, it is already split (for example lighting vs AABB).
3. **Blocked** means a listed dependency is not `DONE`. Do not skip ahead into gameplay that the loop cannot drive.
4. **Integrator** items may touch `src/main.js` / `index.html` / `package.json` only as wiring.
5. Closing a WI does **not** rewrite CONSTITUTION.md. If the spec is wrong, amend SPEC/CONTRACTS first, then add a new WI.

Status: `TODO` · `IN_PROGRESS` · `BLOCKED` · `DONE`

---

## Board

| ID | REQ | Agent | Title | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [WI-001](#wi-001) | boot | Integrator | Install client/server and confirm canvas + `#ui-root` boot | — | DONE |
| [WI-002](#wi-002) | REQ-UI | UI | Four screens + navigation (menu, settings, highscores, pause) | WI-001 | DONE |
| [WI-003](#wi-003) | boot | Engine | Renderer loop, cameras, resize, dispose | WI-001 | DONE |
| [WI-004](#wi-004) | REQ-COL-LIGHT | Engine | Ambient + tank SpotLight (shadows) | WI-003 | DONE |
| [WI-005](#wi-005) | REQ-MAPS | Engine | Three thematic arenas | WI-003 | DONE |
| [WI-006](#wi-006) | boot | Logic | State machine + `THREE.Clock` game loop | WI-001 | DONE |
| [WI-007](#wi-007) | — | Logic | Local tank chassis + turret (delta-time) | WI-006, WI-003 | DONE |
| [WI-008](#wi-008) | REQ-COL-LIGHT | Logic | AABB collision manager (`THREE.Box3`) | WI-007, WI-005 | DONE |
| [WI-009](#wi-009) | REQ-AI-PART, REQ-DIFF | Logic | Enemy FOV, LOS raycast, AI FSM, two difficulties | WI-007, WI-008 | DONE |
| [WI-010](#wi-010) | REQ-AI-PART | Engine | `THREE.Points` muzzle / impact / smoke / explosion | WI-003 | DONE |
| [WI-011](#wi-011) | REQ-SND-ITM | Logic | BGM + SFX; Shield, Triple Shell, Repair Kit | WI-006 | DONE |
| [WI-012](#wi-012) | REQ-MODES | Logic | Horde Survival (PVE waves) | WI-009, WI-011 | DONE |
| [WI-013](#wi-013) | REQ-SRV-DB | Network | MySQL schema, auth + scores REST | WI-001 | DONE |
| [WI-014](#wi-014) | REQ-UI, REQ-SRV-DB | UI | Settings `localStorage`; highscores table from API | WI-002, WI-013 | DONE |
| [WI-015](#wi-015) | REQ-MULTI | Network | WebSocket 1v1 rooms + `CLIENT_STATE_UPDATE` | WI-007, WI-013 | DONE |
| [WI-016](#wi-016) | REQ-MODES | Logic | Network Duel rules (no transport code) | WI-012, WI-015 | DONE |
| [WI-017](#wi-017) | REQ-COL-LIGHT | Engine | Shield / ground `ShaderMaterial` | WI-010, WI-011 | DONE |
| [WI-018](#wi-018) | gate | Integrator | Chrome 60 FPS + zero leak on restart | WI-012, WI-016, WI-017 | DONE |
| [WI-019](#wi-019) | playability | UI + Logic + Engine | Pause hits, spawn facing, headlight, turret-follow cam | WI-007 | DONE |
| [WI-020](#wi-020) | playability | Logic + Engine + UI | Smoother follow cam; turret on arrow keys | WI-019 | DONE |
| [WI-021](#wi-021) | playability | Logic + Engine + UI | Spacebar fire; visible shells; HP from bullets only | WI-008 | DONE |
| [WI-022](#wi-022) | playability | Logic + Engine | EASY AI fires; headlight follows cannon | WI-009 | DONE |
| [WI-023](#wi-023) | playability | Logic | Recruit opening seconds are not a death sentence | WI-018, WI-022 | DONE |
| [WI-024](#wi-024) | REQ-UI | UI | Show `GAME_OVER` winner + score | WI-012, WI-018 | DONE |
| [WI-025](#wi-025) | REQ-UI | UI + Logic | HUD radar + power-up countdown from the bus | WI-011, WI-018 | DONE |
| [WI-026](#wi-026) | REQ-SRV-DB | UI + Network | Login/register; POST score on `GAME_OVER` | WI-014, WI-018 | DONE |
| [WI-027](#wi-027) | REQ-MULTI | Network | Two Chrome clients in one room (pose / turret / fire) | WI-015, WI-016, WI-018 | DONE |
| [WI-028](#wi-028) | REQ-MODES, REQ-SRV-DB | UI + Network | Network Duel requires signed-in session | WI-026, WI-016 | DONE |

**Next playable slice:** PVP duel — two signed-in Chrome tabs, same arena (`pvp-map-{1|2|3}`).

---

## New item template

Add at the bottom (never silently expand an existing WI’s scope). Copy the header into the chat prompt.

```
### WI-0XX
- REQ:
- Agent:
- Scope:
- Depends on:
- Contracts:
- Out of scope:
- Acceptance:
- Dispose / pause:
- Status: TODO
```

---

## Items

### WI-001

- **REQ:** boot (no rubric row; unblocks everything)
- **Agent:** Integrator
- **Scope:** `package.json`, `server/package.json`, README bootstrap only if needed
- **Depends on:** —
- **Contracts:** none
- **Out of scope:** gameplay, CSS screens, shaders
- **Acceptance:** `npm install` at repo root and in `server/` succeed; `npm run dev` shows canvas + `#ui-root`; server process starts on port 3001 (REST may still 501).
- **Dispose / pause:** n/a
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-001 only.
Agent: Integrator. Do not implement gameplay.
Install nothing globally. Confirm Vite and server entrypoints boot.
Stay out of src/engine, src/logic, src/ui feature code except if main.js wiring is broken.
```

---

### WI-002

- **REQ:** REQ-UI
- **Agent:** UI
- **Scope:** `/src/ui/`
- **Depends on:** WI-001
- **Contracts:** `GAME_START`, `GAME_PAUSE`, `SETTINGS_UPDATED`
- **Out of scope:** Three.js, `/src/engine`, REST server
- **Acceptance:** Main Menu, Settings, Highscores, Pause exist under `#ui-root` and can be shown/hidden without touching the canvas. Start emits a valid `GAME_START` payload.
- **Dispose / pause:** n/a
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-002 only.
You are Agent-UI. Read src/ui/AGENTS.md and CONTRACTS.md.
Implement four screens and navigation inside #ui-root.
Do not import three. Do not edit src/engine, src/logic, src/network, or server.
```

---

### WI-003

- **REQ:** boot / cameras
- **Agent:** Engine
- **Scope:** `/src/engine/` (`Renderer.js`, `SceneManager.js`, `CameraManager.js`)
- **Depends on:** WI-001
- **Contracts:** subscribe `GAME_START` / `GAME_OVER` for load/unload if already emitted
- **Out of scope:** HP, AI, DOM UI, network
- **Acceptance:** WebGLRenderer on `#game-canvas`; follow + isometric cameras; resize; `dispose()` clears renderer resources.
- **Dispose / pause:** geometries/materials/textures on unload
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-003 only.
You are Agent-Engine. Read src/engine/AGENTS.md.
Implement renderer loop, follow + isometric cameras, resize, and dispose.
Delta time from THREE.Clock. No DOM except the canvas. No gameplay rules.
```

---

### WI-004

- **REQ:** REQ-COL-LIGHT (lighting half)
- **Agent:** Engine
- **Scope:** `/src/engine/lights/`
- **Depends on:** WI-003
- **Contracts:** none new
- **Out of scope:** AABB, damage
- **Acceptance:** `THREE.AmbientLight` in scene; local tank `THREE.SpotLight` casts shadows.
- **Dispose / pause:** lights removed and disposed with scene
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-004 only.
You are Agent-Engine. Implement dual illumination: AmbientLight + tank-mounted SpotLight with shadows.
Do not implement collisions. Do not touch src/logic or src/ui.
```

---

### WI-005

- **REQ:** REQ-MAPS
- **Agent:** Engine
- **Scope:** `/src/engine/maps/`
- **Depends on:** WI-003
- **Contracts:** `GAME_START.mapId` `1 | 2 | 3`
- **Out of scope:** walkable AI (logic owns collider registration later)
- **Acceptance:** Desert Dunes, Industrial Complex, Lunar Station are visually distinct and selectable by `mapId`. Unload disposes map resources.
- **Dispose / pause:** full map teardown
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-005 only.
You are Agent-Engine. Implement three maps per SPEC.md REQ-MAPS.
Load from GAME_START.mapId. Dispose on unload. No physics rules, no UI.
```

---

### WI-006

- **REQ:** boot
- **Agent:** Logic
- **Scope:** `/src/logic/GameManager.js`
- **Depends on:** WI-001
- **Contracts:** `GAME_START`, `GAME_PAUSE`, `GAME_OVER`
- **Out of scope:** CSS, sockets, map meshes
- **Acceptance:** States Boot → Menu → Playing → Paused → GameOver. Playing loop uses `clock.getDelta()`. Pause stops simulation updates.
- **Dispose / pause:** pause does not leak intervals
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-006 only.
You are Agent-Logic. Read src/logic/AGENTS.md.
Implement the game state machine and a delta-time loop via THREE.Clock.
No DOM. No CSS. No WebSockets.
```

---

### WI-007

- **REQ:** tank control (supports all combat REQs)
- **Agent:** Logic
- **Scope:** `/src/logic/entities/`
- **Depends on:** WI-006, WI-003
- **Contracts:** `PLAYER_FIRE` `{ origin, direction, isLocal }`
- **Out of scope:** enemy AI, network encoding
- **Acceptance:** Chassis move/steer and turret follow mouse ray in world space; all motion `* dt`. Fire emits `PLAYER_FIRE`.
- **Dispose / pause:** frozen while Paused
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-007 only.
You are Agent-Logic. Implement local tank chassis + independent turret.
Use delta time. Emit PLAYER_FIRE per CONTRACTS.md.
Do not write DOM or CSS. Do not open sockets.
```

---

### WI-008

- **REQ:** REQ-COL-LIGHT (collision half)
- **Agent:** Logic
- **Scope:** `/src/logic/physics/`
- **Depends on:** WI-007, WI-005
- **Contracts:** `TANK_DAMAGED`
- **Out of scope:** Cannon/Ammo/Rapier; lighting
- **Acceptance:** Tanks, projectiles, obstacles, bounds use `THREE.Box3`. Hits publish `TANK_DAMAGED`.
- **Dispose / pause:** collider map cleared on match end
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-008 only.
You are Agent-Logic. Implement AABB collisions with THREE.Box3 only.
Publish TANK_DAMAGED. No external physics engines. No UI. No renderer ownership.
```

---

### WI-009

- **REQ:** REQ-AI-PART (AI), REQ-DIFF
- **Agent:** Logic
- **Scope:** `/src/logic/ai/`
- **Depends on:** WI-007, WI-008
- **Contracts:** uses `GAME_START.difficulty`
- **Out of scope:** particles, time-based difficulty
- **Acceptance:** FOV via `dot(u,v)`; LOS via `Raycaster`. FSM Patrol → Investigate → Pursue → Engage. EASY vs HARD per SPEC.md table (FOV, latency, fire/prediction — not match duration).
- **Dispose / pause:** AI ticks scaled by `dt`; paused when Paused
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-009 only.
You are Agent-Logic. Implement enemy AI FOV (dot product), Raycaster LOS, and FSM.
Difficulty EASY vs HARD per SPEC.md REQ-DIFF. No particle systems. No DOM.
```

---

### WI-010

- **REQ:** REQ-AI-PART (particles)
- **Agent:** Engine
- **Scope:** `/src/engine/particles/`
- **Depends on:** WI-003
- **Contracts:** `PLAYER_FIRE`, `TANK_DAMAGED` (FX only)
- **Out of scope:** damage math
- **Acceptance:** `THREE.Points` for muzzle, impact, smoke, explosion. Lifetimes `* dt`. Disposed on restart.
- **Dispose / pause:** mandatory
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-010 only.
You are Agent-Engine. Implement THREE.Points FX for muzzle, impact, smoke, explosion.
Delta-time lifetimes. Dispose on scene restart. No HP or win conditions.
```

---

### WI-011

- **REQ:** REQ-SND-ITM
- **Agent:** Logic
- **Scope:** `/src/logic/audio/`, `/src/logic/items/`
- **Depends on:** WI-006
- **Contracts:** `ITEM_COLLECTED`, `SETTINGS_UPDATED`
- **Out of scope:** HUD layout, GLSL (engine consumes shield later)
- **Acceptance:** BGM + engine/fire/explosion SFX. Volumes from settings. Items Shield, Triple Shell, Repair Kit with lifecycles.
- **Dispose / pause:** stop/resume audio on pause; item timers use `dt`
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-011 only.
You are Agent-Logic. Implement Web Audio BGM/SFX and three items (SHIELD, TRIPLE, REPAIR).
Honor SETTINGS_UPDATED. Emit ITEM_COLLECTED. No CSS. No Three.js materials.
```

---

### WI-012

- **REQ:** REQ-MODES (PVE)
- **Agent:** Logic
- **Scope:** `/src/logic/gamemodes/HordeSurvival.js`
- **Depends on:** WI-009, WI-011
- **Contracts:** `GAME_START.mode === "PVE"`, `GAME_OVER`
- **Out of scope:** WebSockets
- **Acceptance:** Wave horde vs AI. Score and winner published on `GAME_OVER`. Works offline.
- **Dispose / pause:** waves pause with the state machine
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-012 only.
You are Agent-Logic. Implement Horde Survival (PVE) per SPEC.md REQ-MODES.
No network code. Publish GAME_OVER per CONTRACTS.md.
```

---

### WI-013

- **REQ:** REQ-SRV-DB
- **Agent:** Network
- **Scope:** `/server/` (`schema.sql`, `config/db.js`, `routes/*`)
- **Depends on:** WI-001
- **Contracts:** CONTRACTS.md §C exactly
- **Out of scope:** Three.js, physics, HTML UI
- **Acceptance:** Parameterized MySQL. Register/login. Bearer POST scores. GET top scores. Passwords hashed.
- **Dispose / pause:** n/a
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-013 only.
You are Agent-Network (server). Read server/AGENTS.md and CONTRACTS.md §C.
Implement auth + scores against MySQL with parameterized queries.
Do not import src/. Do not simulate game physics.
```

---

### WI-014

- **REQ:** REQ-UI, REQ-SRV-DB (client persistence + table)
- **Agent:** UI
- **Scope:** `/src/ui/` (may call `ApiClient` via existing facade; do not rewrite sockets)
- **Depends on:** WI-002, WI-013
- **Contracts:** REST response arrays; `SETTINGS_UPDATED`; `localStorage` keys `mta.*`
- **Out of scope:** implementing Express routes
- **Acceptance:** Settings sliders persist across refresh. Highscores table fills from `GET /api/scores`.
- **Dispose / pause:** n/a
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-014 only.
You are Agent-UI. Wire Settings localStorage and Highscores table to ApiClient data.
Do not import three. Do not edit server/ or physics.
```

---

### WI-015

- **REQ:** REQ-MULTI
- **Agent:** Network
- **Scope:** `/src/network/NetworkClient.js`, `/server/ws/`
- **Depends on:** WI-007, WI-013
- **Contracts:** `CLIENT_STATE_UPDATE`, room handshake, heartbeat, fire relay
- **Out of scope:** AABB, damage formulas, map meshes
- **Acceptance:** Two Chrome clients in one room see opponent pose, turret, fire. Heartbeat drops stale rooms.
- **Dispose / pause:** close socket on GAME_OVER / leave
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-015 only.
You are Agent-Network. Implement WebSocket 1v1 per CONTRACTS.md §B.
Relay only. No rendering. No collision/damage logic.
```

---

### WI-016

- **REQ:** REQ-MODES (PVP)
- **Agent:** Logic
- **Scope:** `/src/logic/gamemodes/NetworkDuel.js`
- **Depends on:** WI-012, WI-015
- **Contracts:** `GAME_START.mode === "PVP"`, `GAME_OVER`
- **Out of scope:** `ws` / Express internals
- **Acceptance:** Duel rules consume remote state from the bus, not a local AI opponent as authority. Offline PVE still works.
- **Dispose / pause:** match teardown on GAME_OVER
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-016 only.
You are Agent-Logic. Implement Network Duel rules only.
Do not open WebSockets. Do not edit server/. Apply remote pose/fire from EventBus payloads.
```

---

### WI-017

- **REQ:** visual complement to REQ-SND-ITM / lighting
- **Agent:** Engine
- **Scope:** `/src/engine/shaders/`
- **Depends on:** WI-010, WI-011
- **Contracts:** `ITEM_COLLECTED` type `SHIELD` (FX only)
- **Out of scope:** item timers (logic)
- **Acceptance:** `ShaderMaterial` energy shield + ground effect. `uTime` scaled by `dt`. Disposed on unload.
- **Dispose / pause:** mandatory
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-017 only.
You are Agent-Engine. Implement ShaderMaterial shield and ground effects.
No gameplay state. Dispose materials on unload.
```

---

### WI-018

- **REQ:** constitution §6 performance gate
- **Agent:** Integrator
- **Scope:** wiring + leak fixes *inside the owning agent folders* (split follow-ups if a leak is isolated)
- **Depends on:** WI-012, WI-016, WI-017
- **Contracts:** none new
- **Out of scope:** new features
- **Acceptance:** Chrome Playing ~60 FPS. Restart match twice with no retained geometry/material/texture growth.
- **Dispose / pause:** prove teardown
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-018 only.
Performance and memory gate in Chrome. No new features.
If a leak is in one agent folder, fix only that folder and note the owner.
```

---

### WI-019

- **REQ:** playability (bugs from WI-002 / WI-003 / WI-004 / WI-007)
- **Agent:** UI + Logic + Engine (one slice; owners stay in their folders)
- **Scope:** `src/ui/styles`, `src/ui/UIManager.js`, `src/logic/entities/TankController.js`, `src/logic/GameManager.js`, `src/engine/CameraManager.js`, `src/engine/lights/DualLights.js`, `src/engine/tanks/LocalTankView.js`, `src/main.js` wiring
- **Depends on:** WI-007
- **Contracts:** existing `GAME_PAUSE` / `GAME_OVER` only
- **Out of scope:** AABB (WI-008), particles, new EventBus topics
- **Acceptance:** Pause Resume / Settings / Main Menu are clickable. W drives the hull away from the camera into the arena. Headlight is not shadowed by the barrel. Follow camera sits behind the turret and yaws with the cannon.
- **Dispose / pause:** pause still freezes sim; Main Menu despawns the tank
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-019 only.
Fix pause overlay hit-testing, spawn facing so W is world-forward,
move the tank SpotLight clear of the barrel, and follow-camera yaw = turretRotY.
```

---

### WI-020

- **REQ:** playability (control scheme + camera feel)
- **Agent:** Logic + Engine + UI
- **Scope:** `TankController.js`, `GameManager.js`, `CameraManager.js`, `main.js`, `Settings.js`, `CONSTITUTION.md`, `src/logic/AGENTS.md`
- **Depends on:** WI-019
- **Contracts:** none new
- **Out of scope:** mouse-aim turret (removed on purpose)
- **Acceptance:** Left/Right arrows yaw the cannon independently of WASD hull. Follow camera eases position and yaw (no snappy orbit). Settings keymap lists arrows. Fire remains left click.
- **Dispose / pause:** turret input ignored while Paused (loop already frozen)
- **Status:** DONE

---

### WI-021

- **REQ:** playability (fire feel + HP source)
- **Agent:** Logic + Engine + UI + Integrator
- **Scope:** `GameManager.js`, `SceneManager.js`, `main.js`, `Settings.js`
- **Depends on:** WI-008
- **Contracts:** none new (`PLAYER_FIRE`, `TANK_DAMAGED` unchanged)
- **Out of scope:** `THREE.Points` FX (WI-010); enemy tanks (WI-009)
- **Acceptance:** Space fires. A visible shell follows Logic AABB projectiles. Bumping obstacles/bounds does not change HP. Only projectile hits publish `TANK_DAMAGED`.
- **Dispose / pause:** shells cleared on match end; paused clock freezes flight
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-021 only.
Spacebar fire. Visible shells synced from Logic. HP only from bullets, not crashes.
```

---

### WI-022

- **REQ:** playability (EASY combat + turret headlight)
- **Agent:** Logic + Engine
- **Scope:** `EnemyAI.js`, `GameManager.js`, `DualLights.js`, `SceneManager.js`
- **Depends on:** WI-009
- **Contracts:** none new
- **Out of scope:** particles, waves
- **Acceptance:** Recruit (EASY) enemies fire after reaction latency. Headlight yaws with the cannon, not the hull.
- **Dispose / pause:** unchanged
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-022 only.
EASY AI must shoot. Parent the tank SpotLight to the turret.
```

---

### WI-023

- **REQ:** playability (found in WI-018 Chrome: Recruit Desert died in the opening seconds)
- **Agent:** Logic
- **Scope:** `/src/logic/gamemodes/HordeSurvival.js`, `/src/logic/ai/`, spawn in `GameManager.js` / `mapVolumes.js`
- **Depends on:** WI-018, WI-022
- **Contracts:** none new
- **Out of scope:** HUD, shaders, network, changing SHOT_DAMAGE as the only lever
- **Acceptance:** On Recruit (EASY) Desert, a player who stays at spawn for 8 s after Deploy is still alive. Wave 1 may spawn, but it must not land a same-frame volley from opening LOS. HARD may stay mean; EASY vs HARD must remain FOV / latency / fire-rate (REQ-DIFF), not a longer match timer.
- **Dispose / pause:** pause still freezes AI timers
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-023 only.
You are Agent-Logic. Recruit opening seconds killed the player in WI-018 Chrome.
Give wave-1 a spawn/engage grace so an idle tank at spawn survives ~8s on EASY Desert.
Do not nerf HARD into EASY. No DOM. No engine meshes.
```

---

### WI-024

- **REQ:** REQ-UI (`Display GAME_OVER` in `src/ui/AGENTS.md`)
- **Agent:** UI
- **Scope:** `/src/ui/` (new overlay or Main Menu result panel)
- **Depends on:** WI-012, WI-018
- **Contracts:** existing `GAME_OVER` `{ winner, score }` only
- **Out of scope:** REST POST (WI-026), radar (WI-025)
- **Acceptance:** After a match ends (death, victory, or Quit), `#ui-root` shows winner and score from the payload. Player can return to Main Menu and Deploy again. WI-018 Chrome currently skips this and dumps straight to the loadout form.
- **Dispose / pause:** overlay is DOM-only; does not keep the sim running
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-024 only.
You are Agent-UI. Subscribe to GAME_OVER and show winner + score under #ui-root.
Do not import three. Do not POST scores. Do not edit engine or logic.
```

---

### WI-025

- **REQ:** REQ-UI (HUD radar + power-up timer)
- **Agent:** UI + Logic (owners stay in their folders; Integrator wires if needed)
- **Scope:** `/src/ui/components/Hud.js`, `/src/logic/GameManager.js`, `/src/core/Constants.js` + [CONTRACTS.md](./CONTRACTS.md) in the same change
- **Depends on:** WI-011, WI-018
- **Contracts:** **new topic required.** WI-018 Chrome showed a static “Power-up —” chip and an empty `[data-radar]` box. UI must not read Object3D transforms. Add a JSON-only bus payload (for example `HUD_STATE`) with local `{x,z,rotY}`, other tanks `{id,x,z}`, and active power-up `{type, remaining}` or null. No Three.js objects.
- **Out of scope:** Three.js mini-scene radar; auth; GAME_OVER overlay (WI-024)
- **Acceptance:** While Playing, radar dots move from bus numbers. Power-up chip counts remaining seconds from Logic `dt`, not a hardcoded UI timer that ignores pause.
- **Dispose / pause:** paused clock freezes remaining; radar unsubs or ignores ticks while not Playing
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-025 only.
HUD radar + power-up countdown. Update CONTRACTS.md and Constants.js in the same change.
Logic publishes plain numbers; UI draws DOM/canvas under #ui-root. No three in /src/ui.
```

---

### WI-026

- **REQ:** REQ-SRV-DB (SPEC still PARTIAL: register / login / POST scores)
- **Agent:** UI + Network (Integrator may wire `ApiClient` / token in `main.js` only)
- **Scope:** `/src/ui/screens/` auth fields, `/src/network/` token + `POST /api/scores` on `GAME_OVER`
- **Depends on:** WI-014, WI-018
- **Contracts:** CONTRACTS.md §C exactly; no new REST fields
- **Out of scope:** MySQL schema changes; PVP transport (WI-027)
- **Acceptance:** Register + login from `#ui-root`. After an authenticated match, `GAME_OVER` POSTs `{ score, mode, difficulty }` with Bearer token. Highscores refresh shows that row. WI-018 never submitted a score (no auth UI, NetworkClient only disconnects).
- **Dispose / pause:** n/a (HTTP); do not log passwords
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-026 only.
Login/register in UI. On GAME_OVER, Network POSTs /api/scores when a token exists.
Do not invent REST fields. Do not open sockets for this item. Parameterized SQL already exists.
```

---

### WI-027

- **REQ:** REQ-MULTI (SPEC still PARTIAL; WI-018 was a single Chrome tab)
- **Agent:** Network (fix handshake/relay only; Logic already owns duel rules)
- **Scope:** `/src/network/NetworkClient.js`, `/server/ws/`
- **Depends on:** WI-015, WI-016, WI-018
- **Contracts:** existing `JOIN_ROOM` / `ROOM_READY` / `CLIENT_STATE_UPDATE` / `PLAYER_FIRE` / heartbeat
- **Out of scope:** server-side AABB; new WS events; HUD radar
- **Acceptance:** Two Chrome clients, same PVP room, same `mapId`: each sees opponent chassis, turret yaw, and fire. Heartbeat still drops a stale peer. Document the room id the menu uses if it is not obvious.
- **Dispose / pause:** socket closes on `GAME_OVER` / leave (already required)
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-027 only.
You are Agent-Network. Prove two Chrome clients in one 1v1 room.
Relay pose, turret, and fire only. No rendering. No damage math.
```

---

### WI-028

- **REQ:** REQ-MODES + REQ-SRV-DB (PVP participants must be authenticated)
- **Agent:** UI + Network
- **Scope:** `src/ui/screens/MainMenu.js`, `src/network/NetworkClient.js` (optional SPEC note)
- **Depends on:** WI-026, WI-016
- **Contracts:** none new (reuse persisted Bearer session from WI-026)
- **Out of scope:** JWT on WebSocket JOIN_ROOM; server AABB
- **Acceptance:** Guest cannot Deploy Network Duel — menu blocks `GAME_START` and prompts Sign In. NetworkClient refuses PVP `joinRoom` without a token. Horde Survival (PVE) still works signed out.
- **Dispose / pause:** n/a
- **Status:** DONE

**Prompt**

```
Execute WORK_ITEMS.md WI-028 only.
Require sign-in before Network Duel. PVE stays available to guests.
```

