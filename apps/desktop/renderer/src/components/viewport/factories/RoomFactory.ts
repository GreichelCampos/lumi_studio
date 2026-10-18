import * as THREE from 'three';
import { RoomModel } from '../../../types';
import { SPATIAL_THEME } from '../../../services/spatial/SpatialVisualTheme';

import { WALL_THICKNESS, wallSegments } from '../helpers/openingLayout';
import { surfaceColor, surfaceMaterial } from '../helpers/surfaceMaterial';

export interface WallMeshRecord {
  wall: 'norte' | 'sur' | 'este' | 'oeste';
  materials: THREE.Material[];
}

export interface RoomFactoryOptions {
  isWireframe: boolean;
  showReferenceAxes: boolean;
  showDimensions: boolean;
}

export class RoomFactory {
  public static createRoomStructure(
    room: RoomModel,
    options: RoomFactoryOptions
  ): { group: THREE.Group; wallRecords: WallMeshRecord[] } {
    const roomRoot = new THREE.Group();
    roomRoot.name = `room-${room.id}`;
    const wallRecords: WallMeshRecord[] = [];

    const [rw, rl, rh] = room.dimensions; // Ancho (X), Largo (Z), Altura (Y)
    const wallThick = WALL_THICKNESS;

    // 1. PISO (Centrado en [0, -0.04, 0])
    const floorGeo = new THREE.BoxGeometry(rw, 0.08, rl);
    const isWood =
      room.floor.material.toLowerCase().includes('madera') ||
      room.floor.material.toLowerCase().includes('parquet') ||
      room.floor.material.toLowerCase().includes('nogal');

    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const ctx = floorCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);

      if (isWood) {
        ctx.fillStyle = '#ededed';
        for (let i = 0; i < 512; i += 32) {
          ctx.fillRect(i, 0, 30, 512);
        }
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 512; i += 32) {
          ctx.strokeRect(i, 0, 32, 512);
        }
      } else {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        for (let i = 0; i < 512; i += 64) {
          for (let j = 0; j < 512; j += 64) {
            ctx.strokeRect(i, j, 64, 64);
          }
        }
      }
    }

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(rw / 1.5, rl / 1.5);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture, color: surfaceColor(room.floor.color, isWood ? '#92400e' : '#e2e8f0'),
      ...surfaceMaterial(room.floor.material),
      wireframe: options.isWireframe,
    });

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.name = 'floor';
    floorMesh.position.set(0, -0.04, 0);
    floorMesh.receiveShadow = true;
    roomRoot.add(floorMesh);

    const baseboard = new THREE.Mesh(
      new THREE.BoxGeometry(rw + 0.06, 0.04, rl + 0.06),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    baseboard.position.set(0, -0.08, 0);
    roomRoot.add(baseboard);

    // 2. EJES DE REFERENCIA X & Z EN EL PISO ([0, 0, 0])
    if (options.showReferenceAxes) {
      // Eje X (Rojo / Ancho)
      const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-rw / 2, 0.005, 0),
        new THREE.Vector3(rw / 2, 0.005, 0),
      ]);
      const xAxisMat = new THREE.LineBasicMaterial({ color: SPATIAL_THEME.axes.x, linewidth: 2 });
      const xAxisLine = new THREE.Line(xAxisGeo, xAxisMat);
      roomRoot.add(xAxisLine);

      // Eje Z (Verde / Largo)
      const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.005, -rl / 2),
        new THREE.Vector3(0, 0.005, rl / 2),
      ]);
      const zAxisMat = new THREE.LineBasicMaterial({ color: SPATIAL_THEME.axes.z, linewidth: 2 });
      const zAxisLine = new THREE.Line(zAxisGeo, zAxisMat);
      roomRoot.add(zAxisLine);

      // Marcador central en el origen [0, 0, 0]
      const originDisc = new THREE.Mesh(
        new THREE.RingGeometry(0.04, 0.12, 16),
        new THREE.MeshBasicMaterial({ color: SPATIAL_THEME.axes.origin, side: THREE.DoubleSide })
      );
      originDisc.rotation.x = Math.PI / 2;
      originDisc.position.set(0, 0.008, 0);
      roomRoot.add(originDisc);
    }

    const faces = { norte: room.walls.north, sur: room.walls.south, este: room.walls.east, oeste: room.walls.west };
    for (const wall of ['norte', 'sur', 'este', 'oeste'] as const) {
      const face = faces[wall];
      const material = new THREE.MeshStandardMaterial({
        color: surfaceColor(face.color, '#f1f5f9'), ...surfaceMaterial(face.material),
        wireframe: options.isWireframe, transparent: true, opacity: SPATIAL_THEME.walls.solidOpacity,
      });
      wallRecords.push({ wall, materials: [material] });
      for (const segment of wallSegments(room, wall)) {
        const width = segment.right - segment.left;
        const height = segment.top - segment.bottom;
        const along = (segment.left + segment.right) / 2;
        const vertical = (segment.bottom + segment.top) / 2;
        const horizontal = wall === 'norte' || wall === 'sur';
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(
          horizontal ? width : wallThick, height, horizontal ? wallThick : width,
        ), material);
        mesh.name = `wall-${wall}`;
        mesh.position.set(
          horizontal ? along : (wall === 'este' ? 1 : -1) * (rw / 2 + wallThick / 2),
          vertical,
          horizontal ? (wall === 'sur' ? 1 : -1) * (rl / 2 + wallThick / 2) : along,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        roomRoot.add(mesh);
      }
    }

    // 4. COTAS MÉTRICAS Y DIMENSIONES
    if (options.showDimensions) {
      const widthLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-rw / 2, 0.05, rl / 2 + 0.25),
        new THREE.Vector3(rw / 2, 0.05, rl / 2 + 0.25),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: SPATIAL_THEME.dimensions.line });
      roomRoot.add(new THREE.Line(widthLineGeo, lineMat));

      const lengthLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(rw / 2 + 0.25, 0.05, -rl / 2),
        new THREE.Vector3(rw / 2 + 0.25, 0.05, rl / 2),
      ]);
      roomRoot.add(new THREE.Line(lengthLineGeo, lineMat));
    }

    return { group: roomRoot, wallRecords };
  }
}
