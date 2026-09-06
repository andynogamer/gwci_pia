/**
 * Agent-Engine — REQ-COL-LIGHT dual illumination.
 * AmbientLight + SpotLight (tank headlights, shadow casting).
 */
import * as THREE from 'three';

export class DualLights {
  constructor() {
    this.ambient = new THREE.AmbientLight(0x9eb6cc, 0.4);

    this.spot = new THREE.SpotLight(0xfff0d0, 5, 55, Math.PI / 5, 0.35, 1);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(512, 512);
    this.spot.shadow.camera.near = 0.5;
    this.spot.shadow.camera.far = 60;
    this.spot.shadow.bias = -0.00025;
    this.spot.shadow.normalBias = 0.02;

    /**
     * Headlight mount — parented to the local tank Object3D when one exists.
     * Until WI-007, the mount lives in the scene at a placeholder pose.
     */
    this.headlightMount = new THREE.Group();
    this.headlightMount.name = 'tank-headlight-mount';

    this.spot.position.set(0, 0, 0);
    this.spot.target.position.set(0, -0.35, 14);
    this.headlightMount.add(this.spot);
    this.headlightMount.add(this.spot.target);

    /** @type {THREE.Scene | null} */
    this._scene = null;
    /** @type {THREE.Object3D | null} */
    this._tank = null;
  }

  /** @returns {THREE.SpotLight} */
  get focal() {
    return this.spot;
  }

  /**
   * @param {THREE.Scene} scene
   */
  addToScene(scene) {
    this.removeFromScene();
    this._scene = scene;
    scene.add(this.ambient);
    if (!this._tank) {
      scene.add(this.headlightMount);
      this.setMountPose(0, 0, -6, 0);
    }
  }

  /**
   * Parent headlights to the local tank turret so the beam follows the cannon.
   * @param {THREE.Object3D} turret
   */
  attachToTank(turret) {
    if (this.headlightMount.parent) {
      this.headlightMount.parent.remove(this.headlightMount);
    }
    this._tank = turret;
    this.headlightMount.position.set(0, 0.34, 0.42);
    this.headlightMount.rotation.set(0, 0, 0);
    this.spot.position.set(0, 0, 0);
    this.spot.target.position.set(0, -0.28, 18);
    turret.add(this.headlightMount);
  }

  /** Return headlights to free scene mount (e.g. tank disposed). */
  detachFromTank() {
    if (this.headlightMount.parent) {
      this.headlightMount.parent.remove(this.headlightMount);
    }
    this._tank = null;
    if (this._scene) {
      this._scene.add(this.headlightMount);
      this.setMountPose(0, 0, -6, 0);
    }
  }

  /**
   * Placeholder chassis pose when no tank Object3D is attached yet.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} [yaw=0]
   */
  setMountPose(x, y, z, yaw = 0) {
    if (this._tank) return;
    this.headlightMount.position.set(x, y + 1.15, z);
    this.headlightMount.rotation.set(0, yaw, 0);
  }

  removeFromScene() {
    if (this.ambient.parent) {
      this.ambient.parent.remove(this.ambient);
    }
    if (!this._tank && this.headlightMount.parent) {
      this.headlightMount.parent.remove(this.headlightMount);
    }
    this._scene = null;
  }

  /** Remove from scene and dispose shadow map / light GPU state. */
  dispose() {
    if (this.headlightMount.parent) {
      this.headlightMount.parent.remove(this.headlightMount);
    }
    this.removeFromScene();
    this.spot.dispose();
    this.ambient.dispose();
    this._tank = null;
  }
}

/**
 * Factory kept for thin callers; prefer `new DualLights()`.
 * @returns {{ ambient: THREE.AmbientLight, focal: THREE.SpotLight, dual: DualLights }}
 */
export function createDualLights() {
  const dual = new DualLights();
  return { ambient: dual.ambient, focal: dual.spot, dual };
}
