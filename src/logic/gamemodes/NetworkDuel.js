/**
 * REQ-MODES — Network Duel (PvP rules). Transport is Agent-Network.
 * Consumes EventBus CLIENT_STATE_UPDATE / remote PLAYER_FIRE only — no WebSockets.
 */

const WIN_SCORE_BASE = 1000;

export class NetworkDuel {
  /**
   * @param {{
   *   localId: string,
   *   publishLocalState: (payload: {
   *     id: string, timestamp: number, pos: number[], rotY: number, turretRotY: number, hp: number
   *   }) => void,
   *   onVictory: (result: { winner: string, score: number }) => void,
   * }} hooks
   */
  constructor(hooks) {
    this.localId = String(hooks.localId || 'local');
    this._publishLocalState = hooks.publishLocalState;
    this._onVictory = hooks.onVictory;

    /** @type {string | null} */
    this.remoteId = null;
    /** @type {{
     *   id: string, timestamp: number, pos: number[], rotY: number, turretRotY: number, hp: number
     * } | null} */
    this.remote = null;
    this.score = 0;
    /** @type {'idle' | 'active' | 'over'} */
    this.phase = 'idle';
    this._stateAcc = 0;
  }

  start() {
    this.remoteId = null;
    this.remote = null;
    this.score = 0;
    this.phase = 'active';
    this._stateAcc = 0;
  }

  /**
   * Publish local pose/hp on a short cadence (scaled by dt; frozen while Paused).
   * @param {number} dt
   * @param {{ x: number, y?: number, z: number, rotY: number, turretRotY: number, hp: number }} local
   */
  update(dt, local) {
    if (this.phase !== 'active' || dt <= 0 || !local) return;
    this._stateAcc += dt;
    if (this._stateAcc < 0.05) return;
    this._stateAcc = 0;
    this._publishLocalState({
      id: this.localId,
      timestamp: Date.now(),
      pos: [local.x, local.y ?? 0, local.z],
      rotY: local.rotY,
      turretRotY: local.turretRotY,
      hp: local.hp,
    });
  }

  /**
   * Apply opponent telemetry from EventBus (remote peer only).
   * @param {{ id?: string, timestamp?: number, pos?: number[], rotY?: number, turretRotY?: number, hp?: number }} payload
   * @returns {boolean} true if this update belongs to the remote peer
   */
  applyRemoteState(payload) {
    if (this.phase !== 'active' || !payload) return false;
    const id = payload.id != null ? String(payload.id) : '';
    if (!id || id === this.localId) return false;
    if (!Array.isArray(payload.pos) || payload.pos.length !== 3) return false;

    const timestamp = Number(payload.timestamp) || 0;
    if (this.remote && timestamp > 0 && timestamp < this.remote.timestamp) {
      return false;
    }

    this.remoteId = id;
    this.remote = {
      id,
      timestamp,
      pos: [Number(payload.pos[0]), Number(payload.pos[1]), Number(payload.pos[2])],
      rotY: Number(payload.rotY) || 0,
      turretRotY: Number(payload.turretRotY) || 0,
      hp: Math.max(0, Number(payload.hp) || 0),
    };

    if (this.remote.hp <= 0) {
      this._finishVictory();
    }
    return true;
  }

  /**
   * Local tank destroyed — opponent wins.
   * @returns {{ winner: string, score: number }}
   */
  defeatResult() {
    this.phase = 'over';
    return {
      winner: this.remoteId ? String(this.remoteId) : 'opponent',
      score: this.score,
    };
  }

  reset() {
    this.remoteId = null;
    this.remote = null;
    this.score = 0;
    this.phase = 'idle';
    this._stateAcc = 0;
  }

  getDebug() {
    return {
      phase: this.phase,
      localId: this.localId,
      remoteId: this.remoteId,
      remoteHp: this.remote?.hp ?? null,
      score: this.score,
    };
  }

  _finishVictory() {
    if (this.phase !== 'active') return;
    this.phase = 'over';
    this.score = WIN_SCORE_BASE;
    this._onVictory({ winner: 'player', score: this.score });
  }
}
