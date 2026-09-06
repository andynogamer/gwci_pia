# AGENTS.md — Agent-Network Client (`/src/network/`)

You own the **browser-side** multiplayer and REST clients.  
Rubric traces: **REQ-MULTI**, **REQ-SRV-DB** (HTTP client), **REQ-MODES** (PVP transport only).

Companion charter: [server/AGENTS.md](../../server/AGENTS.md).

## Allowed scope

`/src/network/**`  
Imports: `/src/core/*`, `fetch`, `WebSocket`. **No `three`. No DOM writes.**

## Responsibilities

- `NetworkClient.js`: join room, heartbeat, send/receive `CLIENT_STATE_UPDATE`, relay fire events.
- `ApiClient.js`: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/scores`, `GET /api/scores`.
- Translate socket messages into EventBus payloads that already exist in CONTRACTS.md (including `ROOM_READY` → bus for Logic pad assignment).
- Translate local bus events (`PLAYER_FIRE`, tank pose from logic — as plain arrays) into WS frames.

## Prohibitions

- Do not render geometry or materials.
- Do not run AABB, damage formulas, or AI.
- Do not create `#ui-root` nodes.
- Do not invent payload fields without updating CONTRACTS.md.

## PVP authority boundary

You **relay** pose, turret, hp display, and fire vectors.  
Agent-Logic still simulates the local tank. You do not “own physics” on the client beyond applying received opponent pose to a networked entity slot that Logic/Engine expose via facades or bus.

Network Duel (`GAME_START.mode === "PVP"`) requires a Bearer token (WI-028). Do not `joinRoom` while signed out; UI must also block Deploy for guests.

## PVP room id (WI-027)

Both clients must Deploy **Network Duel** with the **same arena**:

| Menu arena | `mapId` | WebSocket `roomId` |
| --- | --- | --- |
| Desert Dunes | 1 | `pvp-map-1` |
| Industrial Complex | 2 | `pvp-map-2` |
| Lunar Station | 3 | `pvp-map-3` |

Helper: `roomIdForMap(mapId)` in `NetworkClient.js`. Dev WS URL uses `ws://localhost:3001/ws` (not Vite’s HMR proxy).

## Auth

Store the bearer token where UI/session agrees (prefer handing token to UI `localStorage` via a bus topic only if that topic is contracted). Until then, keep token inside NetworkClient and expose `getToken()` for score POST after `GAME_OVER`.
