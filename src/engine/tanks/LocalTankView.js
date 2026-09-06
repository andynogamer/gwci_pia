/**
 * Agent-Engine — procedural local tank mesh. Pose is pushed from Logic.
 */
import * as THREE from 'three';

export class LocalTankView {
  /**
   * @param {{ name?: string, hull?: number, turret?: number, skirt?: number }} [palette]
   */
  constructor(palette = {}) {
    this.root = new THREE.Group();
    this.root.name = palette.name ?? 'local-tank';

    this._geoms = [];
    this._mats = [];

    const hullMat = this._mat(palette.hull ?? 0x3d6b3a);
    const darkMat = this._mat(palette.skirt ?? 0x2a3328);
    const turretMat = this._mat(palette.turret ?? 0x4a7c44);
    const barrelMat = this._mat(0x2c2c28);

    const hull = new THREE.Mesh(this._geo(new THREE.BoxGeometry(2.2, 0.7, 3.1)), hullMat);
    hull.position.y = 0.55;
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.root.add(hull);

    const skirtL = new THREE.Mesh(this._geo(new THREE.BoxGeometry(0.35, 0.45, 3.2)), darkMat);
    skirtL.position.set(-1.15, 0.35, 0);
    skirtL.castShadow = true;
    this.root.add(skirtL);
    const skirtR = skirtL.clone();
    skirtR.position.x = 1.15;
    this.root.add(skirtR);

    this.turretPivot = new THREE.Group();
    this.turretPivot.position.set(0, 0.95, -0.15);
    this.root.add(this.turretPivot);

    const turret = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.7, 0.85, 0.55, 10)), turretMat);
    turret.castShadow = false;
    this.turretPivot.add(turret);

    const barrel = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(0.12, 0.14, 1.7, 8)), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 1.15);
    barrel.castShadow = false;
    this.turretPivot.add(barrel);
  }

  /**
   * @param {{ x: number, y: number, z: number, rotY: number, turretRotY: number }} pose
   */
  setPose(pose) {
    this.root.position.set(pose.x, pose.y, pose.z);
    this.root.rotation.y = pose.rotY;
    this.turretPivot.rotation.y = pose.turretRotY - pose.rotY;
  }

  dispose() {
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
    for (const g of this._geoms) g.dispose();
    for (const m of this._mats) m.dispose();
    this._geoms.length = 0;
    this._mats.length = 0;
  }

  _geo(geometry) {
    this._geoms.push(geometry);
    return geometry;
  }

  _mat(color) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0.18,
    });
    this._mats.push(mat);
    return mat;
  }
}
