/**
 * REQ-UI — Main Menu loadout. Account lives on Login / Register screens.
 */
import { Topics, GameMode, MapId, Difficulty } from '../../core/Constants.js';
import {
  loadPersistedAuth,
  clearPersistedAuth,
} from '../auth/session.js';

const MAP_LABELS = Object.freeze({
  [MapId.DESERT_DUNES]: 'Desert Dunes',
  [MapId.INDUSTRIAL_COMPLEX]: 'Industrial Complex',
  [MapId.LUNAR_STATION]: 'Lunar Station',
});

// Re-export session helpers for any older imports.
export {
  AUTH_KEYS,
  loadPersistedAuth,
  savePersistedAuth,
  clearPersistedAuth,
} from '../auth/session.js';

export class MainMenu {
  /**
   * @param {import('../../core/EventBus.js').EventBus} bus
   * @param {{ navigate: (screen: string) => void }} router
   * @param {{
   *   onSession?: (session: { token: string | null, username: string | null }) => void,
   * }} [auth]
   */
  constructor(bus, router, auth = {}) {
    this.bus = bus;
    this.router = router;
    this.auth = auth;
    /** @type {HTMLElement | null} */
    this.el = null;
    /** @type {HTMLElement | null} */
    this.sessionEl = null;
    /** @type {HTMLElement | null} */
    this.guestActionsEl = null;
    /** @type {HTMLElement | null} */
    this.userActionsEl = null;
    /** @type {HTMLElement | null} */
    this.deployStatusEl = null;
    this.username = null;
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

      <div class="ui-account-bar" data-account-bar>
        <p class="ui-session" data-auth-session hidden></p>
        <div class="ui-actions ui-account-bar__guest" data-auth-guest>
          <button type="button" class="ui-btn" data-action="login">Sign In</button>
          <button type="button" class="ui-btn ui-btn--primary" data-action="register">Register</button>
        </div>
        <div class="ui-actions ui-account-bar__user" data-auth-user hidden>
          <button type="button" class="ui-btn" data-action="logout">Logout</button>
        </div>
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
            <span>Network Duel (PVP) — sign-in required</span>
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

        <p class="ui-status ui-status--error" data-deploy-status hidden></p>

        <div class="ui-actions">
          <button type="submit" class="ui-btn ui-btn--primary" data-action="start">Deploy</button>
          <button type="button" class="ui-btn" data-action="settings">Settings</button>
          <button type="button" class="ui-btn" data-action="highscores">Highscores</button>
        </div>
      </form>
    `;

    this.sessionEl = wrap.querySelector('[data-auth-session]');
    this.guestActionsEl = wrap.querySelector('[data-auth-guest]');
    this.userActionsEl = wrap.querySelector('[data-auth-user]');
    this.deployStatusEl = wrap.querySelector('[data-deploy-status]');

    wrap.querySelector('[data-action="login"]').addEventListener('click', () => {
      this.router.navigate('login');
    });
    wrap.querySelector('[data-action="register"]').addEventListener('click', () => {
      this.router.navigate('register');
    });
    wrap.querySelector('[data-action="logout"]').addEventListener('click', () => {
      this._logout();
    });

    const form = wrap.querySelector('[data-form="start"]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._clearDeployStatus();
      const data = new FormData(form);
      const mode = String(data.get('mode'));
      const mapId = Number(data.get('mapId'));
      const difficulty = String(data.get('difficulty'));

      if (mode !== GameMode.PVE && mode !== GameMode.PVP) return;
      if (![MapId.DESERT_DUNES, MapId.INDUSTRIAL_COMPLEX, MapId.LUNAR_STATION].includes(mapId)) {
        return;
      }
      if (difficulty !== Difficulty.EASY && difficulty !== Difficulty.HARD) return;

      // WI-028 — Network Duel requires a signed-in Bearer session.
      if (mode === GameMode.PVP) {
        const session = loadPersistedAuth();
        if (!session.token) {
          this._setDeployStatus('Sign in to deploy a Network Duel.');
          this.router.navigate('login');
          return;
        }
      }

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
    this._restoreSession();
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    if (this.el) this.el.hidden = !visible;
    if (visible) this.refreshSession();
  }

  /** Refresh account strip after login / register / logout. */
  refreshSession() {
    const session = loadPersistedAuth();
    this.username = session.username;
    this._renderSession();
    if (session.token) this._clearDeployStatus();
  }

  _restoreSession() {
    const session = loadPersistedAuth();
    this.username = session.username;
    this.auth.onSession?.({
      token: session.token,
      username: session.username,
    });
    this._renderSession();
  }

  _logout() {
    clearPersistedAuth();
    this.username = null;
    this.auth.onSession?.({ token: null, username: null });
    this._renderSession();
  }

  /**
   * @param {string} message
   */
  _setDeployStatus(message) {
    if (!this.deployStatusEl) return;
    this.deployStatusEl.hidden = false;
    this.deployStatusEl.textContent = message;
  }

  _clearDeployStatus() {
    if (!this.deployStatusEl) return;
    this.deployStatusEl.hidden = true;
    this.deployStatusEl.textContent = '';
  }

  _renderSession() {
    const loggedIn = Boolean(this.username);
    if (this.sessionEl) {
      this.sessionEl.hidden = !loggedIn;
      this.sessionEl.textContent = loggedIn ? `Signed in as ${this.username}` : '';
    }
    if (this.guestActionsEl) this.guestActionsEl.hidden = loggedIn;
    if (this.userActionsEl) this.userActionsEl.hidden = !loggedIn;
  }
}
