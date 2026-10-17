import * as THREE from 'three';

export interface ObjectSelectionControllerOptions {
  domElement: HTMLCanvasElement;
  scene: THREE.Scene;
  getCamera: () => THREE.OrthographicCamera;
  onSelectEntity: (entityId: string | null) => void;
}

export class ObjectSelectionController {
  private domElement: HTMLCanvasElement;
  private scene: THREE.Scene;
  private getCamera: () => THREE.OrthographicCamera;
  private onSelectEntity: (entityId: string | null) => void;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private pickableMeshes = new Map<THREE.Object3D, string>();

  private pointerDownHandler: ((e: PointerEvent) => void) | null = null;
  private pointerUpHandler: ((e: PointerEvent) => void) | null = null;
  private pointerCancelHandler: (() => void) | null = null;

  constructor(options: ObjectSelectionControllerOptions) {
    this.domElement = options.domElement;
    this.scene = options.scene;
    this.getCamera = options.getCamera;
    this.onSelectEntity = options.onSelectEntity;

    this.setupListeners();
  }

  public registerPickable(mesh: THREE.Object3D, entityId: string): void {
    this.pickableMeshes.set(mesh, entityId);
  }

  public clearPickables(): void {
    this.pickableMeshes.clear();
  }

  private setupListeners(): void {
    let pointerDownPos: { x: number; y: number; id: number } | null = null;

    this.pointerDownHandler = (e: PointerEvent) => {
      pointerDownPos = e.button === 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
    };
    this.domElement.addEventListener('pointerdown', this.pointerDownHandler);
    this.pointerCancelHandler = () => { pointerDownPos = null; };
    this.domElement.addEventListener('pointercancel', this.pointerCancelHandler);

    this.pointerUpHandler = (e: PointerEvent) => {
      const down = pointerDownPos;
      pointerDownPos = null;
      if (!down || down.id !== e.pointerId || e.button !== 0) return;
      // Ignore drags / orbit movements
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (dist > 5) return;

      const rect = this.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const camera = this.getCamera();
      this.scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      this.raycaster.setFromCamera(this.mouse, camera);

      const pickableObjects = Array.from(this.pickableMeshes.keys());
      const intersects = this.raycaster.intersectObjects(pickableObjects, true);

      if (intersects.length > 0) {
        let clickedEntityId: string | null = null;
        for (const hit of intersects) {
          if (hit.object.userData.ignorePicking) continue;
          let curr: THREE.Object3D | null = hit.object;
          while (curr && curr !== this.scene) {
            if (this.pickableMeshes.has(curr)) {
              clickedEntityId = this.pickableMeshes.get(curr) || null;
              break;
            }
            curr = curr.parent;
          }
          if (clickedEntityId) break;
        }

        if (clickedEntityId) {
          this.onSelectEntity(clickedEntityId);
          return;
        }
      }

      this.onSelectEntity(null);
    };
    this.domElement.addEventListener('pointerup', this.pointerUpHandler);
  }

  public dispose(): void {
    if (this.pointerCancelHandler) {
      this.domElement.removeEventListener('pointercancel', this.pointerCancelHandler);
      this.pointerCancelHandler = null;
    }
    if (this.pointerDownHandler) {
      this.domElement.removeEventListener('pointerdown', this.pointerDownHandler);
      this.pointerDownHandler = null;
    }
    if (this.pointerUpHandler) {
      this.domElement.removeEventListener('pointerup', this.pointerUpHandler);
      this.pointerUpHandler = null;
    }
    this.pickableMeshes.clear();
  }
}
