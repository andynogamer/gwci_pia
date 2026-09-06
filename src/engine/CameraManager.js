/**
 * Agent-Engine — Follow Camera and Isometric rigs.
 * All motion is scaled by dt from THREE.Clock (no fixed Hz steps).
 */
import * as THREE from 'three';

export const CameraMode = Object.freeze({
  FOLLOW: 'FOLLOW',
  ISOMETRIC: 'ISOMETRIC',
});

const FOLLOW_BACK = 15;
const FOLLOW_HEIGHT = 7.5;
const FOLLOW_LOOK_AHEAD = 5;
const FOLLOW_LOOK_HEIGHT = 1.2;
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
    /** Turret yaw (radians). Camera sits behind the cannon. */
    this.followYaw = Math.PI;
    this._lookAt = new THREE.Vector3();
    this._isoOffset = new THREE.Vector3();
    this._followOffset = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this._groundHit = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
   * World yaw of the cannon. Follow rig stays behind this heading.
   * @param {number} yaw
   */
  setFollowYaw(yaw) {
    if (!Number.isFinite(yaw)) return;
    this.followYaw = yaw;
  }

  /** Jump the follow rig (match start). */
  snapFollow() {
    this._placeFollowImmediate();
  }

  _followOffsetFromYaw(yaw = this.followYaw) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    this._followOffset.set(-fx * FOLLOW_BACK, FOLLOW_HEIGHT, -fz * FOLLOW_BACK);
    return this._followOffset;
  }

  /**
   * Ground-plane pick from NDC. Returns JSON [x,y,z] or null. No Object3D on the bus.
   * @param {number} ndcX
   * @param {number} ndcY
   * @returns {[number, number, number] | null}
   */
  pickGround(ndcX, ndcY) {
    this._ndc.set(ndcX, ndcY);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._ground, this._groundHit);
    if (!hit) return null;
    return [this._groundHit.x, this._groundHit.y, this._groundHit.z];
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
      // Rigid orbit: place on the yaw circle every frame. Lerp would cut a chord
      // and read as a slide sideways, not a rotation with the cannon.
      this._placeFollowImmediate();
    } else {
      this._placeIso();
    }
  }

  _placeFollowImmediate() {
    this.followCam.position.copy(this.target).add(this._followOffsetFromYaw(this.followYaw));
    const fx = Math.sin(this.followYaw);
    const fz = Math.cos(this.followYaw);
    this._lookAt.set(
      this.target.x + fx * FOLLOW_LOOK_AHEAD,
      this.target.y + FOLLOW_LOOK_HEIGHT,
      this.target.z + fz * FOLLOW_LOOK_AHEAD,
    );
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
