/**
 * Agent-UI — screen orchestration under #ui-root only.
 */
import { MainMenu } from './screens/MainMenu.js';
import { Settings } from './screens/Settings.js';
import { Highscores } from './screens/Highscores.js';
import { PauseOverlay } from './screens/PauseOverlay.js';
import { Hud } from './components/Hud.js';
import './styles/ui.css';

export class UIManager {
  /**
   * @param {HTMLElement} root
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(root, bus) {
    this.root = root;
    this.bus = bus;
    this.screens = {
      menu: new MainMenu(bus),
      settings: new Settings(bus),
      highscores: new Highscores(bus),
      pause: new PauseOverlay(bus),
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
  }
}
