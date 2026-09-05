# CONSTITUTION — MICRO-TANKS ARENA 3D

**Paradigm:** Spec-Anchored Development (SAD)  
**Runtime Target:** Google Chrome (Evergreen)  
**Core Stack:** Three.js (r160+), Vite, Node.js, Express, WebSockets, MySQL  
**Purpose:** Academic evaluation rubric compliance with strict architectural isolation.

This document is the supreme law of the repository. Any proposal, automated commit, or code snippet that violates these laws is **INVALID**.

Related governance:

- [AGENTS.md](./AGENTS.md) — agent routing and work-item protocol
- [SPEC.md](./SPEC.md) — rubric requirements and traceability
- [CONTRACTS.md](./CONTRACTS.md) — EventBus, WebSocket, and REST schemas
- [ARCHITECTURE.md](./ARCHITECTURE.md) — directory map and ownership

---

## 1. Invariant Laws and Non-Negotiable Boundaries

### 1.1 Rendering Engine Monopoly

- Only **Three.js** is permitted for 3D rendering and WebGL pipelines.
- Third-party WebGL game engines or abstraction libraries (Babylon.js, PlayCanvas, Phaser 3D, and equivalents) are **strictly prohibited**.

### 1.2 Strict DOM / WebGL Decoupling

- No rendering logic, physics loops, or Three.js scene graphs may touch the DOM directly.
- All user interfaces (menus, HUD, configurations, leaderboards) reside exclusively in HTML5/CSS within the `#ui-root` container.
- Cross-boundary communication between UI and the 3D Engine is strictly mediated via the centralized **EventBus**.

### 1.3 Autonomous Physics (Zero Heavy Engine Overhead)

- External physics engines (Cannon.js, Ammo.js, Rapier, and equivalents) are **strictly prohibited**.
- Collisions, bounds checking, and spatial queries must rely exclusively on Three.js built-in primitives (`THREE.Box3`, `THREE.Sphere`, `THREE.Raycaster`).

### 1.4 Framerate Independence (Delta Timing Mandatory)

- All vehicle translations, turret rotations, projectile ballistics, particle lifetimes, and AI state updates must be scaled by delta time provided by `THREE.Clock`.
- Hardcoded frame steps assuming 60 Hz or 144 Hz display refresh rates are **forbidden**.

### 1.5 Deterministic Memory Management

- Every instantiated Three.js resource (`BufferGeometry`, `Material`, `Texture`) must implement an explicit `.dispose()` teardown routine upon scene transitions, game restarts, or entity destruction to eliminate memory leaks.

---

## 2. Agent Roles and File Boundary Matrix

### Agent 1: Agent-Engine (Graphics, Lighting, Shaders and FX)

- **Allowed Scope:** `/src/engine/`
- **Nested charter:** [src/engine/AGENTS.md](./src/engine/AGENTS.md)
- **Responsibilities:**
  - Canvas mounting, `WebGLRenderer`, and camera rigs (Follow Camera and Isometric).
  - Dual-illumination pipeline: Ambient light (`THREE.AmbientLight`) plus Focal light (`THREE.SpotLight` mounted to tank headlights).
  - 3D asset ingestion (GLTF/GLB models), procedural geometry, materials, and textures.
  - Custom GLSL shaders (`ShaderMaterial`) for energy shields and ground effects.
  - Particle systems (`THREE.Points`) for muzzle blasts, impacts, smoke, and explosions.
- **Prohibitions:** Must not evaluate hit points, execute winning conditions, or make HTTP/WebSocket calls.

### Agent 2: Agent-Logic (Physics, Game Loop, AI and Audio)

- **Allowed Scope:** `/src/logic/`
- **Nested charter:** [src/logic/AGENTS.md](./src/logic/AGENTS.md)
- **Responsibilities:**
  - Core Game State Machine (Boot, Menu, Playing, Paused, GameOver).
  - Tank kinematic controller (chassis steering, independent turret tracking via mouse raycasting).
  - Collision detection engine using Axis-Aligned Bounding Boxes (`THREE.Box3`).
  - Enemy Tank Artificial Intelligence:
    - Cone of vision: vector dot-product FOV checking combined with `THREE.Raycaster` line-of-sight obstacle masking.
    - Finite State Machine: Patrol, Investigate, Pursue, Engage.
  - Power-up state lifecycles: Shield, Triple Shell, Repair Kit.
  - Audio playback: SFX and background ambient music.
