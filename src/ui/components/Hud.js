/**
 * Agent-UI — in-game HUD (armor, ammo, power-up timer, radar).
 * Radar + power-up countdown consume HUD_STATE plain numbers only — no three.
 */

const POWERUP_LABEL = Object.freeze({
  SHIELD: 'Shield',
  TRIPLE: 'Triple shell',
  REPAIR: 'Repair kit',
});

/** World half-extent mapped onto the radar disk (matches Logic ARENA_HALF / WI-031). */
const RADAR_WORLD_R = 34;

export class Hud {
  constructor() {
    /** @type {HTMLElement | null} */
    this.el = null;
    /** @type {HTMLCanvasElement | null} */
    this._radar = null;
    /** @type {CanvasRenderingContext2D | null} */
    this._ctx = null;
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('div');
    wrap.dataset.hud = 'true';
    wrap.className = 'ui-hud';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="ui-hud__bar" data-armor>
        <span class="ui-hud__label">Armor</span>
        <div class="ui-hud__meter"><i style="width:100%"></i></div>
      </div>
      <div class="ui-hud__chip" data-ammo>Ammo —</div>
      <div class="ui-hud__chip" data-powerup>Power-up —</div>
      <div class="ui-hud__radar" data-radar aria-label="Radar minimap">
        <canvas width="150" height="150" data-radar-canvas></canvas>
      </div>
    `;
    this.el = wrap;
    this._radar = wrap.querySelector('[data-radar-canvas]');
    this._ctx = this._radar?.getContext('2d') ?? null;
    root.appendChild(wrap);
    this.clearRadar();
  }

  /**
   * @param {number} currentHp
   * @param {number} maxHp
   */
  setArmor(currentHp, maxHp) {
    const fill = this.el?.querySelector('.ui-hud__meter i');
    if (!fill) return;
    const pct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
    fill.style.width = `${pct}%`;
  }

  /**
   * @param {string} text
   */
  setPowerup(text) {
    const chip = this.el?.querySelector('[data-powerup]');
    if (chip) chip.textContent = text;
  }

  /**
   * @param {string} text
   */
  setAmmo(text) {
    const chip = this.el?.querySelector('[data-ammo]');
    if (chip) chip.textContent = text;
  }

  /**
   * Apply CONTRACTS.md HUD_STATE payload.
   * @param {{
   *   local?: { x?: number, z?: number, rotY?: number },
   *   others?: Array<{ id?: string, x?: number, z?: number }>,
   *   powerup?: { type?: string, remaining?: number } | null,
   * }} payload
   */
  applyHudState(payload) {
    if (!payload) return;

    const powerup = payload.powerup ?? null;
    if (powerup && powerup.type) {
      const label = POWERUP_LABEL[powerup.type] ?? String(powerup.type);
      const sec = Math.max(0, Math.ceil(Number(powerup.remaining) || 0));
      this.setPowerup(`${label} ${sec}s`);
      this.setAmmo(powerup.type === 'TRIPLE' ? 'Ammo ×3' : 'Ammo —');
    } else {
      this.setPowerup('Power-up —');
      this.setAmmo('Ammo —');
    }

    const local = payload.local ?? { x: 0, z: 0, rotY: 0 };
    const others = Array.isArray(payload.others) ? payload.others : [];
    this._drawRadar(local, others);
  }

  clearRadar() {
    this._drawRadar({ x: 0, z: 0, rotY: 0 }, []);
  }

  /**
   * @param {{ x?: number, z?: number, rotY?: number }} local
   * @param {Array<{ id?: string, x?: number, z?: number }>} others
   */
  _drawRadar(local, others) {
    const canvas = this._radar;
    const ctx = this._ctx;
    if (!canvas || !ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = Math.min(cx, cy) - 4;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 14, 12, 0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(61, 155, 120, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(61, 155, 120, 0.2)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.strokeStyle = 'rgba(61, 155, 120, 0.15)';
    ctx.stroke();

    const lx = Number(local.x) || 0;
    const lz = Number(local.z) || 0;
    const rotY = Number(local.rotY) || 0;

    for (const o of others) {
      const ox = Number(o.x) || 0;
      const oz = Number(o.z) || 0;
      const p = this._worldToRadar(ox - lx, oz - lz, rotY, r);
      if (p.dist > r) continue;
      ctx.beginPath();
      ctx.arc(cx + p.x, cy + p.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 90, 70, 0.95)';
      ctx.fill();
    }

    // Local tank: center wedge pointing "forward" on the radar (up).
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120, 220, 180, 0.95)';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Player-relative XZ → radar pixels (forward = up).
   * @param {number} dx
   * @param {number} dz
   * @param {number} rotY
   * @param {number} pixelR
   */
  _worldToRadar(dx, dz, rotY, pixelR) {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    // Hull forward is +sin(rotY), +cos(rotY) in world XZ.
    const forward = dx * s + dz * c;
    const right = dx * c - dz * s;
    const scale = pixelR / RADAR_WORLD_R;
    return {
      x: right * scale,
      y: -forward * scale,
      dist: Math.hypot(right, forward) * scale,
    };
  }
}
