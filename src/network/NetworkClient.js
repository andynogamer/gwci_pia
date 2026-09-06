/**
 * Agent-Network — WebSocket client. Relays CONTRACTS.md §B telemetry only.
 * WI-026: on GAME_OVER, POST /api/scores when a Bearer token exists.
 * WI-027: two Chrome clients share room `pvp-map-{mapId}` (mapId 1|2|3 from menu).
 *
 * Room id (must match on both tabs):
 *   Desert Dunes (1)        → pvp-map-1
 *   Industrial Complex (2)  → pvp-map-2
 *   Lunar Station (3)       → pvp-map-3
 *
 * No rendering, AABB, or damage. Imports: core + WebSocket / ApiClient only.
 */
import { Topics, GameMode, Difficulty } from '../core/Constants.js';

const DEFAULT_ROOM_ID = 'pvp-default';
const HEARTBEAT_INTERVAL_MS = 2000;

/**
 * Menu mapId → WebSocket room id (WI-027).
 * @param {number} mapId
 * @returns {string}
 */
export function roomIdForMap(mapId) {
  const n = Number(mapId);
  if (n === 1 || n === 2 || n === 3) return `pvp-map-${n}`;
  return DEFAULT_ROOM_ID;
}

export class NetworkClient {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {{ url?: string, api?: import('./ApiClient.js').ApiClient }=} options
   */
  constructor(bus, options = {}) {
    this.bus = bus;
    this.url = options.url ?? null;
    /** @type {import('./ApiClient.js').ApiClient | null} */
    this.api = options.api ?? null;
    /** @type {WebSocket | null} */
    this.socket = null;
    this.playerId = createPlayerId();
    this.roomId = DEFAULT_ROOM_ID;
    this.roomReady = false;
    this.token = null;
    /** @type {{ mode: string, difficulty: string } | null} */
    this._match = null;
    /** @type {object | null} Last outbound CLIENT_STATE_UPDATE (resent on ROOM_READY). */
    this._lastStateFrame = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    this._heartbeatTimer = null;
    /** @type {Array<() => void>} */
    this._unsubs = [];
  }

  /** Bearer token for score POST after GAME_OVER (set by login wiring). */
  getToken() {
    return this.token ?? this.api?.getToken?.() ?? this.api?.token ?? null;
  }

  /**
   * @param {string | null} token
   */
  setToken(token) {
    this.token = token && String(token).trim() ? String(token) : null;
    this.api?.setToken?.(this.token);
  }

  bind() {
    this._unsubs.push(
      this.bus.on(Topics.GAME_START, (payload) => this._onGameStart(payload)),
      this.bus.on(Topics.GAME_OVER, (payload) => {
        void this._onGameOver(payload);
      }),
      this.bus.on(Topics.PLAYER_FIRE, (payload) => this._onLocalFire(payload)),
      this.bus.on(Topics.CLIENT_STATE_UPDATE, (payload) => this._onLocalState(payload)),
    );
  }

  unbind() {
    for (const off of this._unsubs) off();
    this._unsubs = [];
    this.disconnect();
  }

  /**
   * Open WS (if needed) and send JOIN_ROOM.
   * @param {string=} roomId
   */
  joinRoom(roomId = DEFAULT_ROOM_ID) {
    this.roomId = typeof roomId === 'string' && roomId.trim() ? roomId.trim() : DEFAULT_ROOM_ID;
    this.roomReady = false;
    this._lastStateFrame = null;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this._sendJoin();
      return;
    }

