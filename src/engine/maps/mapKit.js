/**
 * Shared procedural helpers for REQ-MAPS arenas.
 * Visuals only — no collision registration (Logic / WI-008).
 */
import * as THREE from 'three';

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {{ x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number, cast?: boolean, receive?: boolean, name?: string }} [opts]
 */
export function makeMesh(geometry, material, opts = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  mesh.rotation.set(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0);
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  if (opts.name) mesh.name = opts.name;
  return mesh;
}

/**
 * @param {number} size
 * @param {THREE.Material} material
 */
export function makeGround(size, material) {
  const ground = makeMesh(
    new THREE.PlaneGeometry(size, size),
    material,
    { rx: -Math.PI / 2, cast: false, receive: true, name: 'ground' },
  );
  return ground;
}
