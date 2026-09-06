/**
 * REQ-MAPS map 2 — Industrial Complex (metal obstacles, nocturnal lighting).
 * WI-031: ground covers walkable half ≥ 34; fence follows perimeter.
 */
import * as THREE from 'three';
import { makeGround, makeMesh } from './mapKit.js';

const GROUND = 70;
const FENCE = 34;

export const INDUSTRIAL_THEME = Object.freeze({
  background: 0x07090e,
  fog: 0x0c1018,
  fogNear: 32,
  fogFar: 100,
  ambient: 0x6a7a98,
  ambientIntensity: 0.42,
  spot: 0xb8d4ff,
});

/**
 * @returns {THREE.Group}
 */
export function buildIndustrialComplex() {
  const root = new THREE.Group();
  root.name = 'map-industrial-complex';

  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x1a1e26,
    roughness: 0.85,
    metalness: 0.25,
  });
  root.add(makeGround(GROUND, asphalt));

  const metal = new THREE.MeshStandardMaterial({
    color: 0x5c6674,
    roughness: 0.45,
    metalness: 0.75,
  });
  const rust = new THREE.MeshStandardMaterial({
    color: 0x6a4030,
    roughness: 0.7,
    metalness: 0.4,
  });
  const neon = new THREE.MeshStandardMaterial({
    color: 0x1a3040,
    emissive: 0x2ec4b6,
    emissiveIntensity: 0.85,
    roughness: 0.4,
    metalness: 0.3,
  });

  const containers = [
    { x: -8, z: -6, w: 6, h: 2.4, d: 2.6, ry: 0 },
    { x: -8, z: -2.8, w: 6, h: 2.4, d: 2.6, ry: 0 },
    { x: 7, z: -8, w: 7, h: 2.6, d: 2.8, ry: Math.PI / 2 },
    { x: 10, z: 4, w: 6, h: 2.4, d: 2.6, ry: 0.2 },
    { x: -12, z: 8, w: 5.5, h: 2.2, d: 2.5, ry: -0.3 },
    { x: 0, z: 12, w: 8, h: 2.5, d: 2.6, ry: 0 },
    { x: -26, z: -18, w: 7, h: 2.5, d: 2.7, ry: 0.15 },
    { x: 24, z: -22, w: 6.5, h: 2.4, d: 2.6, ry: Math.PI / 2 },
    { x: -22, z: 24, w: 8, h: 2.5, d: 2.6, ry: -0.2 },
    { x: 26, z: 16, w: 6, h: 2.3, d: 2.5, ry: 0.4 },
    { x: 0, z: -28, w: 10, h: 2.4, d: 2.6, ry: 0 },
    { x: 28, z: 0, w: 2.6, h: 2.5, d: 8, ry: 0 },
  ];
  for (const c of containers) {
    root.add(
      makeMesh(new THREE.BoxGeometry(c.w, c.h, c.d), metal, {
        x: c.x,
        y: c.h / 2,
        z: c.z,
        ry: c.ry,
      }),
    );
  }

  root.add(
    makeMesh(new THREE.BoxGeometry(3, 2, 3), rust, {
      x: 3,
      y: 1,
      z: -1,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(2.6, 1.8, 2.6), rust, {
      x: 3,
      y: 2.9,
      z: -1,
    }),
  );

  root.add(
    makeMesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 10), metal, {
      x: -2,
      y: 3.2,
      z: 2,
      rz: Math.PI / 2,
      ry: 0.5,
    }),
  );
  root.add(
    makeMesh(new THREE.CylinderGeometry(0.28, 0.28, 10, 10), metal, {
      x: 6,
      y: 2.6,
      z: 6,
      rx: Math.PI / 2,
    }),
  );
  root.add(
    makeMesh(new THREE.CylinderGeometry(0.3, 0.3, 18, 10), metal, {
      x: -18,
      y: 3.0,
      z: -10,
      rz: Math.PI / 2,
      ry: -0.3,
    }),
  );

  root.add(
    makeMesh(new THREE.BoxGeometry(10, 0.12, 0.35), neon, {
      x: -4,
      y: 0.08,
      z: 2,
      cast: false,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(0.35, 0.12, 8), neon, {
      x: 2,
      y: 0.08,
      z: -4,
      cast: false,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(16, 0.12, 0.35), neon, {
      x: 8,
      y: 0.08,
      z: -18,
      cast: false,
    }),
  );

  const postGeo = new THREE.BoxGeometry(0.25, 2.8, 0.25);
  for (let i = -FENCE; i <= FENCE; i += 6) {
    root.add(
      makeMesh(postGeo, metal, {
        x: i,
        y: 1.4,
        z: -FENCE,
        cast: false,
      }),
    );
    root.add(
      makeMesh(postGeo, metal, {
        x: i,
        y: 1.4,
        z: FENCE,
        cast: false,
      }),
    );
    root.add(
      makeMesh(postGeo, metal, {
        x: -FENCE,
        y: 1.4,
        z: i,
        cast: false,
      }),
    );
    root.add(
      makeMesh(postGeo, metal, {
        x: FENCE,
        y: 1.4,
        z: i,
        cast: false,
      }),
    );
  }

  return root;
}
