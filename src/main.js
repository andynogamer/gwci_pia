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
const game = new GameManager(eventBus);
const ui = new UIManager(uiRoot, eventBus);
const api = new ApiClient();
const net = new NetworkClient(eventBus);

ui.mount();
renderer.mount();
renderer.start();
game.boot();
net.bind();

void api;

/** DEV: `window.__mtaEngine.cameraManager.setMode('FOLLOW'|'ISOMETRIC')` */
if (import.meta.env.DEV) {
  window.__mtaEngine = { renderer, sceneManager, cameraManager, eventBus, get lights() { return sceneManager.lights; } };
}
