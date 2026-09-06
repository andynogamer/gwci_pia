/**
 * REQ-MODES — Horde Survival (PVE waves). Offline; no sockets.
 * Wave timers advance only when GameManager calls update(dt) while Playing.
 * WI-023: EASY opening uses spawn stagger + longer wave-1 gate (not REQ-DIFF).
 */

import { Difficulty } from '../../core/Constants.js';

const INTERMISSION_S = 2.5;
/** Recruit only — playability gate before first wave, not match-length difficulty. */
const EASY_OPENING_S = 2.8;
const HARD_OPENING_S = INTERMISSION_S * 0.35;
const EASY_STAGGER_S = 0.65;
const MAX_WAVES = 5;
const POINTS_PER_KILL = 100;
const POINTS_PER_WAVE = 250;
const SURVIVAL_BONUS = 500;

/**
 * @param {number} wave 1-based
 * @param {string} [difficulty]
 */
export function enemiesForWave(wave, difficulty = Difficulty.EASY) {
  if (difficulty === Difficulty.EASY && wave === 1) return 2;
  return Math.min(2 + wave, 6);
}

export class HordeSurvival {
  /**
   * @param {{
   *   difficulty?: string,
   *   spawnPoints?: Array<[number, number]>,
   *   spawnEnemy: (spot: { x: number, z: number }, index: number) => void,
   *   aliveCount: () => number,
   *   onVictory: (result: { winner: string, score: number }) => void,
   *   onWaveStart?: (wave: number) => void,
   * }} hooks
   */
  constructor(hooks) {
    this.difficulty = hooks.difficulty ?? Difficulty.EASY;
    this.spawnPoints = (hooks.spawnPoints ?? []).map(([x, z]) => ({ x, z }));
    this._spawnEnemy = hooks.spawnEnemy;
    this._aliveCount = hooks.aliveCount;
    this._onVictory = hooks.onVictory;
    this._onWaveStart = hooks.onWaveStart ?? (() => {});

    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    /** @type {'idle' | 'intermission' | 'combat' | 'won'} */
    this.phase = 'idle';
    this.intermissionT = 0;
    this.pendingSpawns = 0;
    this._seq = 0;
    /** @type {Array<{ x: number, z: number, index: number }>} */
    this._spawnQueue = [];
    this._staggerT = 0;
  }

  /** Begin countdown to wave 1. */
  start() {
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.phase = 'intermission';
    this.intermissionT =
      this.difficulty === Difficulty.HARD ? HARD_OPENING_S : EASY_OPENING_S;
    this.pendingSpawns = 0;
    this._seq = 0;
    this._spawnQueue.length = 0;
    this._staggerT = 0;
  }

  /**
   * @param {number} dt seconds — must be THREE.Clock delta; ignored while Paused (no calls)
   */
  update(dt) {
    if (dt <= 0) return;
    if (this.phase === 'won' || this.phase === 'idle') return;

    if (this.phase === 'intermission') {
      this.intermissionT -= dt;
      if (this.intermissionT > 0) return;
      this._beginWave();
      return;
    }

    if (this.phase !== 'combat') return;

    this._flushSpawnQueue(dt);

    if (this._spawnQueue.length > 0 || this._aliveCount() > 0) return;

    this.score += POINTS_PER_WAVE;
    if (this.wave >= MAX_WAVES) {
      this.phase = 'won';
      this.score += SURVIVAL_BONUS;
      this._onVictory({ winner: 'player', score: this.score });
      return;
    }

    this.phase = 'intermission';
    this.intermissionT = INTERMISSION_S;
  }

  /** Call when an AI tank is destroyed. */
  onEnemyKilled() {
    if (this.phase === 'idle' || this.phase === 'won') return;
    this.kills += 1;
    this.score += POINTS_PER_KILL;
  }

  /** Defeat payload when the local tank dies. */
  defeatResult() {
    return { winner: 'arena', score: this.score };
  }

  reset() {
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.phase = 'idle';
    this.intermissionT = 0;
    this.pendingSpawns = 0;
    this._seq = 0;
    this._spawnQueue.length = 0;
    this._staggerT = 0;
  }

  getDebug() {
    return {
      wave: this.wave,
      phase: this.phase,
      score: this.score,
      kills: this.kills,
      intermissionT: this.intermissionT,
      maxWaves: MAX_WAVES,
      spawnQueue: this._spawnQueue.length,
      difficulty: this.difficulty,
    };
  }

  _beginWave() {
    this.wave += 1;
    this.phase = 'combat';
    this._onWaveStart(this.wave);
    const count = enemiesForWave(this.wave, this.difficulty);
    this.pendingSpawns = count;
    const points = this.spawnPoints.length > 0
      ? this.spawnPoints
      : [{ x: 12, z: -14 }, { x: -12, z: -14 }];

    /** @type {Array<{ x: number, z: number, index: number }>} */
    const batch = [];
    for (let i = 0; i < count; i += 1) {
      const base = points[i % points.length];
      const ring = Math.floor(i / points.length);
      const angle = (i / count) * Math.PI * 2;
      const x = base.x + Math.cos(angle) * (1.8 + ring * 2.2);
      const z = base.z + Math.sin(angle) * (1.8 + ring * 2.2);
      batch.push({ x, z, index: this._seq });
      this._seq += 1;
      this.pendingSpawns -= 1;
    }

    const stagger =
      this.difficulty === Difficulty.EASY && this.wave === 1 ? EASY_STAGGER_S : 0;
    if (stagger <= 0) {
      for (const job of batch) {
        this._spawnEnemy({ x: job.x, z: job.z }, job.index);
      }
      this._spawnQueue.length = 0;
      this._staggerT = 0;
      return;
    }

    // First tank immediate; remaining staggered so no same-frame opening volley.
    const first = batch.shift();
    if (first) this._spawnEnemy({ x: first.x, z: first.z }, first.index);
    this._spawnQueue = batch;
    this._staggerT = stagger;
  }

  /**
   * @param {number} dt
   */
  _flushSpawnQueue(dt) {
    if (this._spawnQueue.length === 0) return;
    this._staggerT -= dt;
    while (this._spawnQueue.length > 0 && this._staggerT <= 0) {
      const job = this._spawnQueue.shift();
      if (!job) break;
      this._spawnEnemy({ x: job.x, z: job.z }, job.index);
      this._staggerT += EASY_STAGGER_S;
    }
  }
}
