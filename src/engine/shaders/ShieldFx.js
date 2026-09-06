/**
 * Agent-Engine — shield bubble + ground ring FX (WI-017).
 * Visual only; item timers stay in Logic. Hides after SHIELD_FX_DURATION or deactivate().
 */
import * as THREE from 'three';
import { createGroundEffectMaterial, createShieldMaterial } from './Materials.js';

/** Visual lifetime aligned with Logic SHIELD_DURATION (FX only, not gameplay). */
export const SHIELD_FX_DURATION = 8;

export class ShieldFx {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'shield-fx';
    this.root.visible = false;

    this.shieldMat = createShieldMaterial();
    this.groundMat = createGroundEffectMaterial();

    this.shieldGeo = new THREE.SphereGeometry(2.15, 28, 18);
    this.shieldMesh = new THREE.Mesh(this.shieldGeo, this.shieldMat);
    this.shieldMesh.position.y = 0.85;
    this.shieldMesh.renderOrder = 2;
    this.root.add(this.shieldMesh);

    this.groundGeo = new THREE.CircleGeometry(3.2, 48);
    this.groundMesh = new THREE.Mesh(this.groundGeo, this.groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = 0.04;
    this.groundMesh.renderOrder = 1;
    this.root.add(this.groundMesh);

    this._active = false;
    this._remaining = 0;
    /** @type {THREE.Object3D | null} */
    this._host = null;
  }

  get active() {
    return this._active;
  }

  /**
   * Parent FX to a tank root (local player).
   * @param {THREE.Object3D} tankRoot
   */
  attachToTank(tankRoot) {
    this.detach();
    this._host = tankRoot;
    tankRoot.add(this.root);
  }

  detach() {
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
    this._host = null;
  }

  /** Show shield + ground shaders (ITEM_COLLECTED SHIELD). */
  activate() {
    this._active = true;
    this._remaining = SHIELD_FX_DURATION;
    this.root.visible = true;
    this.shieldMat.uniforms.uIntensity.value = 1;
    this.groundMat.uniforms.uIntensity.value = 1;
  }

  deactivate() {
    this._active = false;
    this._remaining = 0;
    this.root.visible = false;
  }

  /**
   * Advance `uTime` by dt; expire visual when remaining hits 0.
   * @param {number} dt seconds
   */
  update(dt) {
    if (!this._active || dt <= 0) return;

    this.shieldMat.uniforms.uTime.value += dt;
    this.groundMat.uniforms.uTime.value += dt;

    this._remaining -= dt;
    const fade = Math.max(0, Math.min(1, this._remaining / 1.2));
    this.shieldMat.uniforms.uIntensity.value = fade;
    this.groundMat.uniforms.uIntensity.value = fade;

    if (this._remaining <= 0) {
      this.deactivate();
    }
  }

  dispose() {
    this.deactivate();
    this.detach();
    this.shieldGeo.dispose();
    this.groundGeo.dispose();
    this.shieldMat.dispose();
    this.groundMat.dispose();
  }
}
