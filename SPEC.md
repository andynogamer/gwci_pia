# SPEC — Micro-Tanks Arena 3D

This is the **anchoring specification**. Implementation work is valid only when it traces to a `REQ-*` identifier below and respects [CONSTITUTION.md](./CONSTITUTION.md).

Status values used in this document:

- `SCAFFOLD` — directory or stub exists; behavior not implemented
- `PARTIAL` — some required behavior exists
- `DONE` — requirement is demonstrable in Chrome and mapped to code

---

## Product Intent

A browser-based 3D arena tank game for academic rubric evaluation:

- Local PvE horde survival against FOV-aware AI tanks
- Networked 1v1 PvP over WebSockets
- Decoupled HTML/CSS UI overlay
- Custom Three.js rendering, lighting, particles, and AABB collisions
- Express + MySQL persistence and `localStorage` settings

**Runtime:** Google Chrome (Evergreen)  
**Client:** Vite + Three.js r160+  
**Server:** Node.js, Express, WebSockets, MySQL

---

## Rubric Traceability Matrix

### REQ-UI (8 pts) — Four Mandatory Screens

| Field | Value |
| --- | --- |
| Requirement | Main Menu, Settings, Highscores, Pause |
| Isolation | HTML/CSS overlay views only; no Three.js in UI |
| Trigger | EventBus game-state topics |
| Implementation path | `/src/ui/screens/` |
| Owner | Agent-UI |
| Status | SCAFFOLD |

**Acceptance:**

- Main Menu can start a match (mode, map, difficulty).
- Settings expose audio sliders and control bindings; values persist via `localStorage`.
- Highscores table renders REST leaderboard data.
- Pause overlay appears on `GAME_PAUSE` while Playing.

---

### REQ-COL-LIGHT (4 pts) — Collision Detection and Dual Lighting

| Field | Value |
| --- | --- |
| Requirement | Collision detection and dual lighting (Ambient + Focal) |
| Isolation | Lighting in engine; AABB collision in logic |
| Implementation path | `/src/engine/lights/`, `/src/logic/physics/` |
| Owners | Agent-Engine (lights), Agent-Logic (collisions) |
| Status | DONE |

**Acceptance:**

- Scene contains `THREE.AmbientLight`.
- Each local tank headlight is a `THREE.SpotLight` that casts shadows.
- Collisions use `THREE.Box3` AABBs only (no Cannon/Ammo/Rapier).
- Tanks, projectiles, obstacles, and map bounds participate in the collision manager.

---

### REQ-DIFF (10 pts) — At Least Two Difficulty Levels

| Field | Value |
| --- | --- |
| Requirement | Non-time-based variance between difficulties |
| Implementation path | `/src/logic/ai/` |
| Owner | Agent-Logic |
| Status | SCAFFOLD |

| Parameter | EASY (Recruit) | HARD (Veteran) |
| --- | --- | --- |
| FOV cone | 60 degrees | 120 degrees |
| Reaction latency | 1.2 s | 0.3 s |
| Fire behavior | Low fire rate | Trajectory prediction |
| Time pressure | Must **not** be the differentiator | Must **not** be the differentiator |

**Acceptance:** Changing difficulty changes AI perception/combat parameters, not match duration or a countdown clock.

---

### REQ-MAPS (10 pts) — At Least Three Distinct Thematic Arenas

| Map ID | Name | Theme notes | Path |
| ---: | --- | --- | --- |
| 1 | Desert Dunes | Sand, stone ruins, warm light | `/src/engine/maps/` |
| 2 | Industrial Complex | Metal obstacles, nocturnal lighting | `/src/engine/maps/` |
| 3 | Lunar Station | Craters, harsh directional light | `/src/engine/maps/` |

| Field | Value |
| --- | --- |
| Owner | Agent-Engine (visuals), Agent-Logic (walkable bounds / collision volumes) |
| Status | DONE |

**Acceptance:** Each map is selectable from the Main Menu, visually distinct, and provides unique obstacle layouts.

