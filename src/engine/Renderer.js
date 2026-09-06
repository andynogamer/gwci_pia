/**
 * Agent-Engine — WebGLRenderer mount, Clock loop, resize, EventBus visuals.
 * No DOM besides the canvas element passed in. No gameplay / network.
 */
import * as THREE from 'three';
import { Topics } from '../core/Constants.js';
import { SceneManager } from './SceneManager.js';
import { CameraManager } from './CameraManager.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {{ sceneManager?: SceneManager, cameraManager?: CameraManager }} [deps]
   */
  constructor(canvas, bus, deps = {}) {
    this.canvas = canvas;
    this.bus = bus;
    this.sceneManager = deps.sceneManager ?? new SceneManager();
    this.cameraManager = deps.cameraManager ?? new CameraManager();

    /** @type {THREE.WebGLRenderer | null} */
    this.renderer = null;
    this.clock = new THREE.Clock(false);
    this.paused = false;
    this.running = false;

    /** @type {number | null} */
    this._raf = null;
    /** @type {Array<() => void>} */
    this._unsubs = [];
    this._onResize = () => this._handleResize();
  }

  mount() {
    if (this.renderer) return;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.sceneManager.preparePlaceholder();
    this._handleResize();

    window.addEventListener('resize', this._onResize);

    this._unsubs.push(
      this.bus.on(Topics.GAME_START, (payload) => this._onGameStart(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.GAME_PAUSE, (payload) => this._onGamePause(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.GAME_OVER, () => this._onGameOver()),
    );
    this._unsubs.push(
      this.bus.on(Topics.PLAYER_FIRE, (payload) => this._onPlayerFire(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.TANK_DAMAGED, (payload) => this._onTankDamaged(payload)),
    );
  }

  /** Begin the requestAnimationFrame loop (idempotent). */
  start() {
    if (!this.renderer) {
      this.mount();
    }
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.clock.start();
    this._tick();
  }

  /**
   * @param {{ mode?: string, mapId?: 1|2|3, difficulty?: string }} payload
   */
  _onGameStart(payload) {
    const mapId = payload?.mapId;
    if (mapId === 1 || mapId === 2 || mapId === 3) {
      this.sceneManager.loadMap(mapId);
    } else {
      this.sceneManager.preparePlaceholder();
    }
    this.sceneManager.particles?.clear();
    this.paused = false;
    if (!this.clock.running) {
      this.clock.start();
    }
    if (!this.running) {
      this.start();
    }
  }

  /**
   * @param {{ origin?: number[], direction?: number[], isLocal?: boolean }} payload
   */
  _onPlayerFire(payload) {
    const origin = payload?.origin;
    const direction = payload?.direction;
    if (!Array.isArray(origin) || origin.length < 3) return;
    if (!Array.isArray(direction) || direction.length < 3) return;
    this.sceneManager.ensureParticles();
    this.sceneManager.particles?.spawnMuzzle(
      /** @type {[number, number, number]} */ ([origin[0], origin[1], origin[2]]),
      /** @type {[number, number, number]} */ ([direction[0], direction[1], direction[2]]),
    );
  }

  /**
   * FX only — no HP math. Impact/smoke while alive; explosion at 0 HP.
   * @param {{ entityId?: string, currentHp?: number, maxHp?: number }} payload
   */
  _onTankDamaged(payload) {
    const entityId = payload?.entityId;
    if (!entityId) return;
    const origin = this.sceneManager.getEntityFxOrigin(entityId);
    if (!origin) return;
    this.sceneManager.ensureParticles();
    const hp = Number(payload?.currentHp);
    if (Number.isFinite(hp) && hp <= 0) {
      this.sceneManager.particles?.spawnExplosion(origin);
    } else {
      this.sceneManager.particles?.spawnImpact(origin);
      this.sceneManager.particles?.spawnSmoke(origin);
    }
  }

  /**
   * @param {{ isPaused?: boolean }} payload
   */
  _onGamePause(payload) {
    this.paused = Boolean(payload?.isPaused);
    if (this.paused) {
      this.clock.stop();
    } else if (this.running) {
      this.clock.start();
    }
  }

  _onGameOver() {
    this.paused = true;
    this.clock.stop();
    this.sceneManager.dispose();
  }

  _handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer?.setSize(width, height, false);
    this.cameraManager.resize(width, height);
  }

  _tick() {
    if (!this.running || !this.renderer) return;

    this._raf = requestAnimationFrame(() => this._tick());

    if (this.paused) {
      this.renderer.render(this.sceneManager.scene, this.cameraManager.camera);
      return;
    }

    const dt = this.clock.getDelta();
    this.sceneManager.update(dt);
    this.cameraManager.update(dt);
    this.renderer.render(this.sceneManager.scene, this.cameraManager.camera);
  }

  /**
   * Tear down loop, EventBus subs, scene GPU resources, and WebGLRenderer.
   */
  dispose() {
    this.running = false;
    this.paused = false;

    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    this.clock.stop();
    window.removeEventListener('resize', this._onResize);

    for (const off of this._unsubs) {
      off();
    }
    this._unsubs.length = 0;

    this.sceneManager.dispose();

    this.renderer?.dispose();
    this.renderer = null;
  }
}
