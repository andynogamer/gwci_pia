# Spec-Anchored Development (SAD) Protocol

Micro-Tanks Arena 3D is developed against frozen specs, not against ad-hoc prompts.

**Order of authority:**

1. [CONSTITUTION.md](../CONSTITUTION.md) — invariant laws
2. [SPEC.md](../SPEC.md) — rubric requirements (`REQ-*`)
3. [CONTRACTS.md](../CONTRACTS.md) — on-the-wire and EventBus schemas
4. Nested `AGENTS.md` — directory isolation
5. Implementation code

A change that improves gameplay but violates a higher document is rejected.

**Queue:** [WORK_ITEMS.md](../WORK_ITEMS.md) is the only list of slices that may be implemented.  
`SPEC.md` does not get coded directly. Each `REQ-*` is delivered by one or more `WI-XXX` rows.

---

## Loop

1. Open `WORK_ITEMS.md` and pick the next item whose dependencies are `DONE`.
2. Set that item to `IN_PROGRESS` (only one `IN_PROGRESS` per agent).
3. Paste the item’s **Prompt** into the agent chat. Do not add extra scope.
4. The agent reads the nested `AGENTS.md` for its folder and runs the four gates below.
5. Verify in Google Chrome (screens, match start, or the item’s acceptance line).
6. Mark the WI `DONE`. If every WI for a `REQ-*` is done, set that requirement in `SPEC.md` to `PARTIAL` or `DONE`.

Never implement a feature that is not a work item. If you need new work, append a WI using the template in `WORK_ITEMS.md` (do not silently grow an existing item).

---

## Work-Item Execution Protocol

Every agent assigned to a task must complete these four gates.

### 1. Contract Audit

- List incoming and outgoing EventBus topics.
- If REST or WebSockets are involved, quote the schema from CONTRACTS.md.
- If a new field is required, update CONTRACTS.md in the same change set.
- Never put `THREE.*` objects or DOM nodes on the bus.

### 2. Directory Isolation

- Edit only files inside the agent’s allowed scope (CONSTITUTION.md §2).
- `/src/main.js` wiring-only changes are allowed when the task is integration.
- `/src/core/` changes require a contract update and are not owned by a single feature agent.

### 3. Regression Prevention

Confirm all of the following:

- No Babylon.js, PlayCanvas, Phaser, Cannon.js, Ammo.js, or Rapier.
- Engine/logic code does not call `document`, `window.getComputedStyle`, or write CSS.
- UI code does not import `three` or read object3D transforms.
- Network/server code does not spawn meshes or run AABB combat rules.
- Motion, AI, projectiles, and particles are multiplied by `THREE.Clock` delta.

### 4. Performance Gate

Target runtime: Google Chrome.

- Stable ~60 FPS in DevTools Performance while Playing.
- After a scene restart or match reset, GPU/CPU memory must not trend upward (geometries, materials, and textures disposed).
- Particle systems and map colliders are torn down on `GAME_OVER` / map unload.

---

## Suggested Work-Item Header

Canonical items live in [WORK_ITEMS.md](../WORK_ITEMS.md). If you must file a new one, use that file’s template. For chat/PRs the header is:

```
WI: WI-0XX
REQ: REQ-??
Agent: Engine | Logic | UI | Network | Integrator
Scope: <directory>
Contracts: <topics / endpoints>
Out of scope: <forbidden folders>
Dispose plan: <resources to .dispose()>
```

---

## Invalid Work (automatic reject)

- Introducing a second renderer or physics engine
- HUD drawn in the WebGL scene instead of `#ui-root`
- Difficulty implemented only as a shorter timer
- PVP physics solved on the server
- New EventBus topic used in code but missing from CONTRACTS.md
