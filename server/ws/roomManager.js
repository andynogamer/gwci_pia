/**
 * Agent-Network — 1v1 rooms, handshake, heartbeat, broadcast.
 * Does not evaluate collisions or damage. CONTRACTS.md §B only.
 */
import { WebSocket } from 'ws';

const HEARTBEAT_TIMEOUT_MS = 8000;
const SWEEP_INTERVAL_MS = 2000;

export class RoomManager {
  constructor() {
    /** @type {Map<string, { players: Map<string, { socket: import('ws').WebSocket, lastHeartbeat: number }> }>} */
    this.rooms = new Map();
    /** @type {WeakMap<import('ws').WebSocket, { roomId: string, playerId: string }>} */
    this.socketMeta = new WeakMap();
    this._sweepTimer = setInterval(() => this._sweepHeartbeats(), SWEEP_INTERVAL_MS);
    if (typeof this._sweepTimer.unref === 'function') {
      this._sweepTimer.unref();
    }
  }

  /**
   * @param {import('ws').WebSocket} socket
   */
  handleConnection(socket) {
    socket.on('message', (raw) => {
      this._onMessage(socket, raw);
    });
    socket.on('close', () => {
      this._onDisconnect(socket, 'opponent_left');
    });
    socket.on('error', () => {
      // close handler performs cleanup
    });
  }

  dispose() {
    clearInterval(this._sweepTimer);
    for (const room of this.rooms.values()) {
      for (const peer of room.players.values()) {
        try {
          peer.socket.close();
        } catch {
          /* ignore */
        }
      }
    }
    this.rooms.clear();
  }

  /**
   * @param {import('ws').WebSocket} socket
   * @param {import('ws').RawData} raw
   */
  _onMessage(socket, raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg.event !== 'string') return;

    switch (msg.event) {
      case 'JOIN_ROOM':
        this._joinRoom(socket, msg);
        break;
      case 'HEARTBEAT':
        this._heartbeat(socket, msg);
        break;
      case 'CLIENT_STATE_UPDATE':
      case 'PLAYER_FIRE':
        this._relayToOpponent(socket, msg);
        break;
      default:
        break;
    }
  }

  /**
   * @param {import('ws').WebSocket} socket
   * @param {{ roomId?: unknown, playerId?: unknown }} msg
   */
  _joinRoom(socket, msg) {
    const roomId = typeof msg.roomId === 'string' ? msg.roomId.trim() : '';
    const playerId = typeof msg.playerId === 'string' ? msg.playerId.trim() : '';
    if (!roomId || !playerId) return;

    const existing = this.socketMeta.get(socket);
    if (existing) {
      this._onDisconnect(socket, 'opponent_left');
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      room = { players: new Map() };
      this.rooms.set(roomId, room);
    }

    if (room.players.size >= 2 && !room.players.has(playerId)) {
      this._send(socket, { event: 'MATCH_END', reason: 'room_full' });
      return;
    }

    // Rejoin same id replaces prior socket in that slot.
    const prior = room.players.get(playerId);
    if (prior && prior.socket !== socket) {
      try {
        prior.socket.close();
      } catch {
        /* ignore */
      }
    }

    room.players.set(playerId, {
      socket,
      lastHeartbeat: Date.now(),
    });
    this.socketMeta.set(socket, { roomId, playerId });

    if (room.players.size === 2) {
      const players = [...room.players.keys()];
      const ready = { event: 'ROOM_READY', roomId, players };
      for (const peer of room.players.values()) {
        this._send(peer.socket, ready);
      }
    }
  }

  /**
   * @param {import('ws').WebSocket} socket
   * @param {{ timestamp?: unknown }} msg
   */
  _heartbeat(socket, msg) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return;
    const room = this.rooms.get(meta.roomId);
    const peer = room?.players.get(meta.playerId);
    if (!peer) return;

    peer.lastHeartbeat = Date.now();
    const timestamp =
      typeof msg.timestamp === 'number' && Number.isFinite(msg.timestamp)
        ? msg.timestamp
        : Date.now();
    this._send(socket, { event: 'HEARTBEAT', timestamp });
  }

  /**
   * @param {import('ws').WebSocket} socket
   * @param {object} msg
   */
  _relayToOpponent(socket, msg) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return;
    const room = this.rooms.get(meta.roomId);
    if (!room) return;

    for (const [id, peer] of room.players) {
      if (id === meta.playerId) continue;
      this._send(peer.socket, msg);
    }
  }

  /**
   * @param {import('ws').WebSocket} socket
   * @param {'opponent_left' | 'heartbeat_timeout'} reason
   */
  _onDisconnect(socket, reason) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return;
    this.socketMeta.delete(socket);

    const room = this.rooms.get(meta.roomId);
    if (!room) return;

    room.players.delete(meta.playerId);
    if (room.players.size === 0) {
      this.rooms.delete(meta.roomId);
      return;
    }

    const end = { event: 'MATCH_END', reason };
    for (const peer of room.players.values()) {
      this._send(peer.socket, end);
    }
    for (const peer of room.players.values()) {
      this.socketMeta.delete(peer.socket);
      try {
        peer.socket.close();
      } catch {
        /* ignore */
      }
    }
    this.rooms.delete(meta.roomId);
  }

  _sweepHeartbeats() {
    const now = Date.now();
    for (const [roomId, room] of [...this.rooms.entries()]) {
      for (const [playerId, peer] of [...room.players.entries()]) {
        if (now - peer.lastHeartbeat <= HEARTBEAT_TIMEOUT_MS) continue;
        const meta = this.socketMeta.get(peer.socket);
        if (!meta || meta.roomId !== roomId || meta.playerId !== playerId) continue;
        this._onDisconnect(peer.socket, 'heartbeat_timeout');
      }
    }
  }

  /**
   * @param {import('ws').WebSocket} socket
   * @param {object} payload
   */
  _send(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}
