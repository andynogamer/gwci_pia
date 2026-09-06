/**
 * Agent-Logic — REQ-COL-LIGHT AABB world (THREE.Box3 only).
 * Tanks, projectiles, obstacles, and arena bounds. No Cannon/Ammo/Rapier.
 */
import { Box3, Vector3 } from 'three';
import { getMapVolumes } from './mapVolumes.js';

export const LOCAL_TANK_ID = 'local';
export const PROJECTILE_SPEED = 32;

const TANK_HX = 1.2;
const TANK_HY = 0.7;
const TANK_HZ = 1.65;
const PROJ_H = 0.22;
const PROJ_SPEED = PROJECTILE_SPEED;
const PROJ_LIFE = 2.2;

export class CollisionManager {
  constructor() {
    this.bounds = new Box3();
    /** @type {Box3[]} */
    this.obstacles = [];
    /** @type {Array<{ id: number, ownerId: string, x: number, y: number, z: number, dx: number, dy: number, dz: number, age: number }>} */
    this.projectiles = [];
    this._tankBox = new Box3();
    this._otherBox = new Box3();
    this._projBox = new Box3();
    this._min = new Vector3();
    this._max = new Vector3();
    this._nextShot = 1;
    /** @type {Array<{ id: string, x: number, z: number }>} */
    this.bodies = [];
  }

  /**
   * @param {1 | 2 | 3} mapId
   */
  loadMap(mapId) {
    this.clear();
    const spec = getMapVolumes(mapId);
    this.bounds.set(
      this._min.set(spec.bounds.min[0], spec.bounds.min[1], spec.bounds.min[2]),
      this._max.set(spec.bounds.max[0], spec.bounds.max[1], spec.bounds.max[2]),
    );
    for (const o of spec.obstacles) {
      const box = new Box3();
      box.set(
        new Vector3(o.min[0], o.min[1], o.min[2]),
        new Vector3(o.max[0], o.max[1], o.max[2]),
      );
      this.obstacles.push(box);
    }
    return spec;
  }

  clear() {
    this.obstacles.length = 0;
    this.projectiles.length = 0;
    this.bodies.length = 0;
    this.bounds.makeEmpty();
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {Box3} [out]
   */
  tankBoxAt(x, z, out = this._tankBox) {
    out.min.set(x - TANK_HX, 0, z - TANK_HZ);
    out.max.set(x + TANK_HX, TANK_HY * 2, z + TANK_HZ);
    return out;
  }

  /**
   * Slide along walls: try X, then Z, then full revert.
   * Long steps are subdivided so thin ruins are not tunneled.
   * @param {string} [ignoreId] tank to exclude from body-body tests
   * @returns {{ x: number, z: number, blocked: boolean, hitObstacle: boolean }}
   */
  resolveTankMove(prevX, prevZ, x, z, ignoreId) {
    const dist = Math.hypot(x - prevX, z - prevZ);
    const steps = Math.max(1, Math.ceil(dist / 0.4));
    let cx = prevX;
    let cz = prevZ;
    let blocked = false;
    let hitObstacle = false;
    for (let i = 1; i <= steps; i++) {
      const nx = prevX + ((x - prevX) * i) / steps;
      const nz = prevZ + ((z - prevZ) * i) / steps;
      const step = this._resolveStep(cx, cz, nx, nz, ignoreId);
      cx = step.x;
      cz = step.z;
      blocked = blocked || step.blocked;
      hitObstacle = hitObstacle || step.hitObstacle;
    }
    return { x: cx, z: cz, blocked, hitObstacle };
  }

  /**
   * @returns {{ x: number, z: number, blocked: boolean, hitObstacle: boolean }}
   */
  _resolveStep(prevX, prevZ, x, z, ignoreId) {
    this.tankBoxAt(x, z, this._tankBox);
    const hitObstacle = this._overlapsObstacles(this._tankBox);
    if (this._tankLegal(x, z, ignoreId)) {
      return { x, z, blocked: false, hitObstacle: false };
    }
    const xOk = this._tankLegal(x, prevZ, ignoreId);
    const zOk = this._tankLegal(prevX, z, ignoreId);
    if (xOk && zOk) {
      return { x, z: prevZ, blocked: true, hitObstacle };
    }
    if (xOk) return { x, z: prevZ, blocked: true, hitObstacle };
    if (zOk) return { x: prevX, z, blocked: true, hitObstacle };
    return { x: prevX, z: prevZ, blocked: true, hitObstacle };
  }

  /**
   * @param {{ origin: [number, number, number], direction: [number, number, number] }} shot
   * @param {string} ownerId
   */
  spawnProjectile(shot, ownerId) {
    const len = Math.hypot(shot.direction[0], shot.direction[1], shot.direction[2]) || 1;
    this.projectiles.push({
      id: this._nextShot++,
      ownerId,
      x: shot.origin[0],
      y: shot.origin[1],
      z: shot.origin[2],
      dx: (shot.direction[0] / len) * PROJ_SPEED,
      dy: (shot.direction[1] / len) * PROJ_SPEED,
      dz: (shot.direction[2] / len) * PROJ_SPEED,
      age: 0,
    });
  }

  /**
   * @param {number} dt
   * @param {Array<{ id: string, x: number, z: number }>} tanks
   * @param {(entityId: string) => void} onTankHit
   */
  updateProjectiles(dt, tanks, onTankHit) {
    const survivors = [];
    for (const p of this.projectiles) {
      const dist = Math.hypot(p.dx, p.dy, p.dz) * dt;
      const steps = Math.max(1, Math.ceil(dist / 0.3));
      const sdt = dt / steps;
      let alive = true;
      for (let i = 0; i < steps && alive; i++) {
        p.age += sdt;
        p.x += p.dx * sdt;
        p.y += p.dy * sdt;
        p.z += p.dz * sdt;

        this._projBox.min.set(p.x - PROJ_H, p.y - PROJ_H, p.z - PROJ_H);
        this._projBox.max.set(p.x + PROJ_H, p.y + PROJ_H, p.z + PROJ_H);

        if (p.age > PROJ_LIFE || !this.bounds.intersectsBox(this._projBox)) {
          alive = false;
          break;
        }
        if (this._overlapsObstacles(this._projBox)) {
          alive = false;
          break;
        }

        for (const tank of tanks) {
          if (p.ownerId === tank.id) continue;
          this.tankBoxAt(tank.x, tank.z, this._tankBox);
          if (this._projBox.intersectsBox(this._tankBox)) {
            onTankHit(tank.id);
            alive = false;
            break;
          }
        }
      }
      if (alive) survivors.push(p);
    }
    this.projectiles = survivors;
  }

  _tankLegal(x, z, ignoreId) {
    this.tankBoxAt(x, z, this._tankBox);
    if (!this.bounds.containsBox(this._tankBox)) return false;
    if (this._overlapsObstacles(this._tankBox)) return false;
    return !this._overlapsTanks(this._tankBox, ignoreId);
  }

  _overlapsObstacles(box) {
    for (const o of this.obstacles) {
      if (box.intersectsBox(o)) return true;
    }
    return false;
  }

  _overlapsTanks(box, ignoreId) {
    for (const b of this.bodies) {
      if (b.id === ignoreId) continue;
      this.tankBoxAt(b.x, b.z, this._otherBox);
      if (box.intersectsBox(this._otherBox)) return true;
    }
    return false;
  }
}
