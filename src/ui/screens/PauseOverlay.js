/**
 * REQ-UI — Pause overlay. Driven by GAME_PAUSE.
 */
import { Topics } from '../../core/Constants.js';

export class PauseOverlay {
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
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'pause';
    wrap.hidden = true;
    wrap.innerHTML = `<h2>Paused</h2>`;
    root.appendChild(wrap);
    this.bus.on(Topics.GAME_PAUSE, (payload) => {
      wrap.hidden = !payload?.isPaused;
    });
  }
}
