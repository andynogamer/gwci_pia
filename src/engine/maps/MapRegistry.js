/**
 * Agent-Engine — REQ-MAPS map registry.
 * 1 Desert Dunes | 2 Industrial Complex | 3 Lunar Station
 */
import { buildDesertDunes, DESERT_THEME } from './DesertDunes.js';
import { buildIndustrialComplex, INDUSTRIAL_THEME } from './IndustrialComplex.js';
import { buildLunarStation, LUNAR_THEME } from './LunarStation.js';

export const MAP_REGISTRY = Object.freeze({
  1: {
    id: 1,
    name: 'Desert Dunes',
    build: buildDesertDunes,
    theme: DESERT_THEME,
  },
  2: {
    id: 2,
    name: 'Industrial Complex',
    build: buildIndustrialComplex,
    theme: INDUSTRIAL_THEME,
  },
  3: {
    id: 3,
    name: 'Lunar Station',
    build: buildLunarStation,
    theme: LUNAR_THEME,
  },
});

/**
 * @param {1 | 2 | 3} mapId
 */
export function getMapEntry(mapId) {
  return MAP_REGISTRY[mapId] ?? null;
}
