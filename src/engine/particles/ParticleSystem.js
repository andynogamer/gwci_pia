/**
 * Agent-Engine — REQ-AI-PART particle systems (THREE.Points).
 * Lifetimes must be scaled by delta time. Dispose on scene restart.
 */
import * as THREE from 'three';

export class ParticleSystem {
  constructor() {
    this.points = null;
  }

  /**
   * @param {number} _dt
   */
  update(_dt) {}

  dispose() {
    this.points?.geometry?.dispose();
    this.points?.material?.dispose();
    this.points = null;
  }
}

void THREE;
