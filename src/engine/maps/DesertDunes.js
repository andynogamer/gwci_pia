/**
 * REQ-MAPS map 1 — Desert Dunes (sand, stone ruins, warm light).
 * WI-031: ground covers walkable half ≥ 34.
 */
import * as THREE from 'three';
import { makeGround, makeMesh } from './mapKit.js';

/** Visual ground edge — keep ≥ 2 * Logic ARENA_HALF (34). */
const GROUND = 70;

export const DESERT_THEME = Object.freeze({
  background: 0xd4b896,
  fog: 0xc9a87a,
  fogNear: 36,
  fogFar: 110,
  ambient: 0xffe2b8,
  ambientIntensity: 0.62,
  spot: 0xfff0c8,
});

/**
 * @returns {THREE.Group}
 */
export function buildDesertDunes() {
  const root = new THREE.Group();
  root.name = 'map-desert-dunes';

  const sand = new THREE.MeshStandardMaterial({
    color: 0xc2a46b,
    roughness: 0.95,
    metalness: 0.02,
  });
  root.add(makeGround(GROUND, sand));

  const stone = new THREE.MeshStandardMaterial({
    color: 0x8a7a66,
    roughness: 0.88,
    metalness: 0.05,
  });
  const ruin = new THREE.MeshStandardMaterial({
    color: 0x6e6254,
    roughness: 0.9,
    metalness: 0.04,
  });

  const duneMat = sand.clone();
  duneMat.color.setHex(0xb89555);
  const duneSpecs = [
    { x: -12, z: -10, s: 5.5, y: 0.9 },
    { x: 14, z: -8, s: 4.2, y: 0.7 },
    { x: -8, z: 12, s: 6.0, y: 1.0 },
    { x: 10, z: 14, s: 3.8, y: 0.6 },
    { x: -26, z: -22, s: 5.0, y: 0.85 },
    { x: 28, z: 18, s: 4.5, y: 0.75 },
    { x: 18, z: -28, s: 4.8, y: 0.8 },
  ];
  for (const d of duneSpecs) {
    const dune = makeMesh(new THREE.SphereGeometry(d.s, 16, 10), duneMat, {
      x: d.x,
      y: d.y * 0.35,
      z: d.z,
      cast: true,
      receive: true,
    });
    dune.scale.set(1.4, 0.35, 1.1);
    root.add(dune);
  }

  const pillars = [
    [-6, 0, -4],
    [-3.5, 0, -4],
    [5, 0, -6],
    [8, 0, -5.5],
    [-10, 0, 5],
    [4, 0, 8],
    [-2, 0, 10],
    [-24, 0, -20],
    [22, 0, -24],
    [-28, 0, 8],
    [26, 0, 14],
    [-18, 0, 26],
    [20, 0, 28],
    [0, 0, -28],
  ];
  for (const [x, , z] of pillars) {
    const h = 2.2 + ((x + z) % 3) * 0.4;
    root.add(
      makeMesh(new THREE.CylinderGeometry(0.55, 0.7, h, 8), stone, {
        x,
        y: h / 2,
        z,
      }),
    );
  }

  root.add(
    makeMesh(new THREE.BoxGeometry(8, 2.2, 0.7), ruin, {
      x: -2,
      y: 1.1,
      z: -12,
      ry: 0.15,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(5, 1.6, 0.65), ruin, {
      x: 11,
      y: 0.8,
      z: 2,
      ry: -0.9,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(6, 1.8, 0.6), ruin, {
      x: -14,
      y: 0.9,
      z: -2,
      ry: 1.2,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(9, 2.0, 0.7), ruin, {
      x: -22,
      y: 1.0,
      z: 18,
      ry: 0.4,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(7, 2.1, 0.65), ruin, {
      x: 24,
      y: 1.05,
      z: -8,
      ry: -0.6,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(10, 1.9, 0.7), ruin, {
      x: 8,
      y: 0.95,
      z: 26,
      ry: 0.1,
    }),
  );

  root.add(
    makeMesh(new THREE.CylinderGeometry(0.45, 0.5, 5, 8), stone, {
      x: 2,
      y: 0.45,
      z: -2,
      rz: Math.PI / 2,
      ry: 0.4,
    }),
  );

  return root;
}
