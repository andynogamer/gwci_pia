/**
 * REQ-UI — Main Menu. Emits GAME_START via EventBus only.
 */
import { Topics, GameMode, MapId, Difficulty } from '../../core/Constants.js';

const MAP_LABELS = Object.freeze({
  [MapId.DESERT_DUNES]: 'Desert Dunes',
  [MapId.INDUSTRIAL_COMPLEX]: 'Industrial Complex',
  [MapId.LUNAR_STATION]: 'Lunar Station',
});

export class MainMenu {
  /**
   * @param {import('../../core/EventBus.js').EventBus} bus
   * @param {{ navigate: (screen: string) => void }} router
   */
  constructor(bus, router) {
    this.bus = bus;
    this.router = router;
    /** @type {HTMLElement | null} */
    this.el = null;
    this.selection = {
      mode: GameMode.PVE,
      mapId: MapId.DESERT_DUNES,
      difficulty: Difficulty.EASY,
    };
  }

  /**
   * @param {HTMLElement} root
   */
  mount(root) {
    const wrap = document.createElement('section');
    wrap.dataset.screen = 'main-menu';
    wrap.className = 'ui-screen ui-screen--menu';
    wrap.innerHTML = `
      <div class="ui-brand">
        <p class="ui-brand__tag">MICRO-TANKS</p>
        <h1 class="ui-brand__title">Arena 3D</h1>
        <p class="ui-brand__sub">Select loadout, then deploy.</p>
      </div>

      <form class="ui-form" data-form="start">
        <fieldset class="ui-fieldset">
          <legend>Mode</legend>
          <label class="ui-choice">
            <input type="radio" name="mode" value="${GameMode.PVE}" checked />
            <span>Horde Survival (PVE)</span>
          </label>
          <label class="ui-choice">
            <input type="radio" name="mode" value="${GameMode.PVP}" />
            <span>Network Duel (PVP)</span>
          </label>
        </fieldset>

        <fieldset class="ui-fieldset">
          <legend>Arena</legend>
          <select name="mapId" class="ui-select" aria-label="Arena map">
            <option value="${MapId.DESERT_DUNES}">${MAP_LABELS[MapId.DESERT_DUNES]}</option>
            <option value="${MapId.INDUSTRIAL_COMPLEX}">${MAP_LABELS[MapId.INDUSTRIAL_COMPLEX]}</option>
            <option value="${MapId.LUNAR_STATION}">${MAP_LABELS[MapId.LUNAR_STATION]}</option>
          </select>
        </fieldset>

        <fieldset class="ui-fieldset">
          <legend>Difficulty</legend>
          <label class="ui-choice">
            <input type="radio" name="difficulty" value="${Difficulty.EASY}" checked />
            <span>Recruit (EASY)</span>
          </label>
          <label class="ui-choice">
            <input type="radio" name="difficulty" value="${Difficulty.HARD}" />
            <span>Veteran (HARD)</span>
          </label>
        </fieldset>

        <div class="ui-actions">
          <button type="submit" class="ui-btn ui-btn--primary" data-action="start">Deploy</button>
          <button type="button" class="ui-btn" data-action="settings">Settings</button>
          <button type="button" class="ui-btn" data-action="highscores">Highscores</button>
        </div>
      </form>
    `;

    const form = wrap.querySelector('[data-form="start"]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const mode = String(data.get('mode'));
      const mapId = Number(data.get('mapId'));
      const difficulty = String(data.get('difficulty'));

      if (mode !== GameMode.PVE && mode !== GameMode.PVP) return;
      if (![MapId.DESERT_DUNES, MapId.INDUSTRIAL_COMPLEX, MapId.LUNAR_STATION].includes(mapId)) {
        return;
      }
      if (difficulty !== Difficulty.EASY && difficulty !== Difficulty.HARD) return;

      this.selection = { mode, mapId, difficulty };
      this.bus.emit(Topics.GAME_START, {
        mode,
        mapId,
        difficulty,
      });
    });

    wrap.querySelector('[data-action="settings"]').addEventListener('click', () => {
      this.router.navigate('settings');
    });
    wrap.querySelector('[data-action="highscores"]').addEventListener('click', () => {
      this.router.navigate('highscores');
    });

    this.el = wrap;
    root.appendChild(wrap);
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
  }
}
