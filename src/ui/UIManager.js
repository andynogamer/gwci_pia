/**
 * Agent-UI — screen orchestration under #ui-root only.
 */
import { Topics } from '../core/Constants.js';
import { MainMenu } from './screens/MainMenu.js';
import { Login } from './screens/Login.js';
import { Register } from './screens/Register.js';
import { Settings } from './screens/Settings.js';
import { Highscores } from './screens/Highscores.js';
import { PauseOverlay } from './screens/PauseOverlay.js';
import { GameOver } from './screens/GameOver.js';
import { Hud } from './components/Hud.js';
import './styles/ui.css';

/** @typedef {'menu' | 'settings' | 'highscores' | 'login' | 'register'} MenuScreen */

export class UIManager {
  /**
   * @param {HTMLElement} root
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {{
   *   onQuitToMenu?: () => void,
   *   getScores?: (limit?: number) => Promise<unknown>,
   *   register?: (username: string, password: string) => Promise<{ success?: boolean, userId?: string | null }>,
   *   login?: (username: string, password: string) => Promise<{ token?: string | null, username?: string | null }>,
   *   onSession?: (session: { token: string | null, username: string | null }) => void,
   * }} [hooks]
   */
  constructor(root, bus, hooks = {}) {
    this.root = root;
    this.bus = bus;
    this.hooks = hooks;
    /** @type {MenuScreen} */
    this.activeScreen = 'menu';
    this.playing = false;
    this.paused = false;
    /** True while the GAME_OVER result panel is up. */
    this.showingGameOver = false;

    const router = {
      navigate: (screen) => this.navigate(screen),
      back: () => this.back(),
      quitToMenu: () => this.quitToMenu(),
      toMenu: () => this.dismissGameOver(),
    };

    const authFacade = {
      register: hooks.register,
      login: hooks.login,
      onSession: hooks.onSession,
      onAuthChange: () => this.screens.menu.refreshSession(),
    };

    this.screens = {
      menu: new MainMenu(bus, router, { onSession: hooks.onSession }),
      login: new Login(bus, router, authFacade),
      register: new Register(bus, router, authFacade),
      settings: new Settings(bus, router),
      highscores: new Highscores(bus, router, { getScores: hooks.getScores }),
      pause: new PauseOverlay(bus, router),
      gameOver: new GameOver(bus, router),
    };
    this.hud = new Hud();
  }

  mount() {
    this.root.replaceChildren();
    this.screens.menu.mount(this.root);
    this.screens.login.mount(this.root);
    this.screens.register.mount(this.root);
    this.screens.settings.mount(this.root);
    this.screens.highscores.mount(this.root);
    this.screens.pause.mount(this.root);
    this.screens.gameOver.mount(this.root);
    this.hud.mount(this.root);

    this.bus.on(Topics.GAME_START, () => {
      this.playing = true;
      this.paused = false;
      this.showingGameOver = false;
      this.activeScreen = 'menu';
      this.hud.setArmor(100, 100);
      this.hud.setPowerup('Power-up —');
      this.hud.setAmmo('Ammo —');
      this.hud.clearRadar();
      this._applyVisibility();
    });

    this.bus.on(Topics.GAME_PAUSE, (payload) => {
      this.paused = Boolean(payload?.isPaused);
      if (this.paused) {
        if (this.activeScreen === 'settings') this.activeScreen = 'menu';
      }
      this._applyVisibility();
    });

    this.bus.on(Topics.GAME_OVER, (payload) => {
      this.playing = false;
      this.paused = false;
      this.showingGameOver = true;
      this.activeScreen = 'menu';
      this.hud.clearRadar();
      this.screens.gameOver.show({
        winner: payload?.winner ?? '',
        score: payload?.score,
      });
      this._applyVisibility();
    });

    this.bus.on(Topics.TANK_DAMAGED, (payload) => {
      if (!payload || payload.entityId !== 'local') return;
      this.hud.setArmor(Number(payload.currentHp), Number(payload.maxHp) || 100);
    });

    this.bus.on(Topics.HUD_STATE, (payload) => {
      if (!this.playing) return;
      this.hud.applyHudState(payload);
    });

    this.bus.on(Topics.ITEM_COLLECTED, (payload) => {
      if (!payload || payload.entityId !== 'local') return;
      if (payload.type === 'REPAIR') {
        this.hud.setPowerup('Repair kit');
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.playing) return;
      if (this.activeScreen === 'settings') {
        this.back();
        return;
      }
      this.bus.emit(Topics.GAME_PAUSE, { isPaused: !this.paused });
    });

    this.navigate('menu');
  }

  /**
   * Show a menu screen without touching the canvas.
   * @param {string} screen
   */
  navigate(screen) {
    if (this.showingGameOver) return;
    const allowed = ['menu', 'settings', 'highscores', 'login', 'register'];
    if (!allowed.includes(screen)) return;
    if ((screen === 'highscores' || screen === 'login' || screen === 'register') && this.playing) {
      return;
    }
    this.activeScreen = /** @type {MenuScreen} */ (screen);
    this._applyVisibility();
  }

  /** Settings / nested back: menu when idle, pause overlay when in-match. */
  back() {
    if (this.showingGameOver) return;
    this.activeScreen = 'menu';
    this._applyVisibility();
  }

  /**
   * Pause → Main Menu ends the match via Logic (GAME_OVER).
   * Result panel is shown by the GAME_OVER subscriber — do not skip to loadout.
   */
  quitToMenu() {
    this.hooks.onQuitToMenu?.();
  }

  /** Close the result panel and return to the Deploy / loadout form. */
  dismissGameOver() {
    this.showingGameOver = false;
    this.activeScreen = 'menu';
    this.screens.gameOver.setVisible(false);
    this._applyVisibility();
  }

  _applyVisibility() {
    if (this.showingGameOver) {
      this.screens.menu.setVisible(false);
      this.screens.login.setVisible(false);
      this.screens.register.setVisible(false);
      this.screens.settings.setVisible(false);
      this.screens.highscores.setVisible(false);
      if (this.screens.pause.el) this.screens.pause.el.hidden = true;
      this.screens.gameOver.setVisible(true);
      if (this.hud.el) this.hud.el.hidden = true;
      return;
    }

    const inMenus = !this.playing;
    const showSettings = this.activeScreen === 'settings';
    const showHighscores = inMenus && this.activeScreen === 'highscores';
    const showLogin = inMenus && this.activeScreen === 'login';
    const showRegister = inMenus && this.activeScreen === 'register';
    const showMenu = inMenus && this.activeScreen === 'menu';

    this.screens.menu.setVisible(showMenu);
    this.screens.login.setVisible(showLogin);
    this.screens.register.setVisible(showRegister);
    this.screens.settings.setVisible(showSettings);
    this.screens.highscores.setVisible(showHighscores);
    this.screens.gameOver.setVisible(false);

    if (this.screens.pause.el) {
      this.screens.pause.el.hidden = !(this.playing && this.paused && !showSettings);
    }

    if (this.hud.el) {
      this.hud.el.hidden = !(this.playing && !this.paused && !showSettings);
    }
  }
}
