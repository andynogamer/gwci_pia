/**
 * Agent-Logic — REQ-SND-ITM power-up lifecycles.
 */
import { ItemType } from '../../core/Constants.js';

export class ItemSystem {
  constructor() {
    this.active = new Map();
  }

  collect(entityId, type) {
    if (!Object.values(ItemType).includes(type)) return;
    this.active.set(entityId, { type, remaining: 8 });
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    for (const [id, item] of this.active) {
      item.remaining -= dt;
      if (item.remaining <= 0) this.active.delete(id);
    }
  }
}
