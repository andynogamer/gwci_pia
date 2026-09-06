/**
 * REQ-MAPS map 3 — Lunar Station (craters, harsh directional light).
 * WI-031: ground covers walkable half ≥ 34; sun shadow frustum expanded.
 */
import * as THREE from 'three';
import { makeGround, makeMesh } from './mapKit.js';

const GROUND = 70;

export const LUNAR_THEME = Object.freeze({
  background: 0x020308,
  fog: null,
  fogNear: 0,
  fogFar: 0,
  ambient: 0x8899aa,
  ambientIntensity: 0.22,
  spot: 0xffffff,
});

/**
 * @returns {THREE.Group}
 */
export function buildLunarStation() {
  const root = new THREE.Group();
  root.name = 'map-lunar-station';

  const regolith = new THREE.MeshStandardMaterial({
    color: 0x8a8e96,
    roughness: 0.98,
    metalness: 0.05,
  });
  root.add(makeGround(GROUND, regolith));

  const rock = new THREE.MeshStandardMaterial({
    color: 0x6c7078,
    roughness: 0.92,
    metalness: 0.08,
  });
  const hull = new THREE.MeshStandardMaterial({
    color: 0xc8ccd4,
    roughness: 0.35,
    metalness: 0.65,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: 0x3a4555,
    roughness: 0.5,
    metalness: 0.55,
    emissive: 0x112233,
    emissiveIntensity: 0.4,
  });

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.name = 'lunar-sun';
  sun.position.set(-24, 36, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.bias = -0.0003;
  root.add(sun);
  root.add(sun.target);
  sun.target.position.set(0, 0, 0);

  const craterSpecs = [
    { x: -10, z: -8, r: 4.5 },
    { x: 12, z: -6, r: 3.2 },
    { x: -6, z: 11, r: 5.0 },
    { x: 8, z: 10, r: 2.8 },
    { x: 0, z: -14, r: 3.6 },
    { x: -24, z: 18, r: 4.0 },
    { x: 26, z: -20, r: 3.5 },
    { x: 16, z: 26, r: 3.8 },
  ];
  const craterMat = regolith.clone();
  craterMat.color.setHex(0x747880);
  for (const c of craterSpecs) {
    const bowl = makeMesh(new THREE.SphereGeometry(c.r, 20, 12), craterMat, {
      x: c.x,
      y: -c.r * 0.72,
      z: c.z,
      cast: false,
      receive: true,
    });
    bowl.scale.set(1, 0.28, 1);
    root.add(bowl);

    root.add(
      makeMesh(new THREE.TorusGeometry(c.r * 0.95, 0.35, 8, 24), rock, {
        x: c.x,
        y: 0.15,
        z: c.z,
        rx: Math.PI / 2,
        cast: true,
        receive: true,
      }),
    );
  }

  root.add(
    makeMesh(new THREE.CylinderGeometry(2.2, 2.2, 3.5, 16), hull, {
      x: -4,
      y: 1.75,
      z: 2,
      rx: Math.PI / 2,
    }),
  );
  root.add(
    makeMesh(new THREE.CylinderGeometry(1.8, 1.8, 4.2, 16), hull, {
      x: 5,
      y: 1.5,
      z: -3,
      rz: Math.PI / 2,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(3.5, 2.2, 3.5), panel, {
      x: 2,
      y: 1.1,
      z: 8,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(4.0, 2.8, 4.0), panel, {
      x: -26,
      y: 1.4,
      z: -14,
    }),
  );
  root.add(
    makeMesh(new THREE.CylinderGeometry(2.0, 2.0, 3.8, 14), hull, {
      x: 24,
      y: 1.3,
      z: 20,
      rx: Math.PI / 2,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(3.5, 2.4, 3.5), panel, {
      x: -18,
      y: 1.2,
      z: 26,
    }),
  );

  root.add(
    makeMesh(new THREE.BoxGeometry(6, 0.12, 2.2), panel, {
      x: 14,
      y: 2.4,
      z: 4,
      rx: -0.35,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), hull, {
      x: 14,
      y: 1.2,
      z: 4,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(5, 0.12, 2.0), panel, {
      x: -28,
      y: 2.2,
      z: 4,
      rx: -0.4,
    }),
  );
  root.add(
    makeMesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), hull, {
      x: -28,
      y: 1.1,
      z: 4,
    }),
  );

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
    root.add(
      makeMesh(new THREE.DodecahedronGeometry(0.7 + Math.abs(x % 3) * 0.15, 0), rock, {
        x,
        y,
        z,
      }),
    );
  }

  return root;
}
