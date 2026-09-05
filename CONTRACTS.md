# CONTRACTS — Micro-Tanks Arena 3D

Canonical protocols for EventBus, WebSockets, and REST.  
If code and this file disagree, **this file wins** until a constitution-compliant change updates both.

Owner of schema edits: coordinated change in `/src/core/` plus this document.  
See [src/core/AGENTS.md](./src/core/AGENTS.md).

---

## A. Internal EventBus Topics and Payloads

Implementation: `/src/core/EventBus.js`  
Topic name constants: `/src/core/Constants.js`

All payloads are plain JSON-serializable objects. Agents must not attach Three.js objects, DOM nodes, or class instances to EventBus payloads.

### GAME_START

```json
{
  "mode": "PVE" | "PVP",
  "mapId": 1 | 2 | 3,
  "difficulty": "EASY" | "HARD"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `mode` | `"PVE"` \| `"PVP"` | Horde Survival or Network Duel |
| `mapId` | `1` \| `2` \| `3` | Desert, Industrial, Lunar |
| `difficulty` | `"EASY"` \| `"HARD"` | Recruit vs Veteran AI |

**Publishers:** Agent-UI (menu confirm), optionally Agent-Logic after boot handshake  
**Subscribers:** Agent-Logic (state machine), Agent-Engine (map load), Agent-Network (PVP only)

### GAME_PAUSE

```json
{
  "isPaused": true
}
```

**Publishers:** Agent-UI, Agent-Logic (blur / escape)  
**Subscribers:** Agent-Logic (loop halt), Agent-UI (pause overlay), Agent-Engine (optional clock freeze — no DOM)

### GAME_OVER

```json
{
  "winner": "string",
  "score": 0
}
```

**Publishers:** Agent-Logic only  
**Subscribers:** Agent-UI (game-over / menu), Agent-Network (score submit when authenticated)

### PLAYER_FIRE

```json
{
  "origin": [0, 0, 0],
  "direction": [0, 0, 1],
  "isLocal": true
}
```

Vectors are world-space `[x, y, z]` numbers.  
**Publishers:** Agent-Logic (local input or remote event translation)  
**Subscribers:** Agent-Engine (muzzle FX), Agent-Logic (projectile spawn), Agent-Network (relay if local PVP)

### TANK_DAMAGED

```json
{
  "entityId": "string",
  "currentHp": 0,
  "maxHp": 100
}
```

**Publishers:** Agent-Logic only  
**Subscribers:** Agent-UI (HUD armor), Agent-Engine (optional hit FX), Agent-Network (PVP hp sync)

### ITEM_COLLECTED

```json
{
  "type": "SHIELD" | "TRIPLE" | "REPAIR",
  "entityId": "string"
}
```

**Publishers:** Agent-Logic  
**Subscribers:** Agent-UI (power-up timer), Agent-Engine (shield shader toggle), Agent-Logic (item lifecycle)

### SETTINGS_UPDATED

```json
{
  "masterVolume": 0,
  "sfxVolume": 0
}
```

Volumes are floats in `[0, 1]`.  
**Publishers:** Agent-UI  
**Subscribers:** Agent-Logic (audio graph)

---

## B. Real-Time WebSocket Telemetry

### CLIENT_STATE_UPDATE

Client → Server → broadcast to opponent.

```json
{
  "event": "CLIENT_STATE_UPDATE",
  "id": "player-uuid",
  "timestamp": 0,
  "pos": [0, 0, 0],
  "rotY": 0,
  "turretRotY": 0,
  "hp": 100
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `event` | `"CLIENT_STATE_UPDATE"` | Discriminator |
| `id` | string | Player UUID |
| `timestamp` | number | Client ms epoch |
| `pos` | `[x, y, z]` | Chassis world position |
| `rotY` | number | Chassis yaw (radians) |
| `turretRotY` | number | Turret yaw (radians) |
| `hp` | number | Current hit points (display/sync only; logic remains damage authority on each peer per server broadcast rules) |

Additional room events (names are reserved; payloads to be extended in this file before use):

| Event | Direction | Purpose |
| --- | --- | --- |
| `JOIN_ROOM` | C→S | Match handshake |
| `ROOM_READY` | S→C | Both peers present |
| `HEARTBEAT` | C→S→C | Liveness |
| `PLAYER_FIRE` | C→S→C | Firing vector relay (same numeric fields as EventBus `PLAYER_FIRE` without `isLocal`) |
| `MATCH_END` | S→C | Authoritative room close |

---

## C. REST API Endpoints

Base path: `/api`  
Implementation: `/server/routes/`  
Client: `/src/network/ApiClient.js`

### POST `/api/auth/register`

**Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**

```json
{
  "success": true,
  "userId": "string"
}
```

### POST `/api/auth/login`

**Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**

```json
{
  "token": "string",
  "username": "string"
}
```

### POST `/api/scores`

**Headers:** `Authorization: Bearer <token>`

**Body:**

```json
{
  "score": 0,
  "mode": "PVE" | "PVP",
  "difficulty": "EASY" | "HARD"
}
```

### GET `/api/scores?limit=10`

**Response:**

```json
[
  {
    "username": "string",
    "score": 0,
    "mode": "PVE",
    "difficulty": "EASY",
    "created_at": "ISO-8601"
  }
]
```

---

## Contract Audit Checklist

Before merging a protocol change:

1. Update this file first (or in the same change set).
2. Update `/src/core/Constants.js` topic names if EventBus is affected.
3. Update publishers/subscribers listed above.
4. Do not put Three.js or DOM types on the bus.
5. Do not invent ad-hoc REST fields without a schema bump here.
