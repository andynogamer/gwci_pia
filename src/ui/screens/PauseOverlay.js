/**
 * REQ-UI — Pause overlay. Driven by GAME_PAUSE; does not touch the canvas.
 */
import { Topics } from '../../core/Constants.js';

export class PauseOverlay {
  /**
   * @param {import('../../core/EventBus.js').EventBus} bus
   * @param {{ navigate: (screen: string) => void, quitToMenu: () => void }} router
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
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'pause';
    wrap.className = 'ui-screen ui-screen--pause';
    wrap.hidden = true;
    wrap.innerHTML = `
      <header class="ui-screen__head">
        <h2>Paused</h2>
        <p class="ui-screen__sub">Match held. Resume or return to menu.</p>
      </header>

      <div class="ui-actions ui-actions--stack">
        <button type="button" class="ui-btn ui-btn--primary" data-action="resume">Resume</button>
        <button type="button" class="ui-btn" data-action="settings">Settings</button>
        <button type="button" class="ui-btn" data-action="menu">Main Menu</button>
      </div>
    `;

    wrap.querySelector('[data-action="resume"]').addEventListener('click', () => {
      this.bus.emit(Topics.GAME_PAUSE, { isPaused: false });
    });

    wrap.querySelector('[data-action="settings"]').addEventListener('click', () => {
      this.router.navigate('settings');
    });

    wrap.querySelector('[data-action="menu"]').addEventListener('click', () => {
      this.router.quitToMenu();
    });

    // Visibility is owned by UIManager so Settings can stack over pause.
    this.el = wrap;
    root.appendChild(wrap);
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
  }
}
