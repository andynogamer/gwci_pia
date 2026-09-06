/**
 * Agent-Engine — REQ-AI-PART particle systems (`THREE.Points`).
 * Lifetimes scaled by delta time. Dispose on scene restart / GAME_OVER.
 */
import * as THREE from 'three';

/**
 * @typedef {'muzzle' | 'impact' | 'smoke' | 'explosion'} FxKind
 */

/**
 * @typedef {{
 *   points: THREE.Points,
 *   velocities: Float32Array,
 *   life: number,
 *   maxLife: number,
 *   gravity: number,
 * }} Burst
 */

const COLOR_MUZZLE_A = new THREE.Color(1, 0.72, 0.2);
const COLOR_MUZZLE_B = new THREE.Color(1, 0.25, 0.05);
const COLOR_IMPACT_A = new THREE.Color(1, 0.85, 0.4);
const COLOR_IMPACT_B = new THREE.Color(0.9, 0.2, 0.05);
const COLOR_SMOKE_A = new THREE.Color(0.45, 0.48, 0.5);
const COLOR_SMOKE_B = new THREE.Color(0.2, 0.22, 0.24);
const COLOR_BOOM_A = new THREE.Color(1, 0.55, 0.1);
const COLOR_BOOM_B = new THREE.Color(0.4, 0.05, 0.02);
const UP = new THREE.Vector3(0, 1, 0);

export class ParticleSystem {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'particle-fx';

    /** @type {Burst[]} */
    this._bursts = [];

    /** @type {THREE.Scene | null} */
    this._scene = null;

