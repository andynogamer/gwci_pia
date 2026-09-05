/**
 * REQ-UI — Settings. Audio sliders persist to localStorage (mta.*).
 */
import { Topics } from '../../core/Constants.js';

const KEY_MASTER = 'mta.masterVolume';
const KEY_SFX = 'mta.sfxVolume';

export class Settings {
  /**
   * @param {import('../../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const master = Number(localStorage.getItem(KEY_MASTER) ?? '1');
    const sfx = Number(localStorage.getItem(KEY_SFX) ?? '1');
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'settings';
    wrap.hidden = true;
    wrap.innerHTML = `<h2>Settings</h2>`;
    root.appendChild(wrap);
    this.bus.emit(Topics.SETTINGS_UPDATED, {
      masterVolume: master,
      sfxVolume: sfx,
    });
  }
}
