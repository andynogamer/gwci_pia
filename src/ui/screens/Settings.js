/**
 * REQ-UI / WI-014 — Settings. Audio sliders persist under mta.* localStorage.
 * Keys: mta.masterVolume, mta.sfxVolume — floats [0,1]
 */
import { Topics } from '../../core/Constants.js';

/** @type {const} */
export const SETTINGS_KEYS = {
  masterVolume: 'mta.masterVolume',
  sfxVolume: 'mta.sfxVolume',
};

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

/**
 * Read persisted volumes (defaults to 1). Survives page refresh.
 * @returns {{ masterVolume: number, sfxVolume: number }}
 */
export function loadPersistedSettings() {
  return {
    masterVolume: clamp01(localStorage.getItem(SETTINGS_KEYS.masterVolume) ?? '1'),
    sfxVolume: clamp01(localStorage.getItem(SETTINGS_KEYS.sfxVolume) ?? '1'),
  };
}

/**
 * @param {{ masterVolume: number, sfxVolume: number }} volumes
 */
export function savePersistedSettings(volumes) {
  localStorage.setItem(SETTINGS_KEYS.masterVolume, String(clamp01(volumes.masterVolume)));
  localStorage.setItem(SETTINGS_KEYS.sfxVolume, String(clamp01(volumes.sfxVolume)));
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
    const { masterVolume: master, sfxVolume: sfx } = loadPersistedSettings();

    const wrap = document.createElement('section');
    wrap.dataset.screen = 'settings';
    wrap.className = 'ui-screen ui-screen--settings';
    wrap.hidden = true;
    wrap.innerHTML = `
      <header class="ui-screen__head">
        <h2>Settings</h2>
        <p class="ui-screen__sub">Audio levels and control reference. Saved on this device.</p>
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

    const masterInput = /** @type {HTMLInputElement} */ (
      wrap.querySelector('input[name="masterVolume"]')
    );
    const sfxInput = /** @type {HTMLInputElement} */ (
      wrap.querySelector('input[name="sfxVolume"]')
    );
    const masterOut = wrap.querySelector('[data-out="master"]');
    const sfxOut = wrap.querySelector('[data-out="sfx"]');

    const publish = () => {
      const payload = {
        masterVolume: clamp01(masterInput.value),
        sfxVolume: clamp01(sfxInput.value),
      };
      savePersistedSettings(payload);
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
