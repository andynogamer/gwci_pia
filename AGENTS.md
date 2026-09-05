# AGENTS.md — Micro-Tanks Arena 3D

You are working in a **Spec-Anchored Development** repository. Code is valid only when it obeys [CONSTITUTION.md](./CONSTITUTION.md), traces to [SPEC.md](./SPEC.md), and matches [CONTRACTS.md](./CONTRACTS.md).

Read this file first, then the nested `AGENTS.md` for the directory you are about to edit.

---

## Role of this file

This is the **router**, not a dumping ground for game design. Keep agent-specific laws in nested charters:

| Scope | Nested charter |
| --- | --- |
| `/src/core/` | [src/core/AGENTS.md](./src/core/AGENTS.md) |
| `/src/engine/` | [src/engine/AGENTS.md](./src/engine/AGENTS.md) |
| `/src/logic/` | [src/logic/AGENTS.md](./src/logic/AGENTS.md) |
| `/src/ui/` | [src/ui/AGENTS.md](./src/ui/AGENTS.md) |
| `/src/network/` | [src/network/AGENTS.md](./src/network/AGENTS.md) |
| `/server/` | [server/AGENTS.md](./server/AGENTS.md) |

Implementation queue: [WORK_ITEMS.md](./WORK_ITEMS.md).  
Workflow gates: [docs/SAD.md](./docs/SAD.md).  
Directory map: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Identify your agent

| If you will edit | You are | You must not edit |
| --- | --- | --- |
| `/src/engine/**` | Agent-Engine | `/src/logic`, `/src/ui`, `/src/network`, `/server` |
| `/src/logic/**` | Agent-Logic | `/src/engine`, `/src/ui`, `/src/network`, `/server` |
| `/src/ui/**` | Agent-UI | `/src/engine`, `/src/logic`, `/src/network`, `/server` |
| `/src/network/**` or `/server/**` | Agent-Network | `/src/engine`, `/src/logic`, `/src/ui` |
| `/src/core/**` | Shared kernel steward | Anything else unless the task is explicitly integration |
| `/src/main.js`, `/index.html`, `/package.json` | Integrator | Game rules, shaders, HUD CSS, SQL |

If a task needs two agents, split the work. Do not cross the boundary in a single unreviewed dump.

---

## Global prohibitions (all agents)

- No Babylon.js, PlayCanvas, Phaser 3D, Cannon.js, Ammo.js, Rapier, or other substitute engines.
- No physics or render loop writes to the DOM. UI lives in `#ui-root` only.
- No EventBus payloads containing Three.js objects or DOM nodes.
- No hardcoded 60 Hz / 144 Hz step sizes; use `THREE.Clock` delta.
- No leaked GPU resources: every `BufferGeometry`, `Material`, and `Texture` needs `.dispose()` on teardown.
- No new EventBus topics, REST fields, or WS events unless [CONTRACTS.md](./CONTRACTS.md) is updated in the same change.

---

## Before writing code

1. Identify the `WI-XXX` from [WORK_ITEMS.md](./WORK_ITEMS.md). If none matches, stop and add a WI first.
2. Name the `REQ-*` from SPEC.md that WI cites.
3. Run a contract audit (topics, REST, WS).
4. Open the nested `AGENTS.md` for your scope and obey its prohibitions.
5. Confine diffs to that scope. Do not execute a second WI in the same pass.

## After writing code

1. Confirm import graph matches ARCHITECTURE.md.
2. Confirm no forbidden libraries.
3. Describe dispose / pause behavior if the change allocates runtime objects.

---

## Composition root

`/src/main.js` wires modules together. It must stay thin. Feature logic belongs in the owning agent folder.

---

## Invalid output

Any generated patch that violates CONSTITUTION.md §1 or §2 is **INVALID**, even if it “works” in the browser.
