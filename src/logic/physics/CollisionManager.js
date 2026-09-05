/**
 * Agent-Logic — REQ-COL-LIGHT AABB collision manager (THREE.Box3 only).
 */
import * as THREE from 'three';

export class CollisionManager {
  constructor() {
    this.boxes = new Map();
  }

  /**
   * @param {string} id
   * @param {THREE.Box3} box
   */
  register(id, box) {
    this.boxes.set(id, box);
  }

  intersects(idA, idB) {
    const a = this.boxes.get(idA);
    const b = this.boxes.get(idB);
    if (!a || !b) return false;
    return a.intersectsBox(b);
  }

  clear() {
    this.boxes.clear();
  }
}

void THREE;
