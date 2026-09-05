/**
 * REQ-UI — Main Menu. Emits GAME_START via EventBus only.
 */
import { Topics, GameMode, MapId, Difficulty } from '../../core/Constants.js';

export class MainMenu {
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
    wrap.dataset.screen = 'main-menu';
    wrap.innerHTML = `
      <h1>Micro-Tanks Arena 3D</h1>
      <p>Scaffold — select mode, map, difficulty when gameplay lands.</p>
      <button type="button" data-action="start">Start (PVE / Map 1 / EASY)</button>
    `;
    wrap.querySelector('[data-action="start"]').addEventListener('click', () => {
      this.bus.emit(Topics.GAME_START, {
        mode: GameMode.PVE,
        mapId: MapId.DESERT_DUNES,
        difficulty: Difficulty.EASY,
      });
    });
    root.appendChild(wrap);
  }
}
