/**
 * Agent-Engine — Follow Camera and Isometric rigs.
 * All motion is scaled by dt from THREE.Clock (no fixed Hz steps).
 */
import * as THREE from 'three';

export const CameraMode = Object.freeze({
  FOLLOW: 'FOLLOW',
  ISOMETRIC: 'ISOMETRIC',
});

const FOLLOW_OFFSET = new THREE.Vector3(0, 7, 14);
const FOLLOW_LOOK_HEIGHT = 1.2;
/** Exponential smoothing rate (higher = snappier). */
const FOLLOW_SMOOTH = 6;
const ISO_DISTANCE = 28;
const ISO_YAW = Math.PI / 4;
const ISO_PITCH = Math.atan(1 / Math.SQRT2);

export class CameraManager {
  constructor() {
    this.mode = CameraMode.FOLLOW;

    this.followCam = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );

    const aspect = window.innerWidth / window.innerHeight;
    const frustum = 18;
    this.isoCam = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      500,
    );
    this._isoFrustum = frustum;

    /** @type {THREE.PerspectiveCamera | THREE.OrthographicCamera} */
    this.camera = this.followCam;

    this.target = new THREE.Vector3(0, 0, 0);
    this._desired = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._isoOffset = new THREE.Vector3();

    this._placeFollowImmediate();
    this._placeIso();
  }

  /**
   * @param {typeof CameraMode[keyof typeof CameraMode]} mode
   */
  setMode(mode) {
    if (mode !== CameraMode.FOLLOW && mode !== CameraMode.ISOMETRIC) return;
    this.mode = mode;
    this.camera = mode === CameraMode.FOLLOW ? this.followCam : this.isoCam;
    if (mode === CameraMode.FOLLOW) {
      this._placeFollowImmediate();
    } else {
      this._placeIso();
    }
  }

  toggleMode() {
    this.setMode(
      this.mode === CameraMode.FOLLOW ? CameraMode.ISOMETRIC : CameraMode.FOLLOW,
    );
  }

  /**
   * World-space point the rigs look at / follow (e.g. tank). JSON-safe coords only.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setTarget(x, y, z) {
    this.target.set(x, y, z);
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const aspect = w / h;

    this.followCam.aspect = aspect;
    this.followCam.updateProjectionMatrix();

    const f = this._isoFrustum;
    this.isoCam.left = -f * aspect;
    this.isoCam.right = f * aspect;
    this.isoCam.top = f;
    this.isoCam.bottom = -f;
    this.isoCam.updateProjectionMatrix();
  }

  /**
   * @param {number} dt seconds
   */
  update(dt) {
    if (dt <= 0) return;

    if (this.mode === CameraMode.FOLLOW) {
      this._desired.copy(this.target).add(FOLLOW_OFFSET);
      const t = 1 - Math.exp(-FOLLOW_SMOOTH * dt);
      this.followCam.position.lerp(this._desired, t);
      this._lookAt.set(this.target.x, this.target.y + FOLLOW_LOOK_HEIGHT, this.target.z);
      this.followCam.lookAt(this._lookAt);
    } else {
      this._placeIso();
    }
  }

  _placeFollowImmediate() {
    this.followCam.position.copy(this.target).add(FOLLOW_OFFSET);
    this._lookAt.set(this.target.x, this.target.y + FOLLOW_LOOK_HEIGHT, this.target.z);
    this.followCam.lookAt(this._lookAt);
  }

  _placeIso() {
    const horizontal = Math.cos(ISO_PITCH) * ISO_DISTANCE;
    this._isoOffset.set(
      Math.sin(ISO_YAW) * horizontal,
      Math.sin(ISO_PITCH) * ISO_DISTANCE,
      Math.cos(ISO_YAW) * horizontal,
    );
    this.isoCam.position.copy(this.target).add(this._isoOffset);
    this.isoCam.lookAt(this.target);
    this.isoCam.up.set(0, 1, 0);
  }
}
