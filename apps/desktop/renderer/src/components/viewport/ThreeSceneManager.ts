import * as THREE from 'three';
import { RoomModel, isPlacedSpatialObject } from '../../types';
import { SPATIAL_THEME, applyIdeThemeToSpatialTheme } from '../../services/spatial/SpatialVisualTheme';
import { CameraController } from './camera/CameraController';
import { RoomFactory, WallMeshRecord } from './factories/RoomFactory';
import { OpeningFactory } from './factories/OpeningFactory';
import { FurnitureFactory } from './factories/FurnitureFactory';
import { ObjectSelectionController } from './interaction/ObjectSelectionController';
import { ThreeResourceDisposer } from './resources/ThreeResourceDisposer';
import { calculateWallOcclusion } from './helpers/spatialMath';
import { IdeThemeDefinition, SpatialBackgroundMode } from '../../types/settings';
import { validateViewportScene } from './helpers/validateViewportScene';

export interface ThreeSceneManagerOptions {
  container: HTMLDivElement;
  onSelectEntity: (entityId: string | null) => void;
  activeTheme?: IdeThemeDefinition;
  spatialBackground?: SpatialBackgroundMode;
}

export class ThreeSceneManager {
  private container: HTMLDivElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private roomGroup: THREE.Group;

  private cameraController!: CameraController;
  private selectionController!: ObjectSelectionController;

  private animationFrameId: number | null = null;
  private disposed = false;
  private legacyPlacement = false;
  private resizeObserver: ResizeObserver | null = null;

  private isWireframe = false;
  private showDimensions = true;
  private showReferenceAxes = true;
  private lightingMode: 'day' | 'evening' | 'cyber' = 'day';
  private currentThemeDef: IdeThemeDefinition | null = null;
  private spatialSpaceMode: SpatialBackgroundMode = 'theme';

  private currentRoom: RoomModel | null = null;
  private activeEntityId: string | null = null;
  private debugActiveObjectId: string | null = null;
  private wallRecords: WallMeshRecord[] = [];
  private boundWindowResize = () => this.handleResize();

  constructor(options: ThreeSceneManagerOptions) {
    this.container = options.container;
    this.currentThemeDef = options.activeTheme || null;
    this.spatialSpaceMode = options.spatialBackground || 'theme';

    const width = Math.max(this.container.clientWidth, 100);
    const height = Math.max(this.container.clientHeight, 100);

    this.scene = new THREE.Scene();
    const initialBgColor = options.activeTheme?.spatialColors?.bg || SPATIAL_THEME.background.day;
    this.scene.background = new THREE.Color(initialBgColor);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    try {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(width, height, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;

      // Critical: Style canvas to always fill 100% of container seamlessly without blocking parent resizing
      this.renderer.domElement.style.display = 'block';
      this.renderer.domElement.style.position = 'absolute';
      this.renderer.domElement.style.top = '0';
      this.renderer.domElement.style.left = '0';
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.outline = 'none';

      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);

      this.cameraController = new CameraController({
        container: this.container,
        rendererDomElement: this.renderer.domElement,
      });

      this.setupLighting();

      const centerColor = options.activeTheme?.spatialColors?.gridCenter || SPATIAL_THEME.grid.center;
      const linesColor = options.activeTheme?.spatialColors?.gridLines || SPATIAL_THEME.grid.lines;
      const grid = new THREE.GridHelper(40, 40, new THREE.Color(centerColor), new THREE.Color(linesColor));
      grid.position.y = -0.05;
      grid.name = 'gridHelper';
      this.scene.add(grid);

      this.roomGroup = new THREE.Group();
      this.scene.add(this.roomGroup);

      this.selectionController = new ObjectSelectionController({
        domElement: this.renderer.domElement,
        scene: this.scene,
        getCamera: () => this.cameraController.getCamera(),
        onSelectEntity: options.onSelectEntity,
      });

      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
      window.addEventListener('resize', this.boundWindowResize);

      if (options.activeTheme) {
        this.applyTheme(options.activeTheme, options.spatialBackground);
      }

      this.startRenderLoop();
    } catch (error) {
      if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
      this.resizeObserver?.disconnect();
      window.removeEventListener('resize', this.boundWindowResize);
      this.selectionController?.dispose();
      this.cameraController?.dispose();
      ThreeResourceDisposer.disposeHierarchy(this.scene);
      this.renderer.dispose();
      this.renderer.domElement.remove();
      throw error;
    }
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight('#dbeafe', 0.85);
    ambientLight.name = 'ambientLight';
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.4);
    dirLight.position.set(14, 22, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 70;
    const shadowD = 12;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    dirLight.shadow.bias = -0.0005;
    dirLight.name = 'dirLight';
    this.scene.add(dirLight);

    const fillLight = new THREE.PointLight('#fef08a', 0.6, 20);
    fillLight.position.set(0, 4, 0);
    fillLight.name = 'fillLight';
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#22d3ee', 0.45);
    rimLight.position.set(-12, 10, -12);
    rimLight.name = 'rimLight';
    this.scene.add(rimLight);
  }

