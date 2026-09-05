# AGENTS.md — Shared Kernel (`/src/core/`)

You are the steward of the **only** legal cross-agent coupling surface.

## Allowed files

- `EventBus.js` — pub/sub
- `Constants.js` — topic names, enums, numeric spec constants that multiple agents must share

## You may

- Add a topic **after** [CONTRACTS.md](../../CONTRACTS.md) documents it
- Export enums for `mode`, `mapId`, `difficulty`, item types, and game states
- Keep the bus synchronous, dependency-free, and DOM-free

## You must not

- Import `three`
- Touch `document` / CSS
- Open WebSockets or `fetch`
- Encode gameplay rules (damage, FOV, win conditions)
- Attach class instances to published payloads

## EventBus rules

- Topics are string constants from `Constants.js`, never ad-hoc literals scattered in agents.
- `emit(topic, payload)` payload must be JSON-serializable.
- Subscribers catch their own errors; the bus does not swallow agent failures silently without logging.

## Change policy

A core change is incomplete unless CONTRACTS.md and Constants.js agree. Feature agents import core; they do not fork their own bus.