- **Prohibitions:** Must not manipulate CSS stylesheets or write DOM elements directly.

### Agent 3: Agent-UI (Menus, HUD and Client Persistence)

- **Allowed Scope:** `/src/ui/`
- **Nested charter:** [src/ui/AGENTS.md](./src/ui/AGENTS.md)
- **Responsibilities:**
  - Screen states: Main Menu, Settings (audio sliders, controls), Leaderboard Table, and Pause Overlay.
  - Dynamic in-game HUD (armor bar, ammo indicators, active power-up timer, radar/minimap).
  - Client settings persistence using `localStorage`.
  - Responsive CSS layout styling.
- **Prohibitions:** Must not run Three.js rendering loops or directly query 3D transforms.

### Agent 4: Agent-Network (Multiplayer and Backend Web Services)

- **Allowed Scope:** `/src/network/` and `/server/`
- **Nested charters:** [src/network/AGENTS.md](./src/network/AGENTS.md), [server/AGENTS.md](./server/AGENTS.md)
- **Responsibilities:**
  - Real-time Multiplayer (WebSockets): low-latency relay for 1v1 PvP duels (chassis position, yaw, turret angle, firing events).
  - Node.js WebSocket Server: room orchestration, match handshake, client heartbeat, and payload broadcasting.
  - REST Web Service (Node.js/Express): user registration/login and leaderboard persistence.
  - Database Layer (MySQL): relational schema, connection pool, and parameterized queries for scores and users.
- **Prohibitions:** Must not render geometry or process game physics rules.

### Shared Kernel (not an implementing agent)

- **Allowed Scope:** `/src/core/`
- **Nested charter:** [src/core/AGENTS.md](./src/core/AGENTS.md)
- All agents may **import** from `/src/core/`.
- Changes to EventBus topics or shared constants require a matching update to [CONTRACTS.md](./CONTRACTS.md).

---

## 3. Rubric Compliance Pointer

Full requirement text, scoring weights, and file-level traceability live in [SPEC.md](./SPEC.md).

| ID | Pts | Summary |
| --- | ---: | --- |
| REQ-UI | 8 | Four mandatory screens |
| REQ-COL-LIGHT | 4 | AABB collision + ambient/focal lighting |
| REQ-DIFF | 10 | Two non-time-based difficulty levels |
| REQ-MAPS | 10 | Three thematic arenas |
| REQ-MODES | 10 | Horde Survival + Network Duel |
| REQ-SRV-DB | 4 | REST + MySQL + localStorage |
| REQ-SND-ITM | 10 | BGM/SFX + three special items |
| REQ-MULTI | 10 | Real-time WebSocket multiplayer |
| REQ-AI-PART | 4 | Particles + AI FOV tracking |

---

## 4. Data Contracts Pointer

Canonical schemas live in [CONTRACTS.md](./CONTRACTS.md).

- EventBus topics and payloads
- WebSocket telemetry (`CLIENT_STATE_UPDATE`)
- REST endpoints (`/api/auth/*`, `/api/scores`)

---

## 5. Repository Architecture Pointer

Canonical tree and ownership live in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 6. Work-Item Execution Protocol

Implementation slices live in [WORK_ITEMS.md](./WORK_ITEMS.md). Code that is not a `WI-XXX` is out of process.

Every agent assigned to a task must enforce this workflow:

1. **Contract Audit:** Verify incoming/outgoing EventBus topics, REST formats, or WebSocket schemas against [CONTRACTS.md](./CONTRACTS.md).
2. **Directory Isolation:** Confine all file changes exclusively to the agent's assigned scope.
3. **Regression Prevention:** Confirm no forbidden dependencies are imported and no DOM calls leak into the 3D loop.
4. **Performance Gate:** Maintain stable 60 FPS in Google Chrome DevTools with zero memory growth between scene restarts.

Expanded checklist: [docs/SAD.md](./docs/SAD.md).
