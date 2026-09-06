/**
 * Agent-Logic — REQ-AI-PART + REQ-DIFF
 * FOV: vector dot product. LOS: THREE.Raycaster.
 * FSM: Patrol → Investigate → Pursue → Engage.
 */
import { PROJECTILE_SPEED } from '../physics/CollisionManager.js';
import { facingDot, hasLineOfSight, inFovCone } from './perception.js';

export const AiState = Object.freeze({
  PATROL: 'PATROL',
  INVESTIGATE: 'INVESTIGATE',
  PURSUE: 'PURSUE',
  ENGAGE: 'ENGAGE',
});

const VIEW_RANGE = 34;
const ENGAGE_RANGE = 13;
const ARRIVE = 2.4;
const LOST_HOLD = 0.55;
const INVESTIGATE_DWELL = 1.35;
const EYE_Y = 1.05;

function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class EnemyAI {
  /**
   * @param {{ fovDegrees: number, reactionLatency: number, fireRate: number, predictTrajectory: boolean }} difficultyConfig
   * @param {{ x: number, z: number, waypoints?: Array<[number, number]> }} [home]
   */
  constructor(difficultyConfig, home = { x: 0, z: 0 }) {
    this.config = difficultyConfig;
    this.state = AiState.PATROL;
    this.homeX = home.x;
    this.homeZ = home.z;
    this.waypoints = home.waypoints ?? [
      [home.x + 7, home.z],
      [home.x, home.z + 7],
      [home.x - 7, home.z],
      [home.x, home.z - 7],
    ];
    this.waypointIndex = 0;
    this.reactionT = 0;
    this.lostT = 0;
    this.dwellT = 0;
    this.lastSeenX = home.x;
    this.lastSeenZ = home.z;
    this.throttle = 0;
    this.steer = 0;
    this.turretSteer = 0;
    this.wantFire = false;
  }

  /**
   * @param {number} dt
   * @param {{
   *   x: number, z: number, rotY: number, turretRotY: number,
   *   playerX: number, playerZ: number, playerVx: number, playerVz: number,
   *   obstacles: import('three').Box3[],
   *   blocked?: boolean,
   * }} world
   */
  update(dt, world) {
    if (dt <= 0) return;

    const seen = this._canSee(world);
    if (seen) {
      this.lastSeenX = world.playerX;
      this.lastSeenZ = world.playerZ;
      this.lostT = 0;
    } else {
      this.lostT += dt;
    }

    switch (this.state) {
      case AiState.PATROL:
        this._patrol(dt, world, seen);
        break;
      case AiState.INVESTIGATE:
        this._investigate(dt, world, seen);
        break;
      case AiState.PURSUE:
        this._pursue(dt, world, seen);
        break;
      case AiState.ENGAGE:
        this._engage(dt, world, seen);
        break;
      default:
        this.state = AiState.PATROL;
    }
  }

  skipWaypoint() {
    this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
  }

  _canSee(world) {
    const dist = Math.hypot(world.playerX - world.x, world.playerZ - world.z);
    if (dist > VIEW_RANGE) return false;
    const turretDot = facingDot(world.x, world.z, world.turretRotY, world.playerX, world.playerZ);
    const hullDot = facingDot(world.x, world.z, world.rotY, world.playerX, world.playerZ);
    if (
      !inFovCone(turretDot, this.config.fovDegrees) &&
      !inFovCone(hullDot, this.config.fovDegrees)
    ) {
      return false;
    }
    return hasLineOfSight(
      world.x,
      EYE_Y,
      world.z,
      world.playerX,
      EYE_Y,
      world.playerZ,
      world.obstacles,
    );
  }

  _patrol(dt, world, seen) {
    this.wantFire = false;
    if (seen) {
      this.reactionT += dt;
      this._aimToward(world, world.playerX, world.playerZ);
      if (this.reactionT >= this.config.reactionLatency) {
        this.state = AiState.PURSUE;
        this.reactionT = 0;
        this._pursue(dt, world, seen);
        return;
      }
    } else {
      this.reactionT = Math.max(0, this.reactionT - dt * 0.6);
    }

    if (world.blocked) this.skipWaypoint();
    const [gx, gz] = this.waypoints[this.waypointIndex];
    if (Math.hypot(gx - world.x, gz - world.z) < ARRIVE) this.skipWaypoint();
    this._driveToward(world, gx, gz, 0.85);
    if (!seen) {
      this._aimToward(world, world.x + Math.sin(world.rotY), world.z + Math.cos(world.rotY));
    }
  }

  _investigate(dt, world, seen) {
    this.wantFire = false;
    if (seen) {
      this.state = AiState.PURSUE;
      this._pursue(dt, world, seen);
      return;
    }
    const dist = Math.hypot(this.lastSeenX - world.x, this.lastSeenZ - world.z);
    this._driveToward(world, this.lastSeenX, this.lastSeenZ, 0.7);
    this._aimToward(world, this.lastSeenX, this.lastSeenZ);
    if (dist < ARRIVE) {
      this.dwellT += dt;
      this.throttle = 0;
      if (this.dwellT >= INVESTIGATE_DWELL) {
        this.dwellT = 0;
        this.state = AiState.PATROL;
      }
    } else {
      this.dwellT = 0;
    }
  }

  _pursue(dt, world, seen) {
    this.wantFire = false;
    if (!seen && this.lostT > LOST_HOLD) {
      this.state = AiState.INVESTIGATE;
      this.dwellT = 0;
      this._investigate(dt, world, seen);
      return;
    }
    const dist = Math.hypot(world.playerX - world.x, world.playerZ - world.z);
    if (seen && dist <= ENGAGE_RANGE) {
      this.state = AiState.ENGAGE;
      this._engage(dt, world, seen);
      return;
    }
    this._driveToward(world, this.lastSeenX, this.lastSeenZ, 1);
    this._aimToward(world, this.lastSeenX, this.lastSeenZ);
    this.wantFire = this._readyToShoot(world, seen);
  }

  _engage(dt, world, seen) {
    const dist = Math.hypot(world.playerX - world.x, world.playerZ - world.z);
    if (!seen && this.lostT > LOST_HOLD) {
      this.state = AiState.INVESTIGATE;
      this.dwellT = 0;
      this.wantFire = false;
      return;
    }
    if (dist > ENGAGE_RANGE * 1.35) {
      this.state = AiState.PURSUE;
      this.wantFire = false;
      this._pursue(dt, world, seen);
      return;
    }

    const aim = this._aimPoint(world);
    this._driveToward(world, world.playerX, world.playerZ, dist < 7 ? 0.15 : 0.45);
    this._aimToward(world, aim.x, aim.z);
    this.wantFire = this._readyToShoot(world, seen);
  }

  /**
   * EASY uses a looser aim gate; HARD keeps a tighter lead shot.
   */
  _readyToShoot(world, seen) {
    if (!seen) return false;
    const dist = Math.hypot(world.playerX - world.x, world.playerZ - world.z);
    if (dist > ENGAGE_RANGE * 1.15) return false;
    const aim = this._aimPoint(world);
    const aimDot = facingDot(world.x, world.z, world.turretRotY, aim.x, aim.z);
    return this.config.predictTrajectory ? aimDot > 0.94 : aimDot > 0.78;
  }

  _aimPoint(world) {
    if (!this.config.predictTrajectory) {
      return { x: world.playerX, z: world.playerZ };
    }
    const dist = Math.hypot(world.playerX - world.x, world.playerZ - world.z);
    const t = dist / PROJECTILE_SPEED;
    return {
      x: world.playerX + world.playerVx * t,
      z: world.playerZ + world.playerVz * t,
    };
  }

  _driveToward(world, gx, gz, speed) {
    const dist = Math.hypot(gx - world.x, gz - world.z);
    if (dist < 0.6) {
      this.throttle = 0;
      this.steer = 0;
      return;
    }
    const desired = Math.atan2(gx - world.x, gz - world.z);
    const delta = wrapAngle(desired - world.rotY);
    this.steer = clamp(delta * 1.6, -1, 1);
    this.throttle = Math.abs(delta) < 1.1 ? speed : speed * 0.28;
  }

  _aimToward(world, gx, gz) {
    const desired = Math.atan2(gx - world.x, gz - world.z);
    const delta = wrapAngle(desired - world.turretRotY);
    this.turretSteer = clamp(delta * 2.2, -1, 1);
  }
}
