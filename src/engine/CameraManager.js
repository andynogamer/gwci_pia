/**
 * Agent-Engine — Follow Camera and Isometric rigs.
 */
import * as THREE from 'three';

export const CameraMode = Object.freeze({
  FOLLOW: 'FOLLOW',
  ISOMETRIC: 'ISOMETRIC',
});

export class CameraManager {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );
    this.mode = CameraMode.FOLLOW;
  }

  /**
   * @param {number} _dt
   */
  update(_dt) {
    // Delta-scaled follow / isometric — Agent-Engine
  }
}
