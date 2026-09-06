/**
 * Agent-Logic — AABB volumes for REQ-MAPS arenas (plain numbers, no meshes).
 * Envelopes for rotated boxes so CollisionManager can use THREE.Box3 only.
 * WI-031: walkable half-extent ≥ 34 (was 22).
 */

function envelope(x, y, z, w, h, d, ry = 0) {
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  const hx = (w / 2) * c + (d / 2) * s;
  const hz = (w / 2) * s + (d / 2) * c;
  const hy = h / 2;
  return {
    min: [x - hx, y - hy, z - hz],
    max: [x + hx, y + hy, z + hz],
  };
}

/** Walkable arena half-extent (XZ). Must stay in sync with Engine ground size. */
export const ARENA_HALF = 34;

function arenaBounds() {
  return {
    min: [-ARENA_HALF, -1, -ARENA_HALF],
    max: [ARENA_HALF, 8, ARENA_HALF],
  };
}

function desertObstacles() {
  const obstacles = [];
  const pillars = [
    [-6, -4],
    [-3.5, -4],
    [5, -6],
    [8, -5.5],
    [-10, 5],
    [4, 8],
    [-2, 10],
    // Outer ring (WI-031)
    [-24, -20],
    [22, -24],
    [-28, 8],
    [26, 14],
    [-18, 26],
    [20, 28],
    [0, -28],
  ];
  for (const [x, z] of pillars) {
    const h = 2.2 + ((x + z) % 3) * 0.4;
    obstacles.push(envelope(x, h / 2, z, 1.3, h, 1.3));
  }
  obstacles.push(envelope(-2, 1.1, -12, 8, 2.2, 0.7, 0.15));
  obstacles.push(envelope(11, 0.8, 2, 5, 1.6, 0.65, -0.9));
  obstacles.push(envelope(-14, 0.9, -2, 6, 1.8, 0.6, 1.2));
  obstacles.push(envelope(2, 0.45, -2, 5, 0.9, 1.1, 0.4));
  // Outer ruin walls
  obstacles.push(envelope(-22, 1.0, 18, 9, 2.0, 0.7, 0.4));
  obstacles.push(envelope(24, 1.05, -8, 7, 2.1, 0.65, -0.6));
  obstacles.push(envelope(8, 0.95, 26, 10, 1.9, 0.7, 0.1));
  return obstacles;
}

function industrialObstacles() {
  const obstacles = [];
  const containers = [
    { x: -8, z: -6, w: 6, h: 2.4, d: 2.6, ry: 0 },
    { x: -8, z: -2.8, w: 6, h: 2.4, d: 2.6, ry: 0 },
    { x: 7, z: -8, w: 7, h: 2.6, d: 2.8, ry: Math.PI / 2 },
    { x: 10, z: 4, w: 6, h: 2.4, d: 2.6, ry: 0.2 },
    { x: -12, z: 8, w: 5.5, h: 2.2, d: 2.5, ry: -0.3 },
    { x: 0, z: 12, w: 8, h: 2.5, d: 2.6, ry: 0 },
    // Outer corridors
    { x: -26, z: -18, w: 7, h: 2.5, d: 2.7, ry: 0.15 },
    { x: 24, z: -22, w: 6.5, h: 2.4, d: 2.6, ry: Math.PI / 2 },
    { x: -22, z: 24, w: 8, h: 2.5, d: 2.6, ry: -0.2 },
    { x: 26, z: 16, w: 6, h: 2.3, d: 2.5, ry: 0.4 },
    { x: 0, z: -28, w: 10, h: 2.4, d: 2.6, ry: 0 },
    { x: 28, z: 0, w: 2.6, h: 2.5, d: 8, ry: 0 },
  ];
  for (const c of containers) {
    obstacles.push(envelope(c.x, c.h / 2, c.z, c.w, c.h, c.d, c.ry));
  }
  obstacles.push(envelope(3, 1, -1, 3, 2, 3));
  obstacles.push(envelope(3, 2.9, -1, 2.6, 1.8, 2.6));
  return obstacles;
}

function lunarObstacles() {
  const obstacles = [];
  obstacles.push(envelope(-4, 1.75, 2, 3.5, 4.4, 3.5));
  obstacles.push(envelope(5, 1.5, -3, 4.2, 3.6, 3.6));
  obstacles.push(envelope(2, 1.1, 8, 3.5, 2.2, 3.5));
  // Outer habitat / crates
  obstacles.push(envelope(-26, 1.4, -14, 4.0, 2.8, 4.0));
  obstacles.push(envelope(24, 1.3, 20, 3.8, 2.6, 3.8));
  obstacles.push(envelope(-18, 1.2, 26, 3.5, 2.4, 3.5));
  const rocks = [
    [-14, 0.4, 4],
    [10, 0.5, -12],
    [-3, 0.35, -8],
    [16, 0.45, -2],
    [-16, 0.5, -10],
    [-28, 0.45, 6],
    [28, 0.5, -16],
    [12, 0.4, 28],
    [-8, 0.45, -28],
    [22, 0.5, 8],
  ];
  for (const [x, y, z] of rocks) {
    obstacles.push(envelope(x, y, z, 1.6, 1.2, 1.6));
  }
  return obstacles;
}

const BY_MAP = {
  1: {
    spawn: [0, 8],
    // Far south — WI-023 Recruit grace / approach distance.
    enemies: [
      [26, -28, 0],
      [-26, -28, 0],
    ],
    // WI-029 / WI-035 — opposite duel pads (≥ 18 apart), clear of obstacles.
    pvpPads: [
      [-24, 0],
      [24, 0],
    ],
    bounds: arenaBounds(),
    obstacles: desertObstacles(),
    items: [
      { type: 'SHIELD', x: 22, z: 10 },
      { type: 'TRIPLE', x: -22, z: 10 },
      { type: 'REPAIR', x: 0, z: -24 },
    ],
  },
  2: {
    spawn: [0, 8],
    enemies: [
      [28, -24, 0],
      [-28, 4, Math.PI / 2],
    ],
    pvpPads: [
      [-24, 0],
      [24, 0],
    ],
    bounds: arenaBounds(),
    obstacles: industrialObstacles(),
    items: [
      { type: 'SHIELD', x: -6, z: 6 },
      { type: 'TRIPLE', x: 22, z: -4 },
      { type: 'REPAIR', x: 8, z: 22 },
    ],
  },
  3: {
    spawn: [0, 24],
    enemies: [
      [26, 10, 0],
      [-26, 10, 0],
    ],
    pvpPads: [
      [-24, 0],
      [24, 0],
    ],
    bounds: arenaBounds(),
    obstacles: lunarObstacles(),
    items: [
      { type: 'SHIELD', x: 18, z: 22 },
      { type: 'TRIPLE', x: -18, z: 22 },
      { type: 'REPAIR', x: 0, z: -12 },
    ],
  },
};

/**
 * @param {1 | 2 | 3} mapId
 */
export function getMapVolumes(mapId) {
  return BY_MAP[mapId] ?? BY_MAP[1];
}

/**
 * @param {1 | 2 | 3} mapId
 * @returns {[[number, number], [number, number]]}
 */
export function getPvpPads(mapId) {
  const pads = (BY_MAP[mapId] ?? BY_MAP[1]).pvpPads;
  return [
    [pads[0][0], pads[0][1]],
    [pads[1][0], pads[1][1]],
  ];
}
