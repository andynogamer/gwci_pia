/**
 * Agent-Logic — WI-006 state machine + delta-time simulation loop.
 * Boot → Menu → Playing → Paused → GameOver.
 * Motion systems (WI-007+) tick from update(dt) later; this item owns the clock only.
 */
import { Clock } from 'three';
import { Difficulty, GameMode, GameState, MapId, Topics } from '../core/Constants.js';

const VALID_MODES = new Set(Object.values(GameMode));
const VALID_DIFFICULTIES = new Set(Object.values(Difficulty));
const VALID_MAP_IDS = new Set(Object.values(MapId));

export class GameManager {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.state = GameState.BOOT;
    this.clock = new Clock(false);
    /** @type {{ mode: string, mapId: number, difficulty: string } | null} */
    this.match = null;
    this.simElapsed = 0;
    this.lastDt = 0;
    this.playingTicks = 0;

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
    this.bus.emit(Topics.GAME_OVER, {
      winner: String(result?.winner ?? ''),
      score: Number(result?.score) || 0,
    });
  }

  /**
   * @param {number} _dt seconds from THREE.Clock.getDelta()
   */
  update(_dt) {
    // WI-007 tank, WI-008 collisions, WI-009 AI, WI-011 items/audio, WI-012 modes.
  }

  /** JSON-serializable snapshot for DEV verification. No Three.js objects. */
  getDebugState() {
    return {
      state: this.state,
      simElapsed: this.simElapsed,
      lastDt: this.lastDt,
      playingTicks: this.playingTicks,
      clockRunning: this.clock.running,
      match: this.match,
    };
  }

  dispose() {
    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this.clock.stop();
    for (const off of this._unsubs) {
      off();
    }
    this._unsubs.length = 0;
    this._booted = false;
    this.state = GameState.BOOT;
    this.match = null;
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
