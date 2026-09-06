/**
 * Agent-Logic — REQ-AI-PART perception.
 * FOV: u·v cone. LOS: THREE.Raycaster against obstacle Box3 (no Engine meshes).
 */
import { Raycaster, Vector3 } from 'three';

const _origin = new Vector3();
const _dir = new Vector3();
const _hit = new Vector3();
const _raycaster = new Raycaster();

/**
 * Chassis/turret forward in XZ vs direction to target. 1 = dead ahead.
 * @param {number} fromX
 * @param {number} fromZ
 * @param {number} rotY
 * @param {number} toX
 * @param {number} toZ
 */
export function facingDot(fromX, fromZ, rotY, toX, toZ) {
  const fx = Math.sin(rotY);
  const fz = Math.cos(rotY);
  let dx = toX - fromX;
  let dz = toZ - fromZ;
  const len = Math.hypot(dx, dz);
  if (len < 1e-5) return 1;
  dx /= len;
  dz /= len;
  return fx * dx + fz * dz;
}

/**
 * @param {number} dot
 * @param {number} fovDegrees full cone
 */
export function inFovCone(dot, fovDegrees) {
  const half = ((fovDegrees * Math.PI) / 180) * 0.5;
  return dot >= Math.cos(half);
}

/**
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 * @param {import('three').Box3[]} obstacles
 * @param {number} [stopShort] skip the last meters (target hull)
 */
export function hasLineOfSight(ox, oy, oz, tx, ty, tz, obstacles, stopShort = 1.4) {
  _dir.set(tx - ox, ty - oy, tz - oz);
  const dist = _dir.length();
  if (dist <= stopShort) return true;
  _dir.multiplyScalar(1 / dist);
  _origin.set(ox, oy, oz);
  _raycaster.set(_origin, _dir);
  const limit = dist - stopShort;

  for (const box of obstacles) {
    const hit = _raycaster.ray.intersectBox(box, _hit);
    if (!hit) continue;
    const d = _origin.distanceTo(hit);
    if (d > 0.08 && d < limit) return false;
  }
  return true;
}
