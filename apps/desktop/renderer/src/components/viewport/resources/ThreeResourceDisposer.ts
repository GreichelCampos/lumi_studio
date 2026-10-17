import * as THREE from 'three';

/**
 * Utility responsible for systematically releasing GPU memory (geometries, materials, textures)
 */
export class ThreeResourceDisposer {
  public static disposeHierarchy(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => this.disposeMaterial(m));
          } else {
            this.disposeMaterial(mesh.material);
          }
        }
      }
    });
  }

  public static disposeMaterial(mat: THREE.Material): void {
    mat.dispose();
    const matObj = mat as unknown as Record<string, unknown>;
    for (const key of Object.keys(matObj)) {
      const val = matObj[key];
      if (val && typeof (val as { dispose?: () => void }).dispose === 'function') {
        (val as { dispose: () => void }).dispose();
      }
    }
  }
}
