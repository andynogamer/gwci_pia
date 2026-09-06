/**
 * Agent-Logic — local tank chassis + independent turret (WI-007 / WI-020).
 * Turret yaw comes from arrow-key input, scaled by dt.
 */
import { Vector3 } from 'three';

const MOVE_SPEED = 8;
const TURN_RATE = 2.2;
const TURRET_RATE = 2.1;
const FIRE_COOLDOWN = 0.4;
const MUZZLE_HEIGHT = 1.15;
const BARREL_LENGTH = 1.55;

function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

export class TankController {
  /**
   * @param {{ moveSpeed?: number, fireCooldown?: number }} [opts]
   */
  constructor(opts = {}) {
    this.moveSpeed = opts.moveSpeed ?? MOVE_SPEED;
    this.fireCooldownMax = opts.fireCooldown ?? FIRE_COOLDOWN;
    this.x = 0;
    this.y = 0;
    this.z = 6;
    this.rotY = Math.PI;
    this.turretRotY = Math.PI;
    this.throttle = 0;
    this.steer = 0;
    /** -1..1, positive = left / +yaw (ArrowLeft) */
    this.turretSteer = 0;
    this.fireCooldown = 0;
    this.fireCount = 0;
    this._forward = new Vector3();
    this._turretFwd = new Vector3();
  }

  reset(x = 0, z = 6, rotY = Math.PI) {
    this.x = x;
    this.y = 0;
    this.z = z;
    this.rotY = rotY;
    this.turretRotY = rotY;
    this.throttle = 0;
    this.steer = 0;
    this.turretSteer = 0;
    this.fireCooldown = 0;
    this.fireCount = 0;
  }

  /**
   * @param {number} throttle -1..1
   * @param {number} steer -1..1 (positive = left / +yaw)
   */
  setChassisInput(throttle, steer) {
    this.throttle = Math.max(-1, Math.min(1, throttle));
    this.steer = Math.max(-1, Math.min(1, steer));
  }

  /**
   * @param {number} turretSteer -1..1 (positive = ArrowLeft)
   */
  setTurretInput(turretSteer) {
    this.turretSteer = Math.max(-1, Math.min(1, turretSteer));
  }

  /**
   * @param {number} dt seconds
   */
  update(dt) {
    if (dt <= 0) return;

    this.rotY = wrapAngle(this.rotY + this.steer * TURN_RATE * dt);
    this._forward.set(Math.sin(this.rotY), 0, Math.cos(this.rotY));
    this.x += this._forward.x * this.throttle * this.moveSpeed * dt;
    this.z += this._forward.z * this.throttle * this.moveSpeed * dt;

    this.turretRotY = wrapAngle(this.turretRotY + this.turretSteer * TURRET_RATE * dt);

    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }
  }

  /**
   * @param {boolean} [isLocal]
   * @returns {{ origin: [number, number, number], direction: [number, number, number], isLocal: boolean } | null}
   */
  tryFire(isLocal = true) {
    if (this.fireCooldown > 0) return null;

    this._turretFwd.set(Math.sin(this.turretRotY), 0, Math.cos(this.turretRotY));
    const origin = [
      this.x + this._turretFwd.x * BARREL_LENGTH,
      this.y + MUZZLE_HEIGHT,
      this.z + this._turretFwd.z * BARREL_LENGTH,
    ];
    const direction = [this._turretFwd.x, 0, this._turretFwd.z];

    this.fireCooldown = this.fireCooldownMax;
    this.fireCount += 1;
    return { origin, direction, isLocal: Boolean(isLocal) };
  }

  getPose() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      rotY: this.rotY,
      turretRotY: this.turretRotY,
    };
  }
}
