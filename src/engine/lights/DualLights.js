/**
 * Agent-Engine — REQ-COL-LIGHT dual illumination.
 * AmbientLight + SpotLight (tank headlights, shadow casting).
 */
import * as THREE from 'three';

export function createDualLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  const focal = new THREE.SpotLight(0xffffff, 2, 40, Math.PI / 6, 0.3, 1);
  focal.castShadow = true;
  return { ambient, focal };
}
