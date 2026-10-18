import * as THREE from 'three';

/**
 * Utility responsible for systematically releasing GPU memory (geometries, materials, textures)
 */
export class ThreeResourceDisposer {
  public static disposeHierarchy(obj: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points || child instanceof THREE.Sprite) {
        if ('geometry' in child) geometries.add(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
      }
      if (child instanceof THREE.DirectionalLight || child instanceof THREE.SpotLight || child instanceof THREE.PointLight) child.shadow.dispose();
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => this.disposeMaterial(material, textures));
  }

  public static disposeMaterial(mat: THREE.Material, textures = new Set<THREE.Texture>()): void {
    mat.dispose();
    const matObj = mat as unknown as Record<string, unknown>;
    for (const key of Object.keys(matObj)) {
      const val = matObj[key];
      if (val instanceof THREE.Texture && !textures.has(val)) {
        textures.add(val);
        val.dispose();
      }
    }
  }
}
