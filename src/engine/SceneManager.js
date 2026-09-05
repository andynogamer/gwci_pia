/**
 * Agent-Engine — scene graph ownership and map load/unload + dispose.
 */
import * as THREE from 'three';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
  }

  /**
   * @param {1 | 2 | 3} _mapId
   */
  loadMap(_mapId) {
    // REQ-MAPS: implemented by Agent-Engine in maps/
  }

  dispose() {
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          mat.map?.dispose();
          mat.dispose();
        }
      }
    });
  }
}
