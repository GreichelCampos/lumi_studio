import * as THREE from 'three';
import { RoomModel } from '../../../types';
import { SPATIAL_THEME, resolveLumiColor } from '../../../services/spatial/SpatialVisualTheme';

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
    const wallThick = 0.16;

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
      ctx.fillStyle = isWood ? '#92400e' : '#e2e8f0';
      ctx.fillRect(0, 0, 512, 512);

      if (isWood) {
        ctx.fillStyle = '#78350f';
        for (let i = 0; i < 512; i += 32) {
          ctx.fillRect(i, 0, 30, 512);
        }
        ctx.strokeStyle = '#451a03';
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
      map: floorTexture,
      roughness: isWood ? 0.35 : 0.2,
      metalness: 0.08,
      wireframe: options.isWireframe,
    });

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.04, 0);
    floorMesh.receiveShadow = true;
    roomRoot.add(floorMesh);

    // Zócalo base inferior
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

    // 3. PAREDES DE LA HABITACIÓN (Norte, Sur, Este, Oeste)
    const northColor = resolveLumiColor(room.walls.north.color, '#f8fafc');
    const southColor = resolveLumiColor(room.walls.south.color, '#f1f5f9');
    const eastColor = resolveLumiColor(room.walls.east.color, '#e2e8f0');
    const westColor = resolveLumiColor(room.walls.west.color, '#f1f5f9');

    // 3.1 Pared Norte (en Z = -rl/2)
    const northMat = new THREE.MeshStandardMaterial({
      color: northColor,
      roughness: 0.85,
      wireframe: options.isWireframe,
      transparent: true,
      opacity: SPATIAL_THEME.walls.solidOpacity,
    });
    wallRecords.push({ wall: 'norte', materials: [northMat] });

    const northDoor = room.doors.find((d) => d.wall === 'norte');
    if (!northDoor) {
      const northWall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, wallThick), northMat);
      northWall.position.set(0, rh / 2, -rl / 2 - wallThick / 2);
      northWall.castShadow = true;
      northWall.receiveShadow = true;
      roomRoot.add(northWall);
    } else {
      const dw = northDoor.width;
      const dh = northDoor.height;
      const dpos = northDoor.position;

      const leftW = Math.max(0.05, dpos - dw / 2 - -rw / 2);
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(leftW, rh, wallThick), northMat);
      leftWall.position.set(-rw / 2 + leftW / 2, rh / 2, -rl / 2 - wallThick / 2);
      leftWall.castShadow = true;
      roomRoot.add(leftWall);

      const rightW = Math.max(0.05, rw / 2 - (dpos + dw / 2));
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(rightW, rh, wallThick), northMat);
      rightWall.position.set(rw / 2 - rightW / 2, rh / 2, -rl / 2 - wallThick / 2);
      rightWall.castShadow = true;
      roomRoot.add(rightWall);

      const topH = Math.max(0.05, rh - dh);
      const topWall = new THREE.Mesh(new THREE.BoxGeometry(dw, topH, wallThick), northMat);
      topWall.position.set(dpos, dh + topH / 2, -rl / 2 - wallThick / 2);
      topWall.castShadow = true;
      roomRoot.add(topWall);
    }

    // 3.2 Pared Oeste (en X = -rw/2)
    const westMat = new THREE.MeshStandardMaterial({
      color: westColor,
      roughness: 0.85,
      wireframe: options.isWireframe,
      transparent: true,
      opacity: SPATIAL_THEME.walls.solidOpacity,
    });
    wallRecords.push({ wall: 'oeste', materials: [westMat] });

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, rh, rl), westMat);
    westWall.position.set(-rw / 2 - wallThick / 2, rh / 2, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    roomRoot.add(westWall);

    // 3.3 Pared Sur (en Z = +rl/2)
    const southMat = new THREE.MeshStandardMaterial({
      color: southColor,
      roughness: 0.85,
      wireframe: options.isWireframe,
      transparent: true,
      opacity: SPATIAL_THEME.walls.solidOpacity,
    });
    wallRecords.push({ wall: 'sur', materials: [southMat] });

    const southDoor = room.doors.find((d) => d.wall === 'sur');
    if (!southDoor) {
      const southWall = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, wallThick), southMat);
      southWall.position.set(0, rh / 2, rl / 2 + wallThick / 2);
      southWall.castShadow = true;
      southWall.receiveShadow = true;
      roomRoot.add(southWall);
    } else {
      const dw = southDoor.width;
      const dh = southDoor.height;
      const dpos = southDoor.position;

      const leftW = Math.max(0.05, dpos - dw / 2 - -rw / 2);
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(leftW, rh, wallThick), southMat);
      leftWall.position.set(-rw / 2 + leftW / 2, rh / 2, rl / 2 + wallThick / 2);
      roomRoot.add(leftWall);

      const rightW = Math.max(0.05, rw / 2 - (dpos + dw / 2));
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(rightW, rh, wallThick), southMat);
      rightWall.position.set(rw / 2 - rightW / 2, rh / 2, rl / 2 + wallThick / 2);
      roomRoot.add(rightWall);

      const topH = Math.max(0.05, rh - dh);
      const topWall = new THREE.Mesh(new THREE.BoxGeometry(dw, topH, wallThick), southMat);
      topWall.position.set(dpos, dh + topH / 2, rl / 2 + wallThick / 2);
      roomRoot.add(topWall);
    }

    // 3.4 Pared Este (en X = +rw/2)
    const eastMat = new THREE.MeshStandardMaterial({
      color: eastColor,
      roughness: 0.85,
      wireframe: options.isWireframe,
      transparent: true,
      opacity: SPATIAL_THEME.walls.solidOpacity,
    });
    wallRecords.push({ wall: 'este', materials: [eastMat] });

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, rh, rl), eastMat);
    eastWall.position.set(rw / 2 + wallThick / 2, rh / 2, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    roomRoot.add(eastWall);

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
