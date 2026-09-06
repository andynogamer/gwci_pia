/**
 * REQ-MODES — Network Duel (PvP rules). Transport is Agent-Network.
 * Consumes EventBus CLIENT_STATE_UPDATE / ROOM_READY / remote PLAYER_FIRE — no WebSockets.
 * WI-029: pad A/B from ROOM_READY.players[] index; hold control until ready.
 * WI-036: GAME_OVER.winner is registered username, never player UUID.
 * WI-038: victory is claimed by GameManager via takeVictory() (local kill or remote hp≤0).
 */

const WIN_SCORE_BASE = 1000;
const DEFAULT_PADS = [
  [-16, 0],
  [16, 0],
];

export class NetworkDuel {
  /**
   * @param {{
   *   localId: string,
   *   localUsername?: string,
   *   pads?: Array<[number, number]>,
   *   publishLocalState: (payload: {
   *     id: string, timestamp: number, pos: number[], rotY: number, turretRotY: number, hp: number, username: string
   *   }) => void,
   * }} hooks
   */
  constructor(hooks) {
    this.localId = String(hooks.localId || 'local');
    this.localUsername = String(hooks.localUsername || '').trim();
    this._publishLocalState = hooks.publishLocalState;
    const pads = hooks.pads ?? DEFAULT_PADS;
    /** @type {[[number, number], [number, number]]} */
    this.pads = [
      [Number(pads[0]?.[0]) || DEFAULT_PADS[0][0], Number(pads[0]?.[1]) || DEFAULT_PADS[0][1]],
      [Number(pads[1]?.[0]) || DEFAULT_PADS[1][0], Number(pads[1]?.[1]) || DEFAULT_PADS[1][1]],
    ];

    /** @type {string | null} */
    this.remoteId = null;
    /** @type {string} */
    this.remoteUsername = '';
    /** @type {{
     *   id: string, timestamp: number, pos: number[], rotY: number, turretRotY: number, hp: number
     * } | null} */
    this.remote = null;
    this.score = 0;
    /** @type {'idle' | 'waiting' | 'active' | 'over'} */
    this.phase = 'idle';
    /** @type {0 | 1 | null} */
    this.slot = null;
    this.roomReady = false;
    this._stateAcc = 0;
  }

  start() {
    this.remoteId = null;
    this.remoteUsername = '';
    this.remote = null;
    this.score = 0;
    this.phase = 'waiting';
    this.slot = null;
    this.roomReady = false;
    this._stateAcc = 0;
  }

  /** Chassis / turret / fire allowed only after ROOM_READY pad snap. */
  canControl() {
    return this.phase === 'active' && this.roomReady;
  }

  /**
   * Assign pads from join-order players[]. Index 0 → pad A, 1 → pad B.
   * @param {{ roomId?: string, players?: string[] }} payload
   * @returns {{
   *   local: { x: number, z: number, rotY: number },
   *   remote: { id: string, x: number, z: number, rotY: number },
   * } | null}
   */
  applyRoomReady(payload) {
    if (this.phase !== 'waiting' && this.phase !== 'active') return null;
    if (!payload || !Array.isArray(payload.players) || payload.players.length < 2) {
      return null;
    }
    const players = payload.players.map((id) => String(id));
    const idx = players.indexOf(this.localId);
    if (idx !== 0 && idx !== 1) return null;

    const other = 1 - idx;
    const myPad = this.pads[idx];
    const theirPad = this.pads[other];
    const remoteId = players[other];
    const rotY = Math.atan2(theirPad[0] - myPad[0], theirPad[1] - myPad[1]);
    const remoteRotY = Math.atan2(myPad[0] - theirPad[0], myPad[1] - theirPad[1]);

    this.slot = /** @type {0 | 1} */ (idx);
    this.remoteId = remoteId;
    this.roomReady = true;
    this.phase = 'active';

    return {
      local: { x: myPad[0], z: myPad[1], rotY },
      remote: { id: remoteId, x: theirPad[0], z: theirPad[1], rotY: remoteRotY },
    };
  }

  /**
   * Publish local pose/hp on a short cadence once the match is live on pads.
   * @param {number} dt
   * @param {{ x: number, y?: number, z: number, rotY: number, turretRotY: number, hp: number }} local
   */
  update(dt, local) {
    if (!this.canControl() || dt <= 0 || !local) return;
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
      username: this.localUsername,
    });
  }

  /**
   * Apply opponent telemetry from EventBus (remote peer only).
   * @param {{ id?: string, timestamp?: number, pos?: number[], rotY?: number, turretRotY?: number, hp?: number, username?: string }} payload
   * @returns {{ applied: boolean, victory: boolean }}
   */
  applyRemoteState(payload) {
    if (!this.roomReady || this.phase !== 'active' || !payload) {
      return { applied: false, victory: false };
    }
    const id = payload.id != null ? String(payload.id) : '';
    if (!id || id === this.localId) return { applied: false, victory: false };
    if (!Array.isArray(payload.pos) || payload.pos.length !== 3) {
      return { applied: false, victory: false };
    }

    const timestamp = Number(payload.timestamp) || 0;
    if (this.remote && timestamp > 0 && timestamp < this.remote.timestamp) {
      return { applied: false, victory: false };
    }

    this.remoteId = id;
    if (typeof payload.username === 'string' && payload.username.trim()) {
      this.remoteUsername = payload.username.trim();
    }
    this.remote = {
      id,
      timestamp,
      pos: [Number(payload.pos[0]), Number(payload.pos[1]), Number(payload.pos[2])],
      rotY: Number(payload.rotY) || 0,
      turretRotY: Number(payload.turretRotY) || 0,
      hp: Math.max(0, Number(payload.hp) || 0),
    };

    return {
      applied: true,
      victory: this.remote.hp <= 0,
    };
  }

  /**
   * Local tank destroyed — opponent wins (username, never UUID).
   * @returns {{ winner: string, score: number }}
   */
  defeatResult() {
    this.phase = 'over';
    return {
      winner: this.remoteUsername || '',
      score: this.score,
    };
  }

  /**
   * WI-038 — claim local victory once (remote dead or local kill confirm).
   * @returns {{ winner: string, score: number } | null}
   */
  takeVictory() {
    if (this.phase !== 'active') return null;
    this.phase = 'over';
    this.score = WIN_SCORE_BASE;
    return {
      winner: this.localUsername || '',
      score: this.score,
    };
  }

  reset() {
    this.remoteId = null;
    this.remoteUsername = '';
    this.remote = null;
    this.score = 0;
    this.phase = 'idle';
    this.slot = null;
    this.roomReady = false;
    this._stateAcc = 0;
  }

  getDebug() {
    return {
      phase: this.phase,
      localId: this.localId,
      localUsername: this.localUsername,
      remoteId: this.remoteId,
      remoteUsername: this.remoteUsername,
      remoteHp: this.remote?.hp ?? null,
      score: this.score,
      slot: this.slot,
      roomReady: this.roomReady,
      pads: this.pads,
    };
  }
}
