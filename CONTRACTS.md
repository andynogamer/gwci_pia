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
**Subscribers:** Agent-UI (power-up label / pickup FX cue), Agent-Engine (shield shader toggle), Agent-Logic (item lifecycle)

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

### HUD_STATE

Plain numbers for the in-game HUD radar and power-up countdown. No Three.js objects or DOM nodes.

```json
{
  "local": { "x": 0, "z": 0, "rotY": 0 },
  "others": [{ "id": "enemy-0", "x": 0, "z": 0 }],
  "powerup": { "type": "SHIELD", "remaining": 0 } | null
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `local` | `{ x, z, rotY }` | Local tank world XZ + hull yaw (radians) |
| `others` | `Array<{ id, x, z }>` | AI / remote tanks (not the local player) |
| `powerup` | `{ type, remaining } \| null` | Active timed buff for local; `remaining` in seconds from Logic `dt` |

`type` is `"SHIELD"` \| `"TRIPLE"` when present. Instant `REPAIR` does not appear here.

**Publishers:** Agent-Logic (each Playing sim tick)  
**Subscribers:** Agent-UI (radar dots + power-up chip). Ignore while not Playing.

### ROOM_READY

Mirrors WebSocket §B `ROOM_READY` without the `event` discriminator. Join order in `players` is authoritative for spawn pads.

```json
{
  "roomId": "string",
  "players": ["player-uuid-a", "player-uuid-b"]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `roomId` | string | Same id both peers joined (`pvp-map-{1\|2\|3}`) |
| `players` | `string[]` | Length 2. Index `0` → pad A, index `1` → pad B |

**Publishers:** Agent-Network (WS → bus)  
**Subscribers:** Agent-Logic (PVP pad snap + face opponent). Ignore outside PVP / not Playing|Paused.

### CLIENT_STATE_UPDATE

Same numeric fields as WebSocket §B (`id`, `timestamp`, `pos`, `rotY`, `turretRotY`, `hp`). EventBus payloads omit the WS `event` discriminator.

```json
{
  "id": "player-uuid",
  "timestamp": 0,
  "pos": [0, 0, 0],
  "rotY": 0,
  "turretRotY": 0,
  "hp": 100
}
```

**Publishers:** Agent-Logic (local pose tick while PVP), Agent-Network (remote peer relay)  
**Subscribers:** Agent-Network (relay local id to WS), Agent-Logic (apply remote opponent — WI-016)

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

### JOIN_ROOM

Client → Server. Match handshake for a named 1v1 room (max 2 peers).

```json
{
  "event": "JOIN_ROOM",
  "roomId": "string",
  "playerId": "string"
}
```

### ROOM_READY

Server → Client. Both peers present in the room.

```json
{
  "event": "ROOM_READY",
  "roomId": "string",
  "players": ["player-uuid-a", "player-uuid-b"]
}
```

### HEARTBEAT

Client → Server → Client (ack to sender). Server drops the peer (and room) if no heartbeat arrives within the timeout window.

```json
{
  "event": "HEARTBEAT",
  "timestamp": 0
}
```

### PLAYER_FIRE (WebSocket)

Client → Server → opponent. Same numeric fields as EventBus `PLAYER_FIRE` without `isLocal`.

```json
{
  "event": "PLAYER_FIRE",
  "origin": [0, 0, 0],
  "direction": [0, 0, 1]
}
```

### MATCH_END

Server → Client. Authoritative room close.

```json
{
  "event": "MATCH_END",
  "reason": "opponent_left" | "heartbeat_timeout" | "room_full"
}
```

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
