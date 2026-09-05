/**
 * Agent-Network — 1v1 rooms, handshake, heartbeat, broadcast.
 * Does not evaluate collisions or damage.
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  handleConnection(_socket) {
    // JOIN_ROOM / HEARTBEAT / CLIENT_STATE_UPDATE — see CONTRACTS.md §B
  }
}
