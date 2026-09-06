/**
 * Agent-Logic — WI-006 state machine + WI-007 local tank tick.
 * Boot → Menu → Playing → Paused → GameOver.
 */
import { Clock } from 'three';
import { Difficulty, GameMode, GameState, MapId, Topics } from '../core/Constants.js';
import { TankController } from './entities/TankController.js';

const VALID_MODES = new Set(Object.values(GameMode));
const VALID_DIFFICULTIES = new Set(Object.values(Difficulty));
const VALID_MAP_IDS = new Set(Object.values(MapId));

export class GameManager {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {{ sceneManager?: import('../engine/SceneManager.js').SceneManager, cameraManager?: import('../engine/CameraManager.js').CameraManager }} [facades]
   */
  constructor(bus, facades = {}) {
    this.bus = bus;
    this.sceneManager = facades.sceneManager ?? null;
    this.cameraManager = facades.cameraManager ?? null;
    this.state = GameState.BOOT;
    this.clock = new Clock(false);
    /** @type {{ mode: string, mapId: number, difficulty: string } | null} */
    this.match = null;
    this.simElapsed = 0;
    this.lastDt = 0;
    this.playingTicks = 0;
    this.tank = new TankController();

    /** @type {number | null} */
    this._raf = null;
    /** @type {Array<() => void>} */
    this._unsubs = [];
    this._booted = false;
  }

  boot() {
    if (this._booted) return;
    this._booted = true;
    this.state = GameState.MENU;

    this._unsubs.push(
      this.bus.on(Topics.GAME_START, (payload) => this.start(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.GAME_PAUSE, (payload) => this.pause(payload)),
    );

    this._scheduleLoop();
  }

  /**
   * @param {{ mode?: string, mapId?: number, difficulty?: string }} payload
   */
  start(payload) {
    if (!this._isValidStart(payload)) return;

    this.match = {
      mode: payload.mode,
      mapId: payload.mapId,
      difficulty: payload.difficulty,
    };
    this.simElapsed = 0;
    this.lastDt = 0;
    this.playingTicks = 0;
    this.tank.reset(0, 6, Math.PI);
    this.sceneManager?.spawnLocalTank();
    this._syncVisuals();
    this.cameraManager?.snapFollow();
    this.state = GameState.PLAYING;
    this.clock.start();
  }

  /**
   * @param {{ isPaused?: boolean }} payload
   */
  pause(payload) {
    const isPaused = Boolean(payload?.isPaused);

    if (isPaused) {
      if (this.state !== GameState.PLAYING) return;
      this.state = GameState.PAUSED;
      this.clock.stop();
      return;
    }

    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this.clock.start();
  }

  /**
   * Logic-owned match end. Publishes GAME_OVER per CONTRACTS.md.
   * @param {{ winner: string, score: number }} result
   */
  endMatch(result) {
    if (this.state !== GameState.PLAYING && this.state !== GameState.PAUSED) {
      return;
    }

    this.state = GameState.GAME_OVER;
    this.clock.stop();
    this.tank.setChassisInput(0, 0);
    this.sceneManager?.despawnLocalTank();
    this.bus.emit(Topics.GAME_OVER, {
      winner: String(result?.winner ?? ''),
      score: Number(result?.score) || 0,
    });
  }

  /**
   * Integrator supplies chassis axes. Ignored unless Playing (applied next tick).
   * @param {number} throttle
   * @param {number} steer
   */
  setChassisInput(throttle, steer) {
    this.tank.setChassisInput(throttle, steer);
  }

  /**
   * Arrow-key turret yaw. Positive = left.
   * @param {number} turretSteer
   */
  setTurretInput(turretSteer) {
    this.tank.setTurretInput(turretSteer);
  }

  /** Left-click fire. Emits PLAYER_FIRE when Playing and cooldown allows. */
  tryFire() {
    if (this.state !== GameState.PLAYING) return false;
    const shot = this.tank.tryFire();
    if (!shot) return false;
    this.bus.emit(Topics.PLAYER_FIRE, shot);
    return true;
  }

  /**
   * @param {number} dt seconds from THREE.Clock.getDelta()
   */
  update(dt) {
    this.tank.update(dt);
    this._syncVisuals();
  }

  /** JSON-serializable snapshot for DEV verification. No Three.js objects. */
  getDebugState() {
    const pose = this.tank.getPose();
    return {
      state: this.state,
      simElapsed: this.simElapsed,
      lastDt: this.lastDt,
      playingTicks: this.playingTicks,
      clockRunning: this.clock.running,
      match: this.match,
      tank: pose,
      fireCount: this.tank.fireCount,
      fireCooldown: this.tank.fireCooldown,
    };
  }

  dispose() {
    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this.clock.stop();
    this.sceneManager?.despawnLocalTank();
    for (const off of this._unsubs) {
      off();
    }
    this._unsubs.length = 0;
    this._booted = false;
    this.state = GameState.BOOT;
    this.match = null;
  }

  _syncVisuals() {
    const pose = this.tank.getPose();
    this.sceneManager?.syncLocalTank(pose);
    this.cameraManager?.setTarget(pose.x, pose.y, pose.z);
    this.cameraManager?.setFollowYaw(pose.turretRotY);
  }

  _scheduleLoop() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._tick();
    };
    this._raf = requestAnimationFrame(loop);
  }

  _tick() {
    if (this.state !== GameState.PLAYING || !this.clock.running) {
      return;
    }

    const dt = this.clock.getDelta();
    if (dt <= 0) return;

    this.lastDt = dt;
    this.simElapsed += dt;
    this.playingTicks += 1;
    this.update(dt);
  }

  /**
   * @param {{ mode?: string, mapId?: number, difficulty?: string }} payload
   */
  _isValidStart(payload) {
    if (!payload) return false;
    return (
      VALID_MODES.has(payload.mode) &&
      VALID_MAP_IDS.has(payload.mapId) &&
      VALID_DIFFICULTIES.has(payload.difficulty)
    );
  }
}