    this.disconnect();
    const url = this.url ?? defaultWsUrl();
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this._sendJoin();
      this._startHeartbeat();
    });

    socket.addEventListener('message', (ev) => {
      if (this.socket !== socket) return;
      this._onSocketMessage(ev.data);
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this._clearHeartbeat();
      this.socket = null;
      this.roomReady = false;
    });

    socket.addEventListener('error', () => {
      // close handles cleanup
    });
  }

  disconnect() {
    this._clearHeartbeat();
    this.roomReady = false;
    this._lastStateFrame = null;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Push local pose/hp to the opponent (also used when Logic emits CLIENT_STATE_UPDATE).
   * @param {{ pos: number[], rotY: number, turretRotY: number, hp: number, id?: string, timestamp?: number }} payload
   */
  sendState(payload) {
    if (!payload || !Array.isArray(payload.pos) || payload.pos.length !== 3) return;
    const frame = {
      event: 'CLIENT_STATE_UPDATE',
      id: this.playerId,
      timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
      pos: [Number(payload.pos[0]), Number(payload.pos[1]), Number(payload.pos[2])],
      rotY: Number(payload.rotY) || 0,
      turretRotY: Number(payload.turretRotY) || 0,
      hp: Number(payload.hp) || 0,
    };
    this._lastStateFrame = frame;
    this._send(frame);
  }

  /**
   * @param {{ mode?: string, mapId?: number, difficulty?: string }} payload
   */
  _onGameStart(payload) {
    if (
      payload &&
      (payload.mode === GameMode.PVE || payload.mode === GameMode.PVP) &&
      (payload.difficulty === Difficulty.EASY || payload.difficulty === Difficulty.HARD)
    ) {
      this._match = { mode: payload.mode, difficulty: payload.difficulty };
    } else {
      this._match = null;
    }

    if (!payload || payload.mode !== GameMode.PVP) {
      this.disconnect();
      return;
    }
    // WI-028 — PVP transport requires a signed-in Bearer session.
    if (!this.getToken()) {
      this.disconnect();
      return;
    }
    this.joinRoom(roomIdForMap(payload.mapId));
  }

  /**
   * Disconnect WS; if authenticated, POST score from last GAME_START mode/difficulty.
   * @param {{ score?: number }} payload
   */
  async _onGameOver(payload) {
    const match = this._match;
    this._match = null;
    this.disconnect();

    const token = this.getToken();
    if (!token || !this.api || !match) return;

    this.api.setToken(token);
    try {
      await this.api.submitScore({
        score: Number(payload?.score) || 0,
        mode: match.mode,
        difficulty: match.difficulty,
      });
    } catch {
      // Network only; UI highscores refresh will show stale data if POST fails.
    }
  }

  /**
   * @param {{ origin?: number[], direction?: number[], isLocal?: boolean }} payload
   */
  _onLocalFire(payload) {
    if (!payload || payload.isLocal !== true) return;
    if (!Array.isArray(payload.origin) || !Array.isArray(payload.direction)) return;
    this._send({
      event: 'PLAYER_FIRE',
      origin: [Number(payload.origin[0]), Number(payload.origin[1]), Number(payload.origin[2])],
      direction: [
        Number(payload.direction[0]),
        Number(payload.direction[1]),
        Number(payload.direction[2]),
      ],
    });
  }

  /**
   * Relay local pose ticks published on the bus (ignore remote echoes).
   * @param {{ id?: string, pos?: number[], rotY?: number, turretRotY?: number, hp?: number, timestamp?: number }} payload
   */
  _onLocalState(payload) {
    if (!payload || payload.id !== this.playerId) return;
    this.sendState(payload);
  }

  /**
   * @param {string | ArrayBuffer | Blob} data
   */
  _onSocketMessage(data) {
    if (typeof data !== 'string') return;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg.event !== 'string') return;

    switch (msg.event) {
      case 'ROOM_READY':
        this.roomReady = true;
        // Immediate pose so the late joiner sees chassis/turret without waiting a tick.
        if (this._lastStateFrame) {
          this._send({ ...this._lastStateFrame, timestamp: Date.now() });
        }
        break;
      case 'HEARTBEAT':
        break;
      case 'CLIENT_STATE_UPDATE':
        this._emitRemoteState(msg);
        break;
      case 'PLAYER_FIRE':
        this.bus.emit(Topics.PLAYER_FIRE, {
          origin: msg.origin,
          direction: msg.direction,
          isLocal: false,
        });
        break;
      case 'MATCH_END':
        this.roomReady = false;
        this.disconnect();
        break;
      default:
        break;
    }
  }

  /**
   * @param {{ id?: string, timestamp?: number, pos?: number[], rotY?: number, turretRotY?: number, hp?: number }} msg
   */
  _emitRemoteState(msg) {
    if (!msg || msg.id === this.playerId) return;
    if (!Array.isArray(msg.pos) || msg.pos.length !== 3) return;
    this.bus.emit(Topics.CLIENT_STATE_UPDATE, {
      id: String(msg.id),
      timestamp: Number(msg.timestamp) || Date.now(),
      pos: [Number(msg.pos[0]), Number(msg.pos[1]), Number(msg.pos[2])],
      rotY: Number(msg.rotY) || 0,
      turretRotY: Number(msg.turretRotY) || 0,
      hp: Number(msg.hp) || 0,
    });
  }

  _sendJoin() {
    this._send({
      event: 'JOIN_ROOM',
      roomId: this.roomId,
      playerId: this.playerId,
    });
  }

  _startHeartbeat() {
    this._clearHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this._send({ event: 'HEARTBEAT', timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  _clearHeartbeat() {
    if (this._heartbeatTimer != null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /**
   * @param {object} payload
   */
  _send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Prefer the game server port on localhost so Vite's HMR proxy does not own /ws.
 * Production / LAN builds still use same-origin `/ws`.
 */
function defaultWsUrl() {
  if (typeof location === 'undefined') {
    return 'ws://127.0.0.1:3001/ws';
  }
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return `ws://${host}:3001/ws`;
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

function createPlayerId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