  public handleResize(): void {
    if (this.disposed || !this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    this.cameraController.handleResize(this.currentRoom);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
  }

  private startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      this.cameraController.update();

      this.updateDynamicWallOcclusion();

      this.renderer.render(this.scene, this.cameraController.getCamera());
    };
    animate();
  }

  private updateDynamicWallOcclusion(): void {
    if (this.wallRecords.length === 0) return;

    const occlusion = calculateWallOcclusion(this.cameraController.getCamera().position);

    for (const record of this.wallRecords) {
      let shouldFade = false;
      if (record.wall === 'sur' && occlusion.isSouthOccluding) shouldFade = true;
      else if (record.wall === 'norte' && occlusion.isNorthOccluding) shouldFade = true;
      else if (record.wall === 'este' && occlusion.isEastOccluding) shouldFade = true;
      else if (record.wall === 'oeste' && occlusion.isWestOccluding) shouldFade = true;

      const targetOpacity = shouldFade ? SPATIAL_THEME.walls.occludedOpacity : SPATIAL_THEME.walls.solidOpacity;

      for (const mat of record.materials) {
        if ('opacity' in mat) {
          (mat as THREE.MeshStandardMaterial).transparent = true;
          (mat as THREE.MeshStandardMaterial).opacity = targetOpacity;
          (mat as THREE.MeshStandardMaterial).depthWrite = !shouldFade;
        }
      }
    }
  }

  public setLegacyPlacement(enabled: boolean): void {
    this.legacyPlacement = enabled;
  }

  public renderRoom(
    room: RoomModel,
    activeEntityId: string | null,
    debugActiveObjectId: string | null = null
  ): void {
    if (this.disposed) return;
    const validationError = validateViewportScene({ version: '1.0.0', rooms: [room] }, this.legacyPlacement);
    if (validationError) throw new Error(`Escena no válida: ${validationError}`);
    this.activeEntityId = activeEntityId;
    this.debugActiveObjectId = debugActiveObjectId;
    this.selectionController.clearPickables();
    this.wallRecords = [];

    // Dispose previous room geometry & materials to prevent memory leaks
    while (this.roomGroup.children.length > 0) {
      const child = this.roomGroup.children[0];
      ThreeResourceDisposer.disposeHierarchy(child);
      this.roomGroup.remove(child);
    }

    const dimensionsChanged = !this.currentRoom ||
      this.currentRoom.dimensions[0] !== room.dimensions[0] ||
      this.currentRoom.dimensions[1] !== room.dimensions[1] ||
      this.currentRoom.dimensions[2] !== room.dimensions[2];

    const isNewRoom = !this.currentRoom || this.currentRoom.id !== room.id || dimensionsChanged;
    this.currentRoom = room;

    if (isNewRoom) {
      this.cameraController.adaptCameraToRoom(room);
    }

    const { group: roomRoot, wallRecords } = RoomFactory.createRoomStructure(room, {
      isWireframe: this.isWireframe,
      showReferenceAxes: this.showReferenceAxes,
      showDimensions: this.showDimensions,
    });
    this.wallRecords = wallRecords;

    room.doors.forEach((door) => {
      const isSelected = activeEntityId === door.id;
      const doorGroup = OpeningFactory.createDoorMesh(door, room, isSelected, this.isWireframe);
      this.selectionController.registerPickable(doorGroup, door.id);
      roomRoot.add(doorGroup);
    });

    room.windows.forEach((win) => {
      const isSelected = activeEntityId === win.id;
      const winGroup = OpeningFactory.createWindowMesh(win, room, isSelected, this.isWireframe);
      this.selectionController.registerPickable(winGroup, win.id);
      roomRoot.add(winGroup);
    });

    room.objects.filter(isPlacedSpatialObject).forEach((item) => {
      const isSelected = activeEntityId === item.id;
      const isDebugActive = debugActiveObjectId === item.id;
      const objGroup = FurnitureFactory.createFurnitureMesh(
        item,
        isSelected,
        this.isWireframe,
        isDebugActive
      );
      this.selectionController.registerPickable(objGroup, item.id);
      roomRoot.add(objGroup);
    });

    this.roomGroup.add(roomRoot);
  }

  public clearRoom(): void {
    ThreeResourceDisposer.disposeHierarchy(this.roomGroup);
    this.roomGroup.clear();
    this.selectionController.clearPickables();
    this.wallRecords = [];
    this.currentRoom = null;
  }

  public focusObject(position?: [number, number, number]): void {
    this.cameraController.focusObject(position, this.currentRoom);
  }

  public focusRoom(): void {
    this.cameraController.focusRoom(this.currentRoom);
  }

  public resetCamera(): void {
    this.cameraController.resetCamera(this.currentRoom);
  }

  public zoomCamera(delta: number): void {
    this.cameraController.zoomCamera(delta);
  }

  public setLighting(mode: 'day' | 'evening' | 'cyber'): void {
    this.lightingMode = mode;
    this.updateLightingColors();
  }

  public applyTheme(
    themeDef?: IdeThemeDefinition,
    spaceMode?: SpatialBackgroundMode,
    lighting?: 'day' | 'evening' | 'cyber'
  ): void {
    if (themeDef) {
      this.currentThemeDef = themeDef;
    }
    if (spaceMode) {
      this.spatialSpaceMode = spaceMode;
    }
    if (lighting) {
      this.lightingMode = lighting;
    }

    const theme = this.currentThemeDef;
    const mode = this.spatialSpaceMode;
    const isLight = theme?.category === 'light';

    let bgColorStr = theme?.spatialColors?.bg || (isLight ? '#f1f5f9' : '#02110c');
    if (mode === 'deep-dark') {
      bgColorStr = '#030712';
    } else if (mode === 'studio-light') {
      bgColorStr = '#f8fafc';
    } else if (mode === 'cyber') {
      bgColorStr = '#050510';
    }

    this.scene.background = new THREE.Color(bgColorStr);
    this.renderer.setClearColor(new THREE.Color(bgColorStr), 1.0);
    if (this.renderer.domElement) {
      this.renderer.domElement.style.backgroundColor = bgColorStr;
    }
    if (this.container) {
      this.container.style.backgroundColor = bgColorStr;
    }

    let gridCenterStr = theme?.spatialColors?.gridCenter || (isLight ? '#0969da' : '#f3ebd6');
    let gridLinesStr = theme?.spatialColors?.gridLines || (isLight ? '#cbd5e1' : '#1a422f');

    if (mode === 'studio-light') {
      gridCenterStr = '#0969da';
      gridLinesStr = '#cbd5e1';
    } else if (mode === 'cyber') {
      gridCenterStr = '#a855f7';
      gridLinesStr = '#1e1b4b';
    } else if (mode === 'deep-dark') {
      gridCenterStr = theme?.previewColors?.accent || '#38bdf8';
      gridLinesStr = '#1e293b';
    }

    const existingGrid = this.scene.getObjectByName('gridHelper');
    if (existingGrid) {
      this.scene.remove(existingGrid);
      ThreeResourceDisposer.disposeHierarchy(existingGrid);
    }

    const newGrid = new THREE.GridHelper(40, 40, new THREE.Color(gridCenterStr), new THREE.Color(gridLinesStr));
    newGrid.position.y = -0.05;
    newGrid.name = 'gridHelper';
    this.scene.add(newGrid);

    const accentColor = theme?.previewColors?.accent || (isLight ? '#0969da' : '#007acc');
    applyIdeThemeToSpatialTheme(accentColor, bgColorStr, gridCenterStr, gridLinesStr, isLight);

    this.updateLightingColors();

    if (this.currentRoom) {
      this.renderRoom(this.currentRoom, this.activeEntityId, this.debugActiveObjectId);
    }
  }

  private updateLightingColors(): void {
    const ambient = this.scene.getObjectByName('ambientLight') as THREE.AmbientLight;
    const dir = this.scene.getObjectByName('dirLight') as THREE.DirectionalLight;
    const fill = this.scene.getObjectByName('fillLight') as THREE.PointLight;
    const rim = this.scene.getObjectByName('rimLight') as THREE.DirectionalLight;

    if (!ambient || !dir || !fill) return;

    const isLight = this.currentThemeDef?.category === 'light' || this.spatialSpaceMode === 'studio-light';
    const accentColor = this.currentThemeDef?.previewColors?.accent || '#007acc';

    if (this.lightingMode === 'evening') {
      ambient.color.set('#fed7aa');
      ambient.intensity = 0.65;
      dir.color.set('#fb923c');
      dir.intensity = 1.25;
      fill.color.set('#f59e0b');
      fill.intensity = 0.8;
      if (rim) {
        rim.color.set('#ea580c');
        rim.intensity = 0.4;
      }
    } else if (this.lightingMode === 'cyber') {
      ambient.color.set('#38bdf8');
      ambient.intensity = 0.75;
      dir.color.set('#c084fc');
      dir.intensity = 1.3;
      fill.color.set('#22d3ee');
      fill.intensity = 0.9;
      if (rim) {
        rim.color.set('#f43f5e');
        rim.intensity = 0.5;
      }
    } else if (isLight) {
      ambient.color.set('#cbd5e1');
      ambient.intensity = 0.85;
      dir.color.set('#ffffff');
      dir.intensity = 1.35;
      fill.color.set('#f1f5f9');
      fill.intensity = 0.5;
      if (rim) {
        rim.color.set(accentColor);
        rim.intensity = 0.35;
      }
    } else {
      ambient.color.set('#dbeafe');
      ambient.intensity = 0.85;
      dir.color.set('#ffffff');
      dir.intensity = 1.4;
      fill.color.set('#fef08a');
      fill.intensity = 0.55;
      if (rim) {
        rim.color.set(accentColor);
        rim.intensity = 0.45;
      }
    }
  }

  public toggleDimensions(show: boolean): void {
    this.showDimensions = show;
  }

  public toggleWireframe(wireframe: boolean): void {
    this.isWireframe = wireframe;
  }

  public toggleAxes(show: boolean): void {
    this.showReferenceAxes = show;
  }

  public captureSnapshot(): string | null {
    if (this.disposed || !this.renderer) return null;
    return this.renderer.domElement.toDataURL('image/png');
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.boundWindowResize);

    this.selectionController.dispose();
    this.cameraController.dispose();

    ThreeResourceDisposer.disposeHierarchy(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.clear();
    this.wallRecords = [];
  }
}
