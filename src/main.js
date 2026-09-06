/**
 * Composition root — wiring only.
 * Feature logic belongs in agent folders (see AGENTS.md).
 */
import { eventBus } from './core/EventBus.js';
import { Renderer } from './engine/Renderer.js';
import { SceneManager } from './engine/SceneManager.js';
import { CameraManager } from './engine/CameraManager.js';
import { GameManager } from './logic/GameManager.js';
import { UIManager } from './ui/UIManager.js';
import { NetworkClient } from './network/NetworkClient.js';
import { ApiClient } from './network/ApiClient.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const sceneManager = new SceneManager();
const cameraManager = new CameraManager();
const renderer = new Renderer(canvas, eventBus, { sceneManager, cameraManager });
const api = new ApiClient();
const net = new NetworkClient(eventBus, { api });
const game = new GameManager(eventBus, {
  sceneManager,
  cameraManager,
  getLocalPlayerId: () => net.playerId,
});
const ui = new UIManager(uiRoot, eventBus, {
  onQuitToMenu: () => game.endMatch({ winner: '', score: 0 }),
  getScores: (limit) => api.getScores(limit),
  register: (username, password) => api.register(username, password),
  login: (username, password) => api.login(username, password),
  onSession: ({ token }) => {
    api.setToken(token);
    net.setToken(token);
  },
});

renderer.mount();
renderer.start();
game.boot();
ui.mount();
net.bind();
bindLocalTankInput(game);

/** DEV: `window.__mtaEngine.cameraManager.setMode('FOLLOW'|'ISOMETRIC')` */
if (import.meta.env.DEV) {
  window.__mtaEngine = {
    renderer,
    sceneManager,
    cameraManager,
    eventBus,
    get lights() { return sceneManager.lights; },
    get particles() { return sceneManager.particles; },
    get shieldFx() { return sceneManager.shieldFx; },
    getGpuStats: () => renderer.getGpuStats(),
  };
  window.__mtaLogic = { game };
  window.__mtaNet = { net, api };
}

/**
 * WASD hull, arrow keys turret, Space fire.
 * @param {GameManager} gameManager
 */
function bindLocalTankInput(gameManager) {
  const keys = new Set();

  const syncChassis = () => {
    const throttle = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
    const steer = (keys.has('KeyA') ? 1 : 0) + (keys.has('KeyD') ? -1 : 0);
    gameManager.setChassisInput(throttle, steer);
  };

  const syncTurret = () => {
    const turretSteer =
      (keys.has('ArrowLeft') ? 1 : 0) + (keys.has('ArrowRight') ? -1 : 0);
    gameManager.setTurretInput(turretSteer);
  };

  const isTurretKey = (code) => code === 'ArrowLeft' || code === 'ArrowRight';
  const isHullKey = (code) =>
    code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD';

  window.addEventListener('keydown', (e) => {
    if (isTurretKey(e.code)) {
      e.preventDefault();
      keys.add(e.code);
      syncTurret();
      return;
    }
    if (isHullKey(e.code)) {
      keys.add(e.code);
      syncChassis();
    }
    if (e.code === 'Space') {
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) {
        return;
      }
      e.preventDefault();
      gameManager.tryFire();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (isTurretKey(e.code)) {
      keys.delete(e.code);
      syncTurret();
      return;
    }
    if (isHullKey(e.code)) {
      keys.delete(e.code);
      syncChassis();
    }
  });
  window.addEventListener('blur', () => {
    keys.clear();
    syncChassis();
    syncTurret();
  });
}
