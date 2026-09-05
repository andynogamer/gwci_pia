# ARCHITECTURE — Micro-Tanks Arena 3D

Ownership follows [CONSTITUTION.md](./CONSTITUTION.md) §2.  
If a file has no owner in this map, do not create it until the constitution is amended.

```
gwci_pia/                          # repository root (Micro-Tanks Arena 3D)
  CONSTITUTION.md                  # supreme law
  AGENTS.md                        # root agent router
  SPEC.md                          # rubric-anchored spec
  CONTRACTS.md                     # EventBus / WS / REST
  WORK_ITEMS.md                    # implementation queue (WI-XXX)
  ARCHITECTURE.md                  # this file
  README.md
  docs/
    SAD.md                         # how to execute one work item
  .cursor/rules/                   # Cursor-scoped enforcement
  index.html
  package.json
  vite.config.js
  public/
    audio/
    models/
    textures/
  server/                          # Agent-Network
    AGENTS.md
    package.json
    server.js
    config/
      db.js
    routes/
      auth.js
      scores.js
    ws/
      roomManager.js
    schema.sql
  src/
    main.js                        # composition root (wiring only)
    core/                          # shared kernel
      AGENTS.md
      EventBus.js
      Constants.js
    engine/                        # Agent-Engine
      AGENTS.md
      Renderer.js
      SceneManager.js
      CameraManager.js
      lights/
      maps/
      particles/
      shaders/
    logic/                         # Agent-Logic
      AGENTS.md
      GameManager.js
      entities/
      physics/
      ai/
      items/
      audio/
      gamemodes/
    ui/                            # Agent-UI
      AGENTS.md
      UIManager.js
      screens/
      components/
      styles/
    network/                       # Agent-Network (client)
      AGENTS.md
      NetworkClient.js
      ApiClient.js
```

---

## Composition Root

`/src/main.js` may import from all agent scopes to **wire** the application. It must not contain rendering math, physics, HUD markup, or socket protocol logic. Those belong in the owning agent folders.

`/index.html` hosts:

- The WebGL canvas mount point (`#game-canvas`) — written by Agent-Engine at boot
- `#ui-root` — exclusive UI subtree

---

## Import Direction

Allowed:

```
ui, engine, logic, network  →  core
main                        →  core, engine, logic, ui, network
logic                       →  engine (read-only visual handles / spawn requests via APIs, not DOM)
engine                      →  core only (plus Three.js)
ui                          →  core only (plus DOM/CSS)
network                     →  core only (plus fetch / WebSocket)
server                      →  nothing under /src
```

Forbidden:

```
engine  →  ui | network | logic game rules
logic   →  ui DOM/CSS | network protocol internals
ui      →  engine | three | logic internals
network →  engine | logic physics
```

Logic may call **narrow engine facades** (for example `sceneManager.spawnTankMesh(id)`) if those facades live in `/src/engine/` and do not leak scene-graph objects onto the EventBus.

---

## Asset Ownership

| Directory | Owner | Notes |
| --- | --- | --- |
| `/public/models/` | Agent-Engine | GLTF/GLB only |
| `/public/textures/` | Agent-Engine | Disposed with materials |
| `/public/audio/` | Agent-Logic | BGM + SFX buffers |
