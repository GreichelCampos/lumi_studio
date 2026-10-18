import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomModel } from '../../../types';
import {
  calculateRoomCenter,
  calculateDynamicViewSpan,
  calculateCameraDistance,
} from '../helpers/spatialMath';

export interface CameraControllerOptions {
  container: HTMLDivElement;
  rendererDomElement: HTMLCanvasElement;
}

export class CameraController {
  private camera: THREE.OrthographicCamera;
  private controls: OrbitControls;
  private container: HTMLDivElement;
  private viewSpan = 4.0;
  private targetLookAt = new THREE.Vector3(0, 0.8, 0);
  private currentRoom: RoomModel | null = null;

  constructor(options: CameraControllerOptions) {
    this.container = options.container;
    const width = Math.max(this.container.clientWidth, 100);
    const height = Math.max(this.container.clientHeight, 100);
    const aspect = width / height;

    this.camera = new THREE.OrthographicCamera(
      -this.viewSpan * aspect,
      this.viewSpan * aspect,
      this.viewSpan,
      -this.viewSpan,
      0.1,
      1000
    );
    this.camera.position.set(16, 18, 16);
    this.camera.lookAt(0, 0.8, 0);

    this.controls = new OrbitControls(this.camera, options.rendererDomElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.02; // Prevent going beneath floor
    this.controls.minDistance = 3;
    this.controls.maxDistance = 120;
    this.controls.minZoom = 0.4;
    this.controls.maxZoom = 3.5;
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.9;
    this.controls.rotateSpeed = 0.75;
    this.controls.target.set(0, 0.8, 0);
  }

  public getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  public getControls(): OrbitControls {
    return this.controls;
  }

  public update(): void {
    this.controls.update();
  }

  public handleResize(room?: RoomModel | null): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    const aspect = w / h;
    const activeRoom = room !== undefined ? room : this.currentRoom;
    if (activeRoom) {
      this.viewSpan = this.fittedSpan(activeRoom, aspect);
    }

    this.camera.left = -this.viewSpan * aspect;
    this.camera.right = this.viewSpan * aspect;
    this.camera.top = this.viewSpan;
    this.camera.bottom = -this.viewSpan;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  public adaptCameraToRoom(room: RoomModel): void {
    this.currentRoom = room;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w > 0 && h > 0 ? w / h : 1.0;

    this.viewSpan = calculateDynamicViewSpan(room, aspect);

    this.camera.left = -this.viewSpan * aspect;
    this.camera.right = this.viewSpan * aspect;
    this.camera.top = this.viewSpan;
    this.camera.bottom = -this.viewSpan;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();

    this.targetLookAt = calculateRoomCenter(room);
    this.controls.target.copy(this.targetLookAt);

    const camDist = calculateCameraDistance(room);
    this.camera.far = Math.max(1000, camDist * 6);
    this.controls.maxDistance = Math.max(120, camDist * 4);
    this.camera.position.set(camDist, camDist * 1.05, camDist);
    this.controls.update();
    this.handleResize(room);
  }

  private fittedSpan(room: RoomModel, aspect: number): number {
    this.camera.updateMatrixWorld();
    const [width, length, height] = room.dimensions;
    let span = 0;
    for (const x of [-width / 2 - 0.3, width / 2 + 0.3]) {
      for (const y of [-0.1, height + 0.1]) {
        for (const z of [-length / 2 - 0.3, length / 2 + 0.3]) {
          const point = new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
          span = Math.max(span, Math.abs(point.x) / aspect, Math.abs(point.y));
        }
      }
    }
    return Math.max(span * 1.08, 0.1);
  }

  public focusObject(position?: [number, number, number], currentRoom?: RoomModel | null): void {
    if (position) {
      this.controls.target.set(position[0], Math.max(0.4, position[1] + 0.4), position[2]);
    } else if (currentRoom) {
      this.controls.target.set(0, currentRoom.dimensions[2] * 0.35, 0);
    } else {
      this.controls.target.set(0, 0.8, 0);
    }
    this.controls.update();
  }

  public focusRoom(currentRoom: RoomModel | null): void {
    if (currentRoom) {
      this.adaptCameraToRoom(currentRoom);
    } else {
      this.resetCamera(null);
    }
  }

  public resetCamera(currentRoom: RoomModel | null): void {
    if (currentRoom) {
      this.adaptCameraToRoom(currentRoom);
    } else {
      this.camera.position.set(16, 18, 16);
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
      this.controls.target.set(0, 0.8, 0);
      this.controls.update();
    }
  }

  public zoomCamera(delta: number): void {
    if (!Number.isFinite(delta)) return;
    this.camera.zoom = Math.max(0.4, Math.min(3.5, this.camera.zoom + delta));
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.controls.dispose();
  }
}
