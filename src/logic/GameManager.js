/**
 * Agent-Logic — match loop, AABB, AI, audio, items, PVE waves (WI-006–012).
 * Boot → Menu → Playing → Paused → GameOver.
 */
import { Clock } from 'three';
import { Difficulty, DifficultyConfig, GameMode, GameState, ItemType, MapId, Topics } from '../core/Constants.js';
import { TankController } from './entities/TankController.js';
import { CollisionManager, LOCAL_TANK_ID } from './physics/CollisionManager.js';
import { EnemyAI } from './ai/EnemyAI.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { ItemSystem, REPAIR_AMOUNT } from './items/ItemSystem.js';
import { HordeSurvival } from './gamemodes/HordeSurvival.js';

const VALID_MODES = new Set(Object.values(GameMode));
const VALID_DIFFICULTIES = new Set(Object.values(Difficulty));
const VALID_MAP_IDS = new Set(Object.values(MapId));

const MAX_HP = 100;
const SHOT_DAMAGE = 18;

function yawShot(shot, yaw) {
  const a = Math.atan2(shot.direction[0], shot.direction[2]) + yaw;
  return {
    origin: shot.origin,
    direction: [Math.sin(a), shot.direction[1], Math.cos(a)],
    isLocal: shot.isLocal,
  };
}

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
    this.collision = new CollisionManager();
    this.audio = new AudioSystem();
    this.items = new ItemSystem();
    this.maxHp = MAX_HP;
    this.hp = MAX_HP;
    /** @type {Array<{ id: string, tank: TankController, ai: EnemyAI, hp: number, maxHp: number }>} */
    this.enemies = [];
    /** @type {HordeSurvival | null} */
    this.horde = null;
    this._playerPrevX = 0;
    this._playerPrevZ = 0;

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
    this._unsubs.push(
      this.bus.on(Topics.SETTINGS_UPDATED, (payload) => this.audio.applySettings(payload)),
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
    this.hp = this.maxHp;
    this._clearEnemies();
    this._teardownHorde();
    this.items.clear();
    const volumes = this.collision.loadMap(payload.mapId);
    const spawn = volumes.spawn ?? [0, 6];
    this.tank.reset(spawn[0], spawn[1], Math.PI);
    this._playerPrevX = this.tank.x;
    this._playerPrevZ = this.tank.z;
    this.sceneManager?.clearProjectiles();
    this.sceneManager?.spawnLocalTank();
    this._refreshBodies();
    if (payload.mode === GameMode.PVE) {
      this._startHorde(volumes, payload.difficulty);
    }
    this.items.spawn(volumes.items ?? []);
    this.sceneManager?.syncPickups(this._pickupViews());
    this._syncVisuals();
    this.cameraManager?.snapFollow();
    this.state = GameState.PLAYING;
    this.clock.start();
    void this.audio.unlock();
    this.audio.setPaused(false);
    this.audio.playBgm();
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
      this.audio.setEngine(0);
      this.audio.setPaused(true);
      return;
    }

    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this.clock.start();
    this.audio.setPaused(false);
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
    this.audio.setEngine(0);
    this.audio.stopBgm();
    this.audio.setPaused(false);
    this._clearEnemies();
    this._teardownHorde();
    this.items.clear();
    this.collision.clear();
    this.sceneManager?.clearPickups();
    this.sceneManager?.clearProjectiles();
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

  /** Spacebar fire. Emits PLAYER_FIRE when Playing and cooldown allows. */
  tryFire() {
    if (this.state !== GameState.PLAYING) return false;
    const shot = this.tank.tryFire();
    if (!shot) return false;
    this._spawnShot(shot, LOCAL_TANK_ID);
    if (this.items.hasTriple(LOCAL_TANK_ID)) {
      this.collision.spawnProjectile(yawShot(shot, 0.22), LOCAL_TANK_ID);
      this.collision.spawnProjectile(yawShot(shot, -0.22), LOCAL_TANK_ID);
    }
    this.audio.playSfx('fire');
    return true;
  }

  /**
   * @param {number} dt seconds from THREE.Clock.getDelta()
   */
  update(dt) {
    const prevX = this.tank.x;
    const prevZ = this.tank.z;
    this.tank.update(dt);
    this._refreshBodies();
    const moved = this.collision.resolveTankMove(prevX, prevZ, this.tank.x, this.tank.z, LOCAL_TANK_ID);
    this.tank.x = moved.x;
    this.tank.z = moved.z;
    this.audio.setEngine(Math.abs(this.tank.throttle));
    this._tryPickup(LOCAL_TANK_ID, this.tank.x, this.tank.z);

    const invDt = dt > 0 ? 1 / dt : 0;
    const playerVx = (this.tank.x - this._playerPrevX) * invDt;
    const playerVz = (this.tank.z - this._playerPrevZ) * invDt;
    this._playerPrevX = this.tank.x;
    this._playerPrevZ = this.tank.z;

    this._tickEnemies(dt, playerVx, playerVz);

    this._refreshBodies();
    const tanks = [
      { id: LOCAL_TANK_ID, x: this.tank.x, z: this.tank.z },
      ...this.enemies.map((e) => ({ id: e.id, x: e.tank.x, z: e.tank.z })),
    ];
    this.collision.updateProjectiles(dt, tanks, (entityId) => this._damage(entityId, SHOT_DAMAGE));

    this.items.update(dt);
    this.horde?.update(dt);

    if (this.state !== GameState.PLAYING) return;
    this._syncVisuals();
  }

  /**
   * @param {string} entityId
   * @param {number} amount
   */
  _damage(entityId, amount) {
    if (this.state !== GameState.PLAYING) return;
    if (this.items.hasShield(entityId)) return;
    if (entityId === LOCAL_TANK_ID) {
      this.hp = Math.max(0, this.hp - amount);
      this.bus.emit(Topics.TANK_DAMAGED, {
        entityId,
        currentHp: this.hp,
        maxHp: this.maxHp,
      });
      if (this.hp <= 0) {
        this.audio.playSfx('explosion');
        const defeat = this.horde?.defeatResult() ?? { winner: 'arena', score: 0 };
        this.endMatch(defeat);
      }
      return;
    }

    const enemy = this.enemies.find((e) => e.id === entityId);
    if (!enemy) return;
    enemy.hp = Math.max(0, enemy.hp - amount);
    this.bus.emit(Topics.TANK_DAMAGED, {
      entityId,
      currentHp: enemy.hp,
      maxHp: enemy.maxHp,
    });
    if (enemy.hp <= 0) {
      this.audio.playSfx('explosion');
      this.sceneManager?.despawnEnemyTank(enemy.id);
      this.enemies = this.enemies.filter((e) => e.id !== entityId);
      this.horde?.onEnemyKilled();
    }
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
      hp: this.hp,
      maxHp: this.maxHp,
      obstacleCount: this.collision.obstacles.length,
      projectileCount: this.collision.projectiles.length,
      pickups: this.items.livePickups().map((p) => ({ id: p.id, type: p.type, x: p.x, z: p.z })),
      powerup: this.items.getActive(LOCAL_TANK_ID),
      enemies: this.enemies.map((e) => ({
        id: e.id,
        state: e.ai.state,
        hp: e.hp,
        x: e.tank.x,
        z: e.tank.z,
      })),
      horde: this.horde?.getDebug() ?? null,
    };
  }

  dispose() {
    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this.clock.stop();
    this._clearEnemies();
    this._teardownHorde();
    this.items.clear();
    this.collision.clear();
    this.sceneManager?.clearPickups();
    this.sceneManager?.clearProjectiles();
    this.sceneManager?.despawnLocalTank();
    this.audio.dispose();
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
    for (const enemy of this.enemies) {
      this.sceneManager?.syncEnemyTank(enemy.id, enemy.tank.getPose());
    }
    this.sceneManager?.syncProjectiles(
      this.collision.projectiles.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        z: p.z,
      })),
    );
    this.sceneManager?.syncPickups(this._pickupViews());
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

  _refreshBodies() {
    this.collision.bodies = [
      { id: LOCAL_TANK_ID, x: this.tank.x, z: this.tank.z },
      ...this.enemies.map((e) => ({ id: e.id, x: e.tank.x, z: e.tank.z })),
    ];
  }

  /**
   * @param {{ enemies?: Array<[number, number, number?]>, spawn?: [number, number] }} volumes
   * @param {string} difficulty
   */
  _startHorde(volumes, difficulty) {
    const config = DifficultyConfig[difficulty] ?? DifficultyConfig.EASY;
    const spots = (volumes.enemies ?? []).map(([x, z]) => /** @type {[number, number]} */ ([x, z]));
    const [px, pz] = volumes.spawn ?? [0, 6];

    this.horde = new HordeSurvival({
      spawnPoints: spots,
      aliveCount: () => this.enemies.length,
      onVictory: (result) => this.endMatch(result),
      spawnEnemy: (spot, index) => {
        this._spawnEnemyAt(spot.x, spot.z, index, config, px, pz);
      },
    });
    this.horde.start();
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} index
   * @param {{ fovDegrees: number, reactionLatency: number, fireRate: number, predictTrajectory: boolean }} config
   * @param {number} px player spawn x
   * @param {number} pz player spawn z
   */
  _spawnEnemyAt(x, z, index, config, px, pz) {
    const id = `enemy-${index}`;
    const fireCooldown = 1 / Math.max(0.05, config.fireRate);
    this._refreshBodies();
    let at = this.collision.resolveTankMove(x, z, x, z, id);
    if (at.blocked) {
      const offsets = [
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3],
        [4, 4],
        [-4, -4],
      ];
      for (const [ox, oz] of offsets) {
        at = this.collision.resolveTankMove(x + ox, z + oz, x + ox, z + oz, id);
        if (!at.blocked) break;
      }
    }
    if (at.blocked) return;

    const sx = at.x;
    const sz = at.z;
    const rotY = Math.atan2(px - sx, pz - sz);
    const tank = new TankController({ moveSpeed: 6.1, fireCooldown });
    tank.reset(sx, sz, rotY);
    const ai = new EnemyAI(config, { x: sx, z: sz });
    this.enemies.push({ id, tank, ai, hp: this.maxHp, maxHp: this.maxHp });
    this.sceneManager?.spawnEnemyTank(id);
    this._refreshBodies();
  }

  _clearEnemies() {
    this.sceneManager?.despawnEnemyTanks();
    this.enemies.length = 0;
  }

  _teardownHorde() {
    this.horde?.reset();
    this.horde = null;
  }

  /**
   * @param {number} dt
   * @param {number} playerVx
   * @param {number} playerVz
   */
  _tickEnemies(dt, playerVx, playerVz) {
    for (const enemy of this.enemies) {
      const world = {
        x: enemy.tank.x,
        z: enemy.tank.z,
        rotY: enemy.tank.rotY,
        turretRotY: enemy.tank.turretRotY,
        playerX: this.tank.x,
        playerZ: this.tank.z,
        playerVx,
        playerVz,
        obstacles: this.collision.obstacles,
        blocked: false,
      };
      enemy.ai.update(dt, world);
      enemy.tank.setChassisInput(enemy.ai.throttle, enemy.ai.steer);
      enemy.tank.setTurretInput(enemy.ai.turretSteer);

      const prevX = enemy.tank.x;
      const prevZ = enemy.tank.z;
      enemy.tank.update(dt);
      this._refreshBodies();
      const moved = this.collision.resolveTankMove(
        prevX,
        prevZ,
        enemy.tank.x,
        enemy.tank.z,
        enemy.id,
      );
      enemy.tank.x = moved.x;
      enemy.tank.z = moved.z;
      if (moved.blocked) enemy.ai.skipWaypoint();

      world.x = enemy.tank.x;
      world.z = enemy.tank.z;
      world.rotY = enemy.tank.rotY;
      world.turretRotY = enemy.tank.turretRotY;
      if (enemy.ai.state === 'ENGAGE' || enemy.ai.state === 'PURSUE') {
        enemy.ai.wantFire = enemy.ai._readyToShoot(world, enemy.ai._canSee(world));
      }

      if (!enemy.ai.wantFire) continue;
      const shot = enemy.tank.tryFire(false);
      if (!shot) continue;
      this._spawnShot(shot, enemy.id);
      this.audio.playSfx('fire');
    }
  }

  /**
   * @param {{ origin: number[], direction: number[], isLocal: boolean }} shot
   * @param {string} ownerId
   */
  _spawnShot(shot, ownerId) {
    this.bus.emit(Topics.PLAYER_FIRE, shot);
    this.collision.spawnProjectile(shot, ownerId);
  }

  /**
   * @param {string} entityId
   * @param {number} x
   * @param {number} z
   */
  _tryPickup(entityId, x, z) {
    const got = this.items.tryCollectAt(entityId, x, z);
    if (!got) return;
    this.bus.emit(Topics.ITEM_COLLECTED, { type: got.type, entityId });
    this.audio.playSfx('pickup');
    if (got.type === ItemType.REPAIR && entityId === LOCAL_TANK_ID) {
      this.hp = Math.min(this.maxHp, this.hp + REPAIR_AMOUNT);
      this.bus.emit(Topics.TANK_DAMAGED, {
        entityId,
        currentHp: this.hp,
        maxHp: this.maxHp,
      });
    }
  }

  _pickupViews() {
    const bob = 0.72 + Math.sin(this.simElapsed * 2.2) * 0.14;
    return this.items.livePickups().map((p) => ({
      id: p.id,
      type: p.type,
      x: p.x,
      y: bob,
      z: p.z,
    }));
  }
}
