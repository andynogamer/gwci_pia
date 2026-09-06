/**
 * Agent-Engine — scene graph ownership and map load/unload + dispose.
 */
import * as THREE from 'three';
import { DualLights } from './lights/DualLights.js';
import { getMapEntry } from './maps/MapRegistry.js';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e141c);

    /** @type {1 | 2 | 3 | null} */
    this.mapId = null;

    /** @type {THREE.Object3D[]} */
    this._owned = [];

    /** @type {DualLights | null} */
    this.lights = null;

    /** @type {THREE.Group | null} */
    this._mapRoot = null;
  }

  /**
   * Boot visuals before a match map is chosen (menu backdrop).
   */
  preparePlaceholder() {
    this.unloadMap();
    this._ensureLights();
    this._applyTheme({
      background: 0x0e141c,
      fog: null,
      ambient: 0x9eb6cc,
      ambientIntensity: 0.4,
      spot: 0xfff0d0,
    });

    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a3848,
      roughness: 0.92,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this._owned.push(ground);

    const grid = new THREE.GridHelper(40, 20, 0x4a6280, 0x2a3848);
    grid.position.y = 0.01;
    this.scene.add(grid);
    this._owned.push(grid);

    const markerGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xe0a23a,
      roughness: 0.55,
      metalness: 0.15,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(0, 0.7, 0);
    marker.castShadow = true;
    marker.receiveShadow = true;
    this.scene.add(marker);
    this._owned.push(marker);
  }

  _ensureLights() {
    if (!this.lights) {
      this.lights = new DualLights();
    }
    this.lights.addToScene(this.scene);
  }

  /**
   * @param {{ background: number, fog: number | null, fogNear?: number, fogFar?: number, ambient: number, ambientIntensity: number, spot: number }} theme
   */
  _applyTheme(theme) {
    this.scene.background = new THREE.Color(theme.background);
    if (theme.fog != null) {
      this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear ?? 25, theme.fogFar ?? 70);
    } else {
      this.scene.fog = null;
    }
    if (this.lights) {
      this.lights.ambient.color.setHex(theme.ambient);
      this.lights.ambient.intensity = theme.ambientIntensity;
      this.lights.spot.color.setHex(theme.spot);
    }
  }

  /**
   * Load arena by GAME_START.mapId (1|2|3). Disposes previous map first.
   * @param {1 | 2 | 3} mapId
   */
  loadMap(mapId) {
    const entry = getMapEntry(mapId);
    if (!entry) return;

    this.unloadMap();
    this.mapId = mapId;
    this._ensureLights();
    this._applyTheme(entry.theme);

    const root = entry.build();
    this.scene.add(root);
    this._mapRoot = root;
    this._owned.push(root);

    this.lights?.setMountPose(0, 0, -6, 0);
  }

  /** Remove current map / placeholder meshes and dispose GPU resources. */
  unloadMap() {
    for (const obj of this._owned) {
      this.scene.remove(obj);
      this._disposeTree(obj);
    }
    this._owned.length = 0;
    this._mapRoot = null;
    this.mapId = null;
  }

  /**
   * @param {number} _dt seconds
   */
  update(_dt) {
    // Map meshes are static; particle/FX updates live elsewhere.
  }

  /**
   * Full teardown of scene resources (map unload / GAME_OVER).
   */
  dispose() {
    this.unloadMap();

    if (this.lights) {
      this.lights.dispose();
      this.lights = null;
    }

    this.scene.fog = null;
    this.scene.background = null;

    const leftover = [...this.scene.children];
    for (const child of leftover) {
      this.scene.remove(child);
      this._disposeTree(child);
    }
  }

  /**
   * @param {THREE.Object3D} root
   */
  _disposeTree(root) {
    /** @type {Set<THREE.BufferGeometry>} */
    const geometries = new Set();
    /** @type {Set<THREE.Material>} */
    const materials = new Set();
    /** @type {THREE.Light[]} */
    const lights = [];

    root.traverse((obj) => {
      if (obj.isLight) {
        lights.push(obj);
      }
      if (obj.geometry) {
        geometries.add(obj.geometry);
      }
      if (obj.material) {
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of list) {
          materials.add(mat);
        }
      }
    });

    for (const light of lights) {
      light.dispose?.();
    }
    for (const geo of geometries) {
      geo.dispose();
    }
    for (const mat of materials) {
      for (const key of Object.keys(mat)) {
        const value = mat[key];
        if (value && typeof value === 'object' && value.isTexture) {
          value.dispose();
        }
      }
      mat.dispose();
    }
  }
}
