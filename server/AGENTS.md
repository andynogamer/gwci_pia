# AGENTS.md — Agent-Network Server (`/server/`)

You own **Express REST, MySQL, and the WebSocket room server**.  
Rubric traces: **REQ-SRV-DB**, **REQ-MULTI**.

Companion charter: [src/network/AGENTS.md](../src/network/AGENTS.md).

## Allowed scope

`/server/**`  
No imports from `/src`. This process is not a renderer.

## Responsibilities

- `server.js`: HTTP + WebSocket upgrade, CORS as needed for Vite dev.
- `config/db.js`: MySQL connection pool.
- `routes/auth.js`: register + login (parameterized SQL).
- `routes/scores.js`: authenticated POST, public GET leaderboard.
- `ws/roomManager.js`: 1v1 rooms, handshake, heartbeat, broadcast.
- `schema.sql`: users + scores tables.

## Prohibitions

- Do not import `three` or simulate collisions/AI/damage as the gameplay authority.
- Do not generate HTML/CSS for the game UI.
- Do not use string-concatenated SQL.
- Do not log raw passwords.

## REST (locked)

See [CONTRACTS.md](../CONTRACTS.md) §C. Response shapes must match exactly for the academic client.

## WebSocket

See CONTRACTS.md §B. Room manager duties:

1. Match handshake (two clients)
2. Heartbeat timeout → drop room
3. Broadcast `CLIENT_STATE_UPDATE` and fire relays to the opponent only
4. No mesh, no Box3

## Security minimum

- Hash passwords (do not store plaintext).
- Parameterized queries only.
- Bearer token required for `POST /api/scores`.
