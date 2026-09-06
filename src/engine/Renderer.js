/**
 * Agent-Engine — WebGLRenderer mount, Clock loop, resize, EventBus visuals.
 * No DOM besides the canvas element passed in. No gameplay / network.
 */
import * as THREE from 'three';
import { Topics, ItemType } from '../core/Constants.js';
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
    /** @type {number[]} */
    this._frameDts = [];
    this._lastFrameMs = 0;
  }

  mount() {
    if (this.renderer) return;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

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
    this._unsubs.push(
      this.bus.on(Topics.ITEM_COLLECTED, (payload) => this._onItemCollected(payload)),
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
    this.sceneManager.shieldFx?.deactivate();
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
   * FX only — shield / ground ShaderMaterial toggle.
   * @param {{ type?: string, entityId?: string }} payload
   */
  _onItemCollected(payload) {
    if (!payload?.type) return;
    if (
      payload.type !== ItemType.SHIELD &&
      payload.type !== ItemType.TRIPLE &&
      payload.type !== ItemType.REPAIR
    ) {
      return;
    }
    this.sceneManager.onItemCollected(payload);
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
    this.renderer?.renderLists.dispose();
    this.sceneManager.preparePlaceholder();
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
    this._sampleFps();

    if (this.paused) {
      this.renderer.render(this.sceneManager.scene, this.cameraManager.camera);
      return;
    }

    const dt = this.clock.getDelta();
    this.sceneManager.update(dt);
    this.cameraManager.update(dt);
    this.renderer.render(this.sceneManager.scene, this.cameraManager.camera);
  }

  _sampleFps() {
    const now = performance.now();
    if (this._lastFrameMs > 0) {
      this._frameDts.push(now - this._lastFrameMs);
      if (this._frameDts.length > 90) this._frameDts.shift();
    }
    this._lastFrameMs = now;
  }

  /**
   * GPU / scene counts for the constitution §6 restart gate. JSON-safe.
   */
  getGpuStats() {
    const info = this.renderer?.info;
    const scene = this.sceneManager.scene;
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    let objects = 0;

    scene.traverse((obj) => {
      objects += 1;
      if (obj.geometry) geometries.add(obj.geometry);
      if (obj.material) {
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of list) {
          if (!mat) continue;
          materials.add(mat);
          for (const value of Object.values(mat)) {
            if (value && typeof value === 'object' && value.isTexture) {
              textures.add(value);
            }
          }
        }
      }
      if (obj.isLight && obj.shadow?.map?.texture) {
        textures.add(obj.shadow.map.texture);
      }
    });

    const dts = this._frameDts;
    const fps =
      dts.length >= 8 ? 1000 / (dts.reduce((a, b) => a + b, 0) / dts.length) : 0;

    return {
      fps: Math.round(fps * 10) / 10,
      sceneChildren: scene.children.length,
      objects,
      sceneGeometries: geometries.size,
      sceneMaterials: materials.size,
      sceneTextures: textures.size,
      infoGeometries: info?.memory.geometries ?? 0,
      infoTextures: info?.memory.textures ?? 0,
      programs: info?.programs?.length ?? 0,
      calls: info?.render.calls ?? 0,
      triangles: info?.render.triangles ?? 0,
      particleBursts: this.sceneManager.particles?.burstCount ?? 0,
    };
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

    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
