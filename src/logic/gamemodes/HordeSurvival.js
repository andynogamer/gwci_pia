/**
 * REQ-MODES — Horde Survival (PVE waves). Offline; no sockets.
 * Wave timers advance only when GameManager calls update(dt) while Playing.
 */

const INTERMISSION_S = 2.5;
const MAX_WAVES = 5;
const POINTS_PER_KILL = 100;
const POINTS_PER_WAVE = 250;
const SURVIVAL_BONUS = 500;

/**
 * @param {number} wave 1-based
 */
export function enemiesForWave(wave) {
  return Math.min(2 + wave, 6);
}

export class HordeSurvival {
  /**
   * @param {{
   *   spawnPoints?: Array<[number, number]>,
   *   spawnEnemy: (spot: { x: number, z: number }, index: number) => void,
   *   aliveCount: () => number,
   *   onVictory: (result: { winner: string, score: number }) => void,
   * }} hooks
   */
  constructor(hooks) {
    this.spawnPoints = (hooks.spawnPoints ?? []).map(([x, z]) => ({ x, z }));
    this._spawnEnemy = hooks.spawnEnemy;
    this._aliveCount = hooks.aliveCount;
    this._onVictory = hooks.onVictory;

    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    /** @type {'idle' | 'intermission' | 'combat' | 'won'} */
    this.phase = 'idle';
    this.intermissionT = 0;
    this.pendingSpawns = 0;
    this._seq = 0;
  }

  /** Begin countdown to wave 1. */
  start() {
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.phase = 'intermission';
    this.intermissionT = INTERMISSION_S * 0.4;
    this.pendingSpawns = 0;
    this._seq = 0;
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
    if (this._aliveCount() > 0) return;

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
  }

  getDebug() {
    return {
      wave: this.wave,
      phase: this.phase,
      score: this.score,
      kills: this.kills,
      intermissionT: this.intermissionT,
      maxWaves: MAX_WAVES,
    };
  }

  _beginWave() {
    this.wave += 1;
    this.phase = 'combat';
    const count = enemiesForWave(this.wave);
    this.pendingSpawns = count;
    const points = this.spawnPoints.length > 0
      ? this.spawnPoints
      : [{ x: 12, z: -14 }, { x: -12, z: -14 }];

    for (let i = 0; i < count; i += 1) {
      const base = points[i % points.length];
      const ring = Math.floor(i / points.length);
      const angle = (i / count) * Math.PI * 2;
      const x = base.x + Math.cos(angle) * (1.8 + ring * 2.2);
      const z = base.z + Math.sin(angle) * (1.8 + ring * 2.2);
      this._spawnEnemy({ x, z }, this._seq);
      this._seq += 1;
      this.pendingSpawns -= 1;
    }
  }
}
