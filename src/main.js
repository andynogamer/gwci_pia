/**
 * Composition root — wiring only.
 * Feature logic belongs in agent folders (see AGENTS.md).
 */
import { eventBus } from './core/EventBus.js';
import { Renderer } from './engine/Renderer.js';
import { GameManager } from './logic/GameManager.js';
import { UIManager } from './ui/UIManager.js';
import { NetworkClient } from './network/NetworkClient.js';
import { ApiClient } from './network/ApiClient.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const renderer = new Renderer(canvas);
const game = new GameManager(eventBus);
const ui = new UIManager(uiRoot, eventBus);
const api = new ApiClient();
const net = new NetworkClient(eventBus);

ui.mount();
renderer.mount();
game.boot();
net.bind();

void api;
