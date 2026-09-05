# Micro-Tanks Arena 3D

Browser 3D tank arena for academic rubric evaluation. Development is **spec-anchored**: agents and contributors implement [SPEC.md](./SPEC.md) without violating [CONSTITUTION.md](./CONSTITUTION.md).

| Layer | Stack |
| --- | --- |
| Runtime | Google Chrome (Evergreen) |
| Client | Vite, Three.js r160+ |
| Server | Node.js, Express, WebSockets, MySQL |
| UI | HTML5/CSS in `#ui-root`, EventBus only to the 3D loop |

## Governance map

| Document | Role |
| --- | --- |
| [CONSTITUTION.md](./CONSTITUTION.md) | Invariant laws, agent boundaries |
| [AGENTS.md](./AGENTS.md) | Root agent router |
| [SPEC.md](./SPEC.md) | `REQ-*` rubric spec |
| [CONTRACTS.md](./CONTRACTS.md) | EventBus, WebSocket, REST |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Folders and import direction |
| [WORK_ITEMS.md](./WORK_ITEMS.md) | Implementation queue (`WI-XXX`) |
| [docs/SAD.md](./docs/SAD.md) | How to execute one work item |
| Nested `AGENTS.md` | Per-agent charters under `src/*` and `server/` |
| `.cursor/rules/*.mdc` | Cursor enforcement of the same boundaries |

## Agent scopes

| Agent | Path |
| --- | --- |
| Engine | `src/engine/` |
| Logic | `src/logic/` |
| UI | `src/ui/` |
| Network | `src/network/` + `server/` |
| Shared kernel | `src/core/` |

## Bootstrap (after implementation work begins)

Client (repo root):

```bash
npm install
npm run dev
```

Server (`server/`):

```bash
npm install
npm start
```

MySQL schema: `server/schema.sql`.

This repository currently contains **governance + structural stubs**. Gameplay is not implemented until an item in [WORK_ITEMS.md](./WORK_ITEMS.md) is executed.

**Loop:** pick the next `WI-XXX` → paste its Prompt into Cursor → verify in Chrome → mark `DONE`. Details: [docs/SAD.md](./docs/SAD.md).
