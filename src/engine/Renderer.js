/**
 * Agent-Engine — WebGLRenderer mount. No DOM besides the canvas element.
 */
import * as THREE from 'three';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
  }

  mount() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
  }

  dispose() {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
