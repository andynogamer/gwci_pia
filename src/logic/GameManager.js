/**
 * Agent-Logic — core state machine (Boot, Menu, Playing, Paused, GameOver).
 */
import { GameState, Topics } from '../core/Constants.js';

export class GameManager {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.state = GameState.BOOT;
    this.clock = null;
  }

  boot() {
    this.state = GameState.MENU;
    this.bus.on(Topics.GAME_START, (payload) => this.start(payload));
    this.bus.on(Topics.GAME_PAUSE, (payload) => this.pause(payload));
  }

  start(_payload) {
    this.state = GameState.PLAYING;
  }

  pause(payload) {
    this.state = payload?.isPaused ? GameState.PAUSED : GameState.PLAYING;
  }
}
