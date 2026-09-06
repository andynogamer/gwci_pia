/**
 * REQ-UI — Settings. Audio sliders; persist under mta.* (full API wire in WI-014).
 * Keys: mta.masterVolume, mta.sfxVolume — floats [0,1]
 */
import { Topics } from '../../core/Constants.js';

const KEY_MASTER = 'mta.masterVolume';
const KEY_SFX = 'mta.sfxVolume';

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

export class Settings {
  /**
   * @param {import('../../core/EventBus.js').EventBus} bus
   * @param {{ navigate: (screen: string) => void, back: () => void }} router
   */
  constructor(bus, router) {
    this.bus = bus;
    this.router = router;
    /** @type {HTMLElement | null} */
    this.el = null;
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const master = clamp01(localStorage.getItem(KEY_MASTER) ?? '1');
    const sfx = clamp01(localStorage.getItem(KEY_SFX) ?? '1');

    const wrap = document.createElement('section');
    wrap.dataset.screen = 'settings';
    wrap.className = 'ui-screen ui-screen--settings';
    wrap.hidden = true;
    wrap.innerHTML = `
      <header class="ui-screen__head">
        <h2>Settings</h2>
        <p class="ui-screen__sub">Audio levels and control reference.</p>
      </header>

      <div class="ui-form">
        <label class="ui-slider">
          <span class="ui-slider__label">Master volume</span>
          <input type="range" name="masterVolume" min="0" max="1" step="0.01" value="${master}" />
          <output data-out="master">${Math.round(master * 100)}</output>
        </label>

        <label class="ui-slider">
          <span class="ui-slider__label">SFX volume</span>
          <input type="range" name="sfxVolume" min="0" max="1" step="0.01" value="${sfx}" />
          <output data-out="sfx">${Math.round(sfx * 100)}</output>
        </label>

        <div class="ui-controls-ref">
          <h3>Controls</h3>
          <dl class="ui-keymap">
            <div><dt>Move</dt><dd>W A S D</dd></div>
            <div><dt>Turret</dt><dd>← → arrows</dd></div>
            <div><dt>Fire</dt><dd>Space</dd></div>
            <div><dt>Pause</dt><dd>Esc</dd></div>
          </dl>
        </div>

        <div class="ui-actions">
          <button type="button" class="ui-btn ui-btn--primary" data-action="back">Back</button>
        </div>
      </div>
    `;

    const masterInput = wrap.querySelector('input[name="masterVolume"]');
    const sfxInput = wrap.querySelector('input[name="sfxVolume"]');
    const masterOut = wrap.querySelector('[data-out="master"]');
    const sfxOut = wrap.querySelector('[data-out="sfx"]');

    const publish = () => {
      const payload = {
        masterVolume: clamp01(masterInput.value),
        sfxVolume: clamp01(sfxInput.value),
      };
      localStorage.setItem(KEY_MASTER, String(payload.masterVolume));
      localStorage.setItem(KEY_SFX, String(payload.sfxVolume));
      masterOut.textContent = String(Math.round(payload.masterVolume * 100));
      sfxOut.textContent = String(Math.round(payload.sfxVolume * 100));
      this.bus.emit(Topics.SETTINGS_UPDATED, payload);
    };

    masterInput.addEventListener('input', publish);
    sfxInput.addEventListener('input', publish);

    wrap.querySelector('[data-action="back"]').addEventListener('click', () => {
      this.router.back();
    });

    this.el = wrap;
    root.appendChild(wrap);

    // Broadcast stored values so Logic audio can sync on boot.
    this.bus.emit(Topics.SETTINGS_UPDATED, {
      masterVolume: master,
      sfxVolume: sfx,
    });
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
  }
}
