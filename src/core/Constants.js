/**
 * Shared enums and EventBus topic names.
 * Keep in lockstep with CONTRACTS.md.
 */

export const Topics = Object.freeze({
  GAME_START: 'GAME_START',
  GAME_PAUSE: 'GAME_PAUSE',
  GAME_OVER: 'GAME_OVER',
  PLAYER_FIRE: 'PLAYER_FIRE',
  TANK_DAMAGED: 'TANK_DAMAGED',
  ITEM_COLLECTED: 'ITEM_COLLECTED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  CLIENT_STATE_UPDATE: 'CLIENT_STATE_UPDATE',
  HUD_STATE: 'HUD_STATE',
});

export const GameMode = Object.freeze({
  PVE: 'PVE',
  PVP: 'PVP',
});

export const Difficulty = Object.freeze({
  EASY: 'EASY',
  HARD: 'HARD',
});

export const MapId = Object.freeze({
  DESERT_DUNES: 1,
  INDUSTRIAL_COMPLEX: 2,
  LUNAR_STATION: 3,
});

export const ItemType = Object.freeze({
  SHIELD: 'SHIELD',
  TRIPLE: 'TRIPLE',
  REPAIR: 'REPAIR',
});

export const GameState = Object.freeze({
  BOOT: 'BOOT',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

/** REQ-DIFF — non-time-based AI parameters */
export const DifficultyConfig = Object.freeze({
  EASY: Object.freeze({
    fovDegrees: 60,
    reactionLatency: 1.2,
    fireRate: 0.4,
    predictTrajectory: false,
  }),
  HARD: Object.freeze({
    fovDegrees: 120,
    reactionLatency: 0.3,
    fireRate: 1.6,
    predictTrajectory: true,
  }),
});
