/**
 * Agent-Logic — REQ-SND-ITM power-up lifecycles.
 * SHIELD: timed damage block. TRIPLE: timed triple shot. REPAIR: instant heal.
 */
import { ItemType } from '../../core/Constants.js';

export const SHIELD_DURATION = 8;
export const TRIPLE_DURATION = 8;
export const REPAIR_AMOUNT = 40;
const PICK_RADIUS = 2.35;

const DURATION = {
  [ItemType.SHIELD]: SHIELD_DURATION,
  [ItemType.TRIPLE]: TRIPLE_DURATION,
  [ItemType.REPAIR]: 0,
};

export class ItemSystem {
  constructor() {
    /** @type {Map<string, { type: string, remaining: number }>} */
    this.active = new Map();
    /** @type {Array<{ id: string, type: string, x: number, z: number, live: boolean }>} */
    this.pickups = [];
    this._nextId = 1;
  }

  /**
   * @param {Array<{ type: string, x: number, z: number }>} spots
   */
  spawn(spots) {
    this.clearPickups();
    this.active.clear();
    for (const s of spots) {
      if (!Object.values(ItemType).includes(s.type)) continue;
      this.pickups.push({
        id: `item-${this._nextId++}`,
        type: s.type,
        x: s.x,
        z: s.z,
        live: true,
      });
    }
  }

  /**
   * @param {string} entityId
   * @param {number} x
   * @param {number} z
   * @returns {{ type: string, id: string } | null}
   */
  tryCollectAt(entityId, x, z) {
    for (const p of this.pickups) {
      if (!p.live) continue;
      if (Math.hypot(p.x - x, p.z - z) > PICK_RADIUS) continue;
      p.live = false;
      this.collect(entityId, p.type);
      return { type: p.type, id: p.id };
    }
    return null;
  }

  /**
   * @param {string} entityId
   * @param {string} type
   */
  collect(entityId, type) {
    if (!Object.values(ItemType).includes(type)) return;
    const remaining = DURATION[type] ?? 0;
    if (type === ItemType.REPAIR) return;
    this.active.set(entityId, { type, remaining });
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (dt <= 0) return;
    for (const [id, item] of this.active) {
      item.remaining -= dt;
      if (item.remaining <= 0) this.active.delete(id);
    }
  }

  /** @param {string} entityId */
  hasShield(entityId) {
    return this.active.get(entityId)?.type === ItemType.SHIELD;
  }

  /** @param {string} entityId */
  hasTriple(entityId) {
    return this.active.get(entityId)?.type === ItemType.TRIPLE;
  }

  /** @param {string} entityId */
  getActive(entityId) {
    return this.active.get(entityId) ?? null;
  }

  livePickups() {
    return this.pickups.filter((p) => p.live);
  }

  clearPickups() {
    this.pickups.length = 0;
  }

  clear() {
    this.active.clear();
    this.clearPickups();
  }
}