    this._tmp = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
    this._local = new THREE.Vector3();
    this._muzzleDir = new THREE.Vector3();
  }

  get burstCount() {
    return this._bursts.length;
  }

  /**
   * @param {THREE.Scene} scene
   */
  attach(scene) {
    if (this.root.parent === scene) {
      this._scene = scene;
      return;
    }
    this.detach();
    this._scene = scene;
    scene.add(this.root);
  }

  detach() {
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
    this._scene = null;
  }

  /**
   * Muzzle flash along fire direction (PLAYER_FIRE).
   * @param {[number, number, number]} origin
   * @param {[number, number, number]} direction
   */
  spawnMuzzle(origin, direction) {
    const dir = this._muzzleDir.set(direction[0], direction[1], direction[2]);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.normalize();

    this._spawnBurst({
      kind: 'muzzle',
      origin,
      count: 28,
      life: 0.22,
      speedMin: 4,
      speedMax: 14,
      gravity: 2,
      color: COLOR_MUZZLE_A,
      colorEnd: COLOR_MUZZLE_B,
      coneDir: dir,
      coneSpread: 0.35,
      size: 0.45,
      additive: true,
    });
  }

  /**
   * Hit sparks (TANK_DAMAGED while alive).
   * @param {[number, number, number]} origin
   */
  spawnImpact(origin) {
    this._spawnBurst({
      kind: 'impact',
      origin,
      count: 36,
      life: 0.4,
      speedMin: 3,
      speedMax: 11,
      gravity: 6,
      color: COLOR_IMPACT_A,
      colorEnd: COLOR_IMPACT_B,
      coneDir: null,
      coneSpread: 1,
      size: 0.35,
      additive: true,
    });
  }

  /**
   * Rising smoke puff.
   * @param {[number, number, number]} origin
   */
  spawnSmoke(origin) {
    this._spawnBurst({
      kind: 'smoke',
      origin,
      count: 40,
      life: 1.1,
      speedMin: 0.4,
      speedMax: 1.8,
      gravity: -1.2,
      color: COLOR_SMOKE_A,
      colorEnd: COLOR_SMOKE_B,
      coneDir: UP,
      coneSpread: 0.55,
      size: 0.7,
      additive: false,
    });
  }

  /**
   * Death / destroy burst (TANK_DAMAGED when HP hits 0).
   * @param {[number, number, number]} origin
   */
  spawnExplosion(origin) {
    this._spawnBurst({
      kind: 'explosion',
      origin,
      count: 64,
      life: 0.7,
      speedMin: 5,
      speedMax: 16,
      gravity: 4,
      color: COLOR_BOOM_A,
      colorEnd: COLOR_BOOM_B,
      coneDir: null,
      coneSpread: 1,
      size: 0.55,
      additive: true,
    });
    this.spawnSmoke([origin[0], origin[1] + 0.4, origin[2]]);
  }

  /**
   * @param {number} dt seconds
   */
  update(dt) {
    if (dt <= 0 || this._bursts.length === 0) return;

    for (let i = this._bursts.length - 1; i >= 0; i -= 1) {
      const burst = this._bursts[i];
      burst.life -= dt;
      const t = Math.max(0, burst.life / burst.maxLife);

      const pos = burst.points.geometry.attributes.position;
      const col = burst.points.geometry.attributes.color;
      const vel = burst.velocities;
      const count = pos.count;

      for (let p = 0; p < count; p += 1) {
        const i3 = p * 3;
        vel[i3 + 1] -= burst.gravity * dt;
        pos.array[i3] += vel[i3] * dt;
        pos.array[i3 + 1] += vel[i3 + 1] * dt;
        pos.array[i3 + 2] += vel[i3 + 2] * dt;

        // Fade toward darker end color via vertex colors * life ratio
        col.array[i3] *= 0.98;
        col.array[i3 + 1] *= 0.98;
        col.array[i3 + 2] *= 0.98;
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;

      const mat = /** @type {THREE.PointsMaterial} */ (burst.points.material);
      mat.opacity = t;
      mat.size = mat.userData.baseSize * (0.55 + 0.45 * t);

      if (burst.life <= 0) {
        this._disposeBurst(burst);
        this._bursts.splice(i, 1);
      }
    }
  }

  /** Remove live bursts without tearing down the system. */
  clear() {
    for (const burst of this._bursts) {
      this._disposeBurst(burst);
    }
    this._bursts.length = 0;
  }

  dispose() {
    this.clear();
    this.detach();
  }

  /**
   * @param {{
   *   kind: FxKind,
   *   origin: [number, number, number],
   *   count: number,
   *   life: number,
   *   speedMin: number,
   *   speedMax: number,
   *   gravity: number,
   *   color: THREE.Color,
   *   colorEnd: THREE.Color,
   *   coneDir: THREE.Vector3 | null,
   *   coneSpread: number,
   *   size: number,
   *   additive: boolean,
   * }} cfg
   */
  _spawnBurst(cfg) {
    const positions = new Float32Array(cfg.count * 3);
    const colors = new Float32Array(cfg.count * 3);
    const velocities = new Float32Array(cfg.count * 3);

    const quat = this._quat.identity();
    const zAxis = this._zAxis.set(0, 0, 1);
    if (cfg.coneDir) {
      const d = this._tmp.copy(cfg.coneDir).normalize();
      if (d.lengthSq() > 1e-8) {
        quat.setFromUnitVectors(zAxis, d);
      }
    }

    for (let i = 0; i < cfg.count; i += 1) {
      const i3 = i * 3;
      positions[i3] = cfg.origin[0];
      positions[i3 + 1] = cfg.origin[1];
      positions[i3 + 2] = cfg.origin[2];

      const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      let vx;
      let vy;
      let vz;
      if (cfg.coneDir) {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.random() * cfg.coneSpread;
        const local = this._local
          .set(
            Math.cos(angle) * spread,
            Math.sin(angle) * spread,
            1,
          )
          .normalize()
          .multiplyScalar(speed)
          .applyQuaternion(quat);
        vx = local.x;
        vy = local.y;
        vz = local.z;
      } else {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        vx = Math.sin(phi) * Math.cos(theta) * speed;
        vy = Math.cos(phi) * speed;
        vz = Math.sin(phi) * Math.sin(theta) * speed;
      }
      velocities[i3] = vx;
      velocities[i3 + 1] = vy;
      velocities[i3 + 2] = vz;

      const mix = Math.random();
      colors[i3] = cfg.color.r * (1 - mix) + cfg.colorEnd.r * mix;
      colors[i3 + 1] = cfg.color.g * (1 - mix) + cfg.colorEnd.g * mix;
      colors[i3 + 2] = cfg.color.b * (1 - mix) + cfg.colorEnd.b * mix;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: cfg.size,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
      blending: cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    material.userData.baseSize = cfg.size;

    const points = new THREE.Points(geometry, material);
    points.name = `fx-${cfg.kind}`;
    points.frustumCulled = false;
    this.root.add(points);

    this._bursts.push({
      points,
      velocities,
      life: cfg.life,
      maxLife: cfg.life,
      gravity: cfg.gravity,
    });
  }

  /**
   * @param {Burst} burst
   */
  _disposeBurst(burst) {
    this.root.remove(burst.points);
    burst.points.geometry.dispose();
    /** @type {THREE.PointsMaterial} */ (burst.points.material).dispose();
  }
}
