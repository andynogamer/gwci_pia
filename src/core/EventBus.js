/**
 * Central EventBus. Payloads must be JSON-serializable.
 * Schemas: CONTRACTS.md — topic names: Constants.js
 */
export class EventBus {
  constructor() {
    this._subs = new Map();
  }

  on(topic, handler) {
    if (!this._subs.has(topic)) {
      this._subs.set(topic, new Set());
    }
    this._subs.get(topic).add(handler);
    return () => this.off(topic, handler);
  }

  off(topic, handler) {
    const set = this._subs.get(topic);
    if (set) set.delete(handler);
  }

  emit(topic, payload) {
    const set = this._subs.get(topic);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }
}

export const eventBus = new EventBus();
