/**
 * Agent-Network — WebSocket client. Relays CONTRACTS.md telemetry only.
 */
export class NetworkClient {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.socket = null;
  }

  bind() {
    // Handshake + CLIENT_STATE_UPDATE — Agent-Network
  }

  sendState(_payload) {}
}
