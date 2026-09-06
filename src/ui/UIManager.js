/**
 * Agent-UI — screen orchestration under #ui-root only.
 * REQ-UI / WI-002: Main Menu, Settings, Highscores, Pause + navigation.
 */
import { Topics } from '../core/Constants.js';
import { MainMenu } from './screens/MainMenu.js';
import { Settings } from './screens/Settings.js';
import { Highscores } from './screens/Highscores.js';
import { PauseOverlay } from './screens/PauseOverlay.js';
import { Hud } from './components/Hud.js';
import './styles/ui.css';

/** @typedef {'menu' | 'settings' | 'highscores'} MenuScreen */

export class UIManager {
  /**
   * @param {HTMLElement} root
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {{ onQuitToMenu?: () => void }} [hooks]
   */
  constructor(root, bus, hooks = {}) {
    this.root = root;
    this.bus = bus;
    this.hooks = hooks;
    /** @type {MenuScreen} */
    this.activeScreen = 'menu';
    this.playing = false;
    this.paused = false;

    const router = {
      navigate: (screen) => this.navigate(screen),
      back: () => this.back(),
      quitToMenu: () => this.quitToMenu(),
    };

    this.screens = {
      menu: new MainMenu(bus, router),
      settings: new Settings(bus, router),
      highscores: new Highscores(bus, router),
      pause: new PauseOverlay(bus, router),
    };
    this.hud = new Hud();
  }

  mount() {
    this.root.replaceChildren();
    this.screens.menu.mount(this.root);
    this.screens.settings.mount(this.root);
    this.screens.highscores.mount(this.root);
    this.screens.pause.mount(this.root);
    this.hud.mount(this.root);

    this.bus.on(Topics.GAME_START, () => {
      this.playing = true;
      this.paused = false;
      this.activeScreen = 'menu';
      this._applyVisibility();
    });

    this.bus.on(Topics.GAME_PAUSE, (payload) => {
      this.paused = Boolean(payload?.isPaused);
      if (this.paused) {
        // Closing nested settings when pause engages.
        if (this.activeScreen === 'settings') this.activeScreen = 'menu';
      }
      this._applyVisibility();
    });

    this.bus.on(Topics.GAME_OVER, () => {
      this.playing = false;
      this.paused = false;
      this.activeScreen = 'menu';
      this._applyVisibility();
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
    if (screen !== 'menu' && screen !== 'settings' && screen !== 'highscores') return;
    if (screen === 'highscores' && this.playing) return;
    this.activeScreen = screen;
    this._applyVisibility();
  }

  /** Settings / nested back: menu when idle, pause overlay when in-match. */
  back() {
    this.activeScreen = 'menu';
    this._applyVisibility();
  }

  quitToMenu() {
    this.hooks.onQuitToMenu?.();
    this.playing = false;
    this.paused = false;
    this.activeScreen = 'menu';
    this._applyVisibility();
  }

  _applyVisibility() {
    const inMenus = !this.playing;
    const showSettings = this.activeScreen === 'settings';
    const showHighscores = inMenus && this.activeScreen === 'highscores';
    const showMenu = inMenus && this.activeScreen === 'menu';

    this.screens.menu.setVisible(showMenu);
    this.screens.settings.setVisible(showSettings);
    this.screens.highscores.setVisible(showHighscores);

    if (this.screens.pause.el) {
      this.screens.pause.el.hidden = !(this.playing && this.paused && !showSettings);
    }

    if (this.hud.el) {
      this.hud.el.hidden = !(this.playing && !this.paused && !showSettings);
    }
  }
}
