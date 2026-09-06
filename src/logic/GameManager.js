/**
 * Agent-Logic — match loop, AABB, AI, audio, items, PVE/PVP modes (WI-006–016).
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
import { NetworkDuel } from './gamemodes/NetworkDuel.js';
import { getPvpPads } from './physics/mapVolumes.js';

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
   * @param {{
   *   sceneManager?: import('../engine/SceneManager.js').SceneManager,
   *   cameraManager?: import('../engine/CameraManager.js').CameraManager,
   *   getLocalPlayerId?: () => string,
   *   getLocalUsername?: () => string,
   * }} [facades]
   */
  constructor(bus, facades = {}) {
    this.bus = bus;
    this.sceneManager = facades.sceneManager ?? null;
    this.cameraManager = facades.cameraManager ?? null;
    this.getLocalPlayerId = facades.getLocalPlayerId ?? (() => LOCAL_TANK_ID);
    this.getLocalUsername = facades.getLocalUsername ?? (() => '');
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
    /** @type {NetworkDuel | null} */
    this.duel = null;
    /** @type {{ id: string, x: number, y: number, z: number, rotY: number, turretRotY: number, hp: number, maxHp: number } | null} */
    this.opponent = null;
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
    this._unsubs.push(
      this.bus.on(Topics.CLIENT_STATE_UPDATE, (payload) => this._onClientState(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.PLAYER_FIRE, (payload) => this._onRemoteFire(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.ROOM_READY, (payload) => this._onRoomReady(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.MATCH_END, (payload) => this._onMatchEnd(payload)),
    );
    this._unsubs.push(
      this.bus.on(Topics.PICKUP_TAKEN, (payload) => this._onPickupTaken(payload)),
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
    this._teardownDuel();
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
    } else if (payload.mode === GameMode.PVP) {
      this._startDuel(volumes);
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
    this._teardownDuel();
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
   * PVP: ignored until ROOM_READY (WI-029).
   * @param {number} throttle
   * @param {number} steer
   */
  setChassisInput(throttle, steer) {
    if (this.duel && !this.duel.canControl()) {
      this.tank.setChassisInput(0, 0);
      return;
    }
    this.tank.setChassisInput(throttle, steer);
  }

  /**
   * Arrow-key turret yaw. Positive = left.
   * @param {number} turretSteer
   */
  setTurretInput(turretSteer) {
    if (this.duel && !this.duel.canControl()) {
      this.tank.setTurretInput(0);
      return;
    }
    this.tank.setTurretInput(turretSteer);
  }

  /** Spacebar fire. Emits PLAYER_FIRE when Playing and cooldown allows. */
  tryFire() {
    if (this.state !== GameState.PLAYING) return false;
    if (this.duel && !this.duel.canControl()) return false;
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
    if (this.duel && !this.duel.canControl()) {
      this.tank.setChassisInput(0, 0);
      this.tank.setTurretInput(0);
    }

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
    this._syncOpponentBody();

    this._refreshBodies();
    const tanks = [
      { id: LOCAL_TANK_ID, x: this.tank.x, z: this.tank.z },
      ...this.enemies.map((e) => ({ id: e.id, x: e.tank.x, z: e.tank.z })),
      ...(this.opponent ? [{ id: this.opponent.id, x: this.opponent.x, z: this.opponent.z }] : []),
    ];
    this.collision.updateProjectiles(dt, tanks, (entityId) => this._damage(entityId, SHOT_DAMAGE));

    this.items.update(dt);
    this.horde?.update(dt);
    if (this.duel) {
      const pose = this.tank.getPose();
      this.duel.update(dt, {
        x: pose.x,
        y: pose.y,
        z: pose.z,
        rotY: pose.rotY,
        turretRotY: pose.turretRotY,
        hp: this.hp,
      });
    }

    if (this.state !== GameState.PLAYING) return;
    this._publishHudState();
    this._syncVisuals();
  }

  /**
   * @param {string} entityId
   * @param {number} amount
   */
  _damage(entityId, amount) {
    if (this.state !== GameState.PLAYING) return;
    if (this.items.hasShield(entityId)) return;

    // WI-038: speculative local damage on opponent AABB so the killer can win
    // even if the loser's final hp:0 state never arrives before disconnect.
    if (this.duel && this.opponent && entityId === this.opponent.id) {
      this.opponent.hp = Math.max(0, this.opponent.hp - amount);
      if (this.duel.remote) this.duel.remote.hp = this.opponent.hp;
      this.bus.emit(Topics.TANK_DAMAGED, {
        entityId,
        currentHp: this.opponent.hp,
        maxHp: this.opponent.maxHp,
      });
      if (this.opponent.hp <= 0) this._endPvpVictory();
      return;
    }

    if (entityId === LOCAL_TANK_ID) {
      this.hp = Math.max(0, this.hp - amount);
      this.bus.emit(Topics.TANK_DAMAGED, {
        entityId,
        currentHp: this.hp,
        maxHp: this.maxHp,
      });
      if (this.hp <= 0) {
        this.audio.playSfx('explosion');
        if (this.duel) this._publishPvpDeathState();
        const defeat =
          this.horde?.defeatResult() ??
          this.duel?.defeatResult() ??
          { winner: 'arena', score: 0 };
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
      duel: this.duel?.getDebug() ?? null,
      opponent: this.opponent
        ? {
            id: this.opponent.id,
            hp: this.opponent.hp,
            x: this.opponent.x,
            z: this.opponent.z,
          }
        : null,
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
    this._teardownDuel();
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
    if (this.opponent) {
      this.sceneManager?.syncEnemyTank(this.opponent.id, {
        x: this.opponent.x,
        y: this.opponent.y,
        z: this.opponent.z,
        rotY: this.opponent.rotY,
        turretRotY: this.opponent.turretRotY,
      });
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

  /** WI-025 — JSON-only HUD feed (radar + power-up remaining). */
  _publishHudState() {
    const active = this.items.getActive(LOCAL_TANK_ID);
    /** @type {{ type: string, remaining: number } | null} */
    let powerup = null;
    if (active && (active.type === ItemType.SHIELD || active.type === ItemType.TRIPLE)) {
      powerup = {
        type: active.type,
        remaining: Math.max(0, Number(active.remaining) || 0),
      };
    }

    this.bus.emit(Topics.HUD_STATE, {
      local: {
        x: this.tank.x,
        z: this.tank.z,
        rotY: this.tank.rotY,
      },
      others: [
        ...this.enemies.map((e) => ({
          id: e.id,
          x: e.tank.x,
          z: e.tank.z,
        })),
        ...(this.opponent
          ? [{ id: this.opponent.id, x: this.opponent.x, z: this.opponent.z }]
          : []),
      ],
      powerup,
    });
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
      ...(this.opponent
        ? [{ id: this.opponent.id, x: this.opponent.x, z: this.opponent.z }]
        : []),
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
      difficulty,
      spawnPoints: spots,
      aliveCount: () => this.enemies.length,
      onVictory: (result) => this.endMatch(result),
      onWaveStart: () => {
        this.items.respawnPickups();
      },
      spawnEnemy: (spot, index) => {
        this._spawnEnemyAt(spot.x, spot.z, index, config, px, pz, difficulty);
      },
    });
    this.horde.start();
  }

  /**
   * @param {{ enemies?: Array<[number, number, number?]>, spawn?: [number, number], pvpPads?: Array<[number, number]> }} volumes
   */
  _startDuel(volumes) {
    const localId = String(this.getLocalPlayerId() || LOCAL_TANK_ID);
    const mapId = this.match?.mapId ?? 1;
    const pads = volumes.pvpPads?.length >= 2
      ? /** @type {[[number, number], [number, number]]} */ ([
          [volumes.pvpPads[0][0], volumes.pvpPads[0][1]],
          [volumes.pvpPads[1][0], volumes.pvpPads[1][1]],
        ])
      : getPvpPads(/** @type {1|2|3} */ (mapId));

    this.duel = new NetworkDuel({
      localId,
      localUsername: String(this.getLocalUsername() || '').trim(),
      pads,
      publishLocalState: (payload) => {
        this.bus.emit(Topics.CLIENT_STATE_UPDATE, payload);
      },
    });
    this.duel.start();
    // Hold at PVE spawn origin until ROOM_READY assigns opposite pads (no wander).
    this.tank.setChassisInput(0, 0);
    this.tank.setTurretInput(0);
  }

  /**
   * WI-029 / WI-035 — snap local + placeholder opponent to clear pad A/B.
   * @param {{ roomId?: string, players?: string[] }} payload
   */
  _onRoomReady(payload) {
    if (!this.duel) return;
    if (this.state !== GameState.PLAYING && this.state !== GameState.PAUSED) return;

    const placement = this.duel.applyRoomReady(payload);
    if (!placement) return;

    const localAt = this._findLegalTankPos(
      placement.local.x,
      placement.local.z,
      LOCAL_TANK_ID,
    );
    const remoteAt = this._findLegalTankPos(
      placement.remote.x,
      placement.remote.z,
      placement.remote.id,
    );
    const rotY = Math.atan2(remoteAt.x - localAt.x, remoteAt.z - localAt.z);
    const remoteRotY = Math.atan2(localAt.x - remoteAt.x, localAt.z - remoteAt.z);

    this.tank.reset(localAt.x, localAt.z, rotY);
    this._playerPrevX = this.tank.x;
    this._playerPrevZ = this.tank.z;
    this._ensureOpponent(placement.remote.id, remoteAt.x, remoteAt.z);
    if (this.opponent) {
      this.opponent.rotY = remoteRotY;
      this.opponent.turretRotY = remoteRotY;
    }
    this._refreshBodies();
    this.cameraManager?.snapFollow();
    this._syncVisuals();
    this._publishHudState();
  }

  /**
   * Place a tank AABB on (x,z) or the nearest legal offset (WI-035).
   * @param {number} x
   * @param {number} z
   * @param {string} ignoreId
   * @returns {{ x: number, z: number }}
   */
  _findLegalTankPos(x, z, ignoreId) {
    this._refreshBodies();
    let at = this.collision.resolveTankMove(x, z, x, z, ignoreId);
    if (!at.blocked) return { x: at.x, z: at.z };

    const offsets = [
      [3, 0],
      [-3, 0],
      [0, 3],
      [0, -3],
      [4, 4],
      [-4, -4],
      [6, 0],
      [-6, 0],
      [0, 6],
      [0, -6],
      [8, 2],
      [-8, -2],
    ];
    for (const [ox, oz] of offsets) {
      at = this.collision.resolveTankMove(x + ox, z + oz, x + ox, z + oz, ignoreId);
      if (!at.blocked) return { x: at.x, z: at.z };
    }
    return { x, z };
  }

  /**
   * WI-030 — peer leave / heartbeat / room_full → leave Playing (PVP only).
   * @param {{ reason?: string }} payload
   */
  _onMatchEnd(payload) {
    if (!this.duel) return;
    if (this.state !== GameState.PLAYING && this.state !== GameState.PAUSED) return;

    const reason = payload?.reason;
    if (reason === 'room_full') {
      // Never treat as a live duel win — abort waiting / join.
      this.endMatch({ winner: '', score: 0 });
      return;
    }

    // Remaining client: opponent left or timed out → forfeit win (local username).
    const score = Number(this.duel.score) || 0;
    const winner = String(this.getLocalUsername() || '').trim();
    this.endMatch({ winner, score });
  }

  /**
   * @param {string | null} id
   * @param {number} [x]
   * @param {number} [z]
   */
  _ensureOpponent(id, x = 12, z = -14) {
    const oid = id ? String(id) : this.opponent?.id ?? 'remote';
    if (this.opponent && this.opponent.id === oid) {
      this.opponent.x = x;
      this.opponent.z = z;
      return;
    }
    if (this.opponent && this.opponent.id !== oid) {
      this.sceneManager?.despawnEnemyTank(this.opponent.id);
    }
    this.opponent = {
      id: oid,
      x,
      y: 0,
      z,
      rotY: 0,
      turretRotY: 0,
      hp: this.maxHp,
      maxHp: this.maxHp,
    };
    this.sceneManager?.spawnEnemyTank(oid);
    this._refreshBodies();
  }

  _syncOpponentBody() {
    if (!this.opponent || !this.duel?.remote) return;
    const r = this.duel.remote;
    this.opponent.x = r.pos[0];
    this.opponent.y = r.pos[1];
    this.opponent.z = r.pos[2];
    this.opponent.rotY = r.rotY;
    this.opponent.turretRotY = r.turretRotY;
    this.opponent.hp = r.hp;
  }

  /**
   * WI-038 — local claim of PVP win (idempotent via NetworkDuel.takeVictory).
   */
  _endPvpVictory() {
    if (!this.duel) return;
    if (this.state !== GameState.PLAYING && this.state !== GameState.PAUSED) return;
    const result = this.duel.takeVictory();
    if (!result) return;
    this.audio.playSfx('explosion');
    this.endMatch(result);
  }

  /** Publish one last hp:0 frame so the opponent can resolve victory if still connected. */
  _publishPvpDeathState() {
    if (!this.duel) return;
    this.bus.emit(Topics.CLIENT_STATE_UPDATE, {
      id: this.duel.localId,
      timestamp: Date.now(),
      pos: [this.tank.x, this.tank.y ?? 0, this.tank.z],
      rotY: this.tank.rotY,
      turretRotY: this.tank.turretRotY,
      hp: 0,
      username: this.duel.localUsername,
    });
  }

  /**
   * @param {{ id?: string, timestamp?: number, pos?: number[], rotY?: number, turretRotY?: number, hp?: number }} payload
   */
  _onClientState(payload) {
    if (!this.duel || this.state !== GameState.PLAYING && this.state !== GameState.PAUSED) {
      return;
    }
    const res = this.duel.applyRemoteState(payload);
    if (!res.applied) return;
    const r = this.duel.remote;
    if (!r) return;
    const prevHp = this.opponent?.hp;
    this._ensureOpponent(r.id, r.pos[0], r.pos[2]);
    this._syncOpponentBody();
    if (this.opponent && Number.isFinite(prevHp) && this.opponent.hp !== prevHp) {
      this.bus.emit(Topics.TANK_DAMAGED, {
        entityId: this.opponent.id,
        currentHp: this.opponent.hp,
        maxHp: this.maxHp,
      });
    }
    if (res.victory) this._endPvpVictory();
  }

  /**
   * Remote fire relayed by Network onto the bus (isLocal === false).
   * @param {{ origin?: number[], direction?: number[], isLocal?: boolean }} payload
   */
  _onRemoteFire(payload) {
    if (!this.duel || !this.duel.canControl() || this.state !== GameState.PLAYING) return;
    if (!payload || payload.isLocal !== false) return;
    if (!Array.isArray(payload.origin) || !Array.isArray(payload.direction)) return;
    const ownerId = this.opponent?.id ?? this.duel.remoteId ?? 'remote';
    this.collision.spawnProjectile(
      {
        origin: payload.origin,
        direction: payload.direction,
        isLocal: false,
      },
      ownerId,
    );
    this.audio.playSfx('fire');
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} index
   * @param {{ fovDegrees: number, reactionLatency: number, fireRate: number, predictTrajectory: boolean }} config
   * @param {number} px player spawn x
   * @param {number} pz player spawn z
   * @param {string} [difficulty]
   */
  _spawnEnemyAt(x, z, index, config, px, pz, difficulty = Difficulty.EASY) {
    const id = `enemy-${index}`;
    const fireCooldown = 1 / Math.max(0.05, config.fireRate);
    const at = this._findLegalTankPos(x, z, id);
    // Still blocked after offsets — skip spawn.
    this._refreshBodies();
    const check = this.collision.resolveTankMove(at.x, at.z, at.x, at.z, id);
    if (check.blocked) return;

    const sx = at.x;
    const sz = at.z;
    const towardPlayer = Math.atan2(px - sx, pz - sz);
    // Recruit faces away so opening FOV is empty; Veteran keeps mean forward spawn.
    const rotY =
      difficulty === Difficulty.HARD ? towardPlayer : towardPlayer + Math.PI;
    const tank = new TankController({ moveSpeed: 6.1, fireCooldown });
    tank.reset(sx, sz, rotY);
    if (difficulty === Difficulty.EASY) {
      // First shot cannot be ready on the engage frame (no same-frame volley).
      tank.fireCooldown = fireCooldown * 0.9;
    }
    const spawnGrace = difficulty === Difficulty.HARD ? 0.2 : 3.2;
    const ai = new EnemyAI(config, { x: sx, z: sz }, { spawnGrace });
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

  _teardownDuel() {
    if (this.opponent) {
      this.sceneManager?.despawnEnemyTank(this.opponent.id);
      this.opponent = null;
    }
    this.duel?.reset();
    this.duel = null;
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
        if (enemy.ai.spawnGraceT <= 0) {
          enemy.ai.wantFire = enemy.ai._readyToShoot(world, enemy.ai._canSee(world));
        } else {
          enemy.ai.wantFire = false;
        }
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
    this.bus.emit(Topics.ITEM_COLLECTED, {
      type: got.type,
      entityId,
      pickupId: got.id,
    });
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

  /**
   * WI-034 — remote peer took a pickup; hide it locally (no buff).
   * @param {{ pickupId?: string }} payload
   */
  _onPickupTaken(payload) {
    if (this.state !== GameState.PLAYING && this.state !== GameState.PAUSED) return;
    if (!this.duel) return;
    const pickupId = payload?.pickupId != null ? String(payload.pickupId) : '';
    if (!pickupId) return;
    if (!this.items.takePickup(pickupId)) return;
    this.sceneManager?.syncPickups(this._pickupViews());
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