---

### REQ-MODES (10 pts) — At Least Two Distinct Game Modes

| Mode | Code | Description | Path |
| --- | --- | --- | --- |
| Horde Survival | `PVE` | Waves against autonomous AI | `/src/logic/gamemodes/` |
| Network Duel | `PVP` | 1v1 synchronized over WebSockets | `/src/logic/gamemodes/` |

| Field | Value |
| --- | --- |
| Owner | Agent-Logic (rules), Agent-Network (PVP transport) |
| Status | SCAFFOLD |

**Acceptance:** Mode is chosen before `GAME_START`. PVE never requires a socket. PVP does not simulate opponent AI locally as the authority.

---

### REQ-SRV-DB (4 pts) — Web Service + Remote Database + Local Storage

| Layer | Implementation | Path |
| --- | --- | --- |
| REST API | Node.js Express | `/server/` routes |
| Remote DB | MySQL pool, parameterized queries | `/server/config/db.js`, `/server/schema.sql` |
| Client persistence | `localStorage` settings | `/src/ui/` |

| Field | Value |
| --- | --- |
| Owners | Agent-Network (API/DB), Agent-UI (localStorage) |
| Status | SCAFFOLD |

**Acceptance:** Register, login, submit score, and fetch top scores succeed against MySQL. Settings survive a browser refresh without hitting the server.

---

### REQ-SND-ITM (10 pts) — Audio and Minimum Three Special Items

| Domain | Minimum set | Path |
| --- | --- | --- |
| Audio | BGM loop + engine, fire, explosion SFX | `/src/logic/audio/` |
| Items | Shield, Triple Shell, Repair Kit | `/src/logic/items/` |

| Field | Value |
| --- | --- |
| Owner | Agent-Logic |
| Status | SCAFFOLD |

**Acceptance:** Volumes respond to `SETTINGS_UPDATED`. Item pickup emits `ITEM_COLLECTED` and applies the documented lifecycle.

---

### REQ-MULTI (10 pts) — Real-Time Multiplayer

| Field | Value |
| --- | --- |
| Transport | WebSockets |
| Payload | Compressed position, rotation, firing vectors |
| Paths | `/src/network/`, `/server/ws/` |
| Owner | Agent-Network |
| Status | SCAFFOLD |

**Acceptance:** Two Chrome clients in one room see each other's chassis position, yaw, turret angle, and firing events with a client heartbeat and room handshake.

---

### REQ-AI-PART (4 pts) — Particles and AI Target Tracking with FOV

| Domain | Implementation | Path |
| --- | --- | --- |
| Particles | `THREE.Points` blasters (muzzle, impact, smoke, explosion) | `/src/engine/particles/` |
| AI tracking | `u · v` FOV cone + `THREE.Raycaster` LOS | `/src/logic/ai/` |

| Field | Value |
| --- | --- |
| Owners | Agent-Engine (particles), Agent-Logic (AI) |
| Status | SCAFFOLD |

**Acceptance:** Particles are delta-time scaled and disposed. AI does not engage targets outside the cone or occluded by obstacles.

---

## Cross-Cutting Spec Constraints

These are specification constraints, not optional style notes:

1. Delta time from `THREE.Clock` scales motion, AI, projectiles, and particles.
2. Scene restart / entity death disposes geometries, materials, and textures.
3. UI never reads `object3D.position` / `quaternion`; HUD data arrives via EventBus.
4. Engine never evaluates HP, win conditions, or network I/O.
5. Network never decides collisions or damage formulas.

---

## `GAME_START` Spec Binding

Payload defined in [CONTRACTS.md](./CONTRACTS.md):

```json
{
  "mode": "PVE" | "PVP",
  "mapId": 1 | 2 | 3,
  "difficulty": "EASY" | "HARD"
}
```

| Field | Binds to |
| --- | --- |
| `mode` | REQ-MODES |
| `mapId` | REQ-MAPS |
| `difficulty` | REQ-DIFF |
