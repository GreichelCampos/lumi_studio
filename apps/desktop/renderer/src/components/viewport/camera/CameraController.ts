import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomModel, isPlacedSpatialObject } from '../../../types';
import { calculateSceneBounds, calculateObjectBounds, calculateVisualScale, calculateProjectedSpan } from '../helpers/sceneScale';

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

    const aspect = w > 0 && h > 0 ? w / h : 1;
    const bounds = calculateSceneBounds(room);
    const scale = calculateVisualScale(bounds);
    this.viewSpan = scale.radius;

    this.camera.left = -this.viewSpan * aspect;
    this.camera.right = this.viewSpan * aspect;
    this.camera.top = this.viewSpan;
    this.camera.bottom = -this.viewSpan;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();

    this.targetLookAt = bounds.getCenter(new THREE.Vector3());
    this.controls.target.copy(this.targetLookAt);

    const camDist = scale.distance;
    this.camera.near = scale.near;
    this.camera.far = scale.far;
    this.controls.minDistance = scale.near * 2;
    this.controls.maxDistance = scale.far;
    this.camera.position.copy(this.targetLookAt).add(new THREE.Vector3(1, 1.05, 1).normalize().multiplyScalar(camDist));
    this.camera.lookAt(this.targetLookAt);
    this.controls.update();
    this.viewSpan = this.fittedSpan(room, aspect);
    this.camera.left = -this.viewSpan * aspect;
    this.camera.right = this.viewSpan * aspect;
    this.camera.top = this.viewSpan;
    this.camera.bottom = -this.viewSpan;
    this.camera.updateProjectionMatrix();
    this.handleResize(room);
  }

  private fittedSpan(room: RoomModel, aspect: number): number {
    this.camera.updateMatrixWorld();
    return calculateProjectedSpan(calculateSceneBounds(room), this.camera.matrixWorldInverse, aspect);
  }

  public updateRoom(room: RoomModel): void {
    const changed = !this.currentRoom || !calculateSceneBounds(this.currentRoom).equals(calculateSceneBounds(room));
    this.currentRoom = room;
    if (changed) this.adaptCameraToRoom(room);
  }

  public focusObject(
    position?: [number, number, number],
    currentRoom: RoomModel | null = this.currentRoom,
    objectId?: string | null
  ): void {
    if (!position) {
      this.focusRoom(currentRoom);
      return;
    }
    const item = currentRoom?.objects.filter(isPlacedSpatialObject).find(candidate =>
      objectId ? candidate.id === objectId : candidate.position.every((value, axis) => value === position[axis])
    );
    const bounds = item ? calculateObjectBounds(item) : new THREE.Box3().setFromPoints([new THREE.Vector3(...position)]);
    const sceneScale = calculateVisualScale(currentRoom ? calculateSceneBounds(currentRoom) : bounds);
    const objectScale = item ? calculateVisualScale(bounds) : sceneScale;

    // Finish pending orbit/pan damping before an explicit focus, so later frames
    // cannot move the object out of the fitted view. Keep the user's viewing angle.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    const direction = this.camera.position.clone().sub(this.controls.target);
    if (direction.lengthSq() === 0) direction.set(1, 1.05, 1);
    direction.normalize();
    const distance = Math.max(objectScale.distance, sceneScale.radius * 0.25);
    this.controls.target.copy(bounds.getCenter(new THREE.Vector3()));
    this.camera.position.copy(this.controls.target).addScaledVector(direction, distance);
    this.camera.near = Math.min(sceneScale.near, objectScale.near);
    this.camera.far = Math.max(sceneScale.far, distance + objectScale.radius * 2);
    this.controls.minDistance = this.camera.near * 2;
    this.controls.maxDistance = this.camera.far;
    this.camera.zoom = 1;
    this.controls.update();
    this.controls.enableDamping = damping;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w > 0 && h > 0 ? w / h : 1;
    this.camera.updateMatrixWorld();
    this.viewSpan = item
      ? calculateProjectedSpan(bounds, this.camera.matrixWorldInverse, aspect)
      : sceneScale.radius;
    this.camera.left = -this.viewSpan * aspect;
    this.camera.right = this.viewSpan * aspect;
    this.camera.top = this.viewSpan;
    this.camera.bottom = -this.viewSpan;
    this.camera.updateProjectionMatrix();
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
