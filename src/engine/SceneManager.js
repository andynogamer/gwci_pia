/**
 * Agent-Engine — scene graph ownership and map load/unload + dispose.
 * Placeholder geometry only until WI-005 (three arenas).
 */
import * as THREE from 'three';
import { DualLights } from './lights/DualLights.js';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e141c);

    /** @type {1 | 2 | 3 | null} */
    this.mapId = null;

    /** @type {THREE.Object3D[]} */
    this._owned = [];

    /** @type {THREE.Mesh | null} */
    this._marker = null;

    /** @type {DualLights | null} */
    this.lights = null;

    this._spinRadPerSec = 0.6;
  }

  /**
   * Boot visuals so the canvas shows a live frame before maps exist (WI-005).
   * Uses lit materials so Ambient + SpotLight (WI-004) are visible.
   */
  preparePlaceholder() {
    this.clearOwned();
    this._ensureLights();

    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a3848,
      roughness: 0.92,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this._owned.push(ground);

    const grid = new THREE.GridHelper(40, 20, 0x4a6280, 0x2a3848);
    grid.position.y = 0.01;
    this.scene.add(grid);
    this._owned.push(grid);

    const markerGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xe0a23a,
      roughness: 0.55,
      metalness: 0.15,
    });
    this._marker = new THREE.Mesh(markerGeo, markerMat);
    this._marker.position.set(0, 0.7, 0);
    this._marker.castShadow = true;
    this._marker.receiveShadow = true;
    this.scene.add(this._marker);
    this._owned.push(this._marker);

    // Extra caster so SpotLight shadows are obvious under the headlight beam.
    const pillarGeo = new THREE.BoxGeometry(1.2, 2.4, 1.2);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x5a6a7a,
      roughness: 0.8,
      metalness: 0.2,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(2.5, 1.2, 3);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.scene.add(pillar);
    this._owned.push(pillar);
  }

  _ensureLights() {
    if (!this.lights) {
      this.lights = new DualLights();
    }
    this.lights.addToScene(this.scene);
  }

  /**
   * Store map selection only — arena meshes are WI-005.
   * @param {1 | 2 | 3} mapId
   */
  loadMap(mapId) {
    this.mapId = mapId;
    if (this._owned.length === 0) {
      this.preparePlaceholder();
    } else {
      this._ensureLights();
    }
  }

  /**
   * @param {number} dt seconds
   */
  update(dt) {
    if (!this._marker || dt <= 0) return;
    this._marker.rotation.y += this._spinRadPerSec * dt;
  }

  /**
   * Remove and dispose owned geometries / materials / textures.
   */
  clearOwned() {
    for (const obj of this._owned) {
      this.scene.remove(obj);
      this._disposeObject(obj);
    }
    this._owned.length = 0;
    this._marker = null;
  }

  /**
   * Full teardown of scene resources (map unload / GAME_OVER).
   */
  dispose() {
    this.clearOwned();
    this.mapId = null;

    if (this.lights) {
      this.lights.dispose();
      this.lights = null;
    }

    this.scene.traverse((obj) => {
      this._disposeObject(obj);
    });

    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }

  /**
   * @param {THREE.Object3D} obj
   */
  _disposeObject(obj) {
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        for (const key of Object.keys(mat)) {
          const value = mat[key];
          if (value && typeof value === 'object' && value.isTexture) {
            value.dispose();
          }
        }
        mat.dispose();
      }
    }
  }
}
