import * as THREE from 'three';
import { DoorModel, WindowModel, RoomModel } from '../../../types';
import { SPATIAL_THEME } from '../../../services/spatial/SpatialVisualTheme';

export class OpeningFactory {
  public static createDoorMesh(
    door: DoorModel,
    room: RoomModel,
    isSelected: boolean
  ): THREE.Group {
    const [rw, rl] = room.dimensions;
    const wallThick = 0.16;
    const doorGroup = new THREE.Group();
    doorGroup.name = door.id;

    const dw = door.width;
    const dh = door.height;

    // Marco de puerta
    const frameGeo = new THREE.BoxGeometry(dw + 0.06, dh + 0.03, wallThick + 0.04);
    const frameMat = new THREE.MeshStandardMaterial({
      color: isSelected ? SPATIAL_THEME.states.selected.outlineColor : '#e2e8f0',
      roughness: 0.5,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    doorGroup.add(frameMesh);

    // Hoja de puerta
    const leafGeo = new THREE.BoxGeometry(dw - 0.04, dh - 0.02, 0.04);
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.4,
    });
    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
    leafMesh.castShadow = true;
    doorGroup.add(leafMesh);

    // Manija / picaporte
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8);
    const handleMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.8,
      roughness: 0.2,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(dw * 0.35, 0, 0.03);
    doorGroup.add(handle);

    // Ubicar puerta según pared
    if (door.wall === 'norte') {
      doorGroup.position.set(door.position, dh / 2, -rl / 2 - wallThick / 2);
    } else if (door.wall === 'sur') {
      doorGroup.position.set(door.position, dh / 2, rl / 2 + wallThick / 2);
    } else if (door.wall === 'oeste') {
      doorGroup.rotation.y = Math.PI / 2;
      doorGroup.position.set(-rw / 2 - wallThick / 2, dh / 2, door.position);
    } else if (door.wall === 'este') {
      doorGroup.rotation.y = Math.PI / 2;
      doorGroup.position.set(rw / 2 + wallThick / 2, dh / 2, door.position);
    }

    // Resaltado de selección
    if (isSelected) {
      const highlightBox = new THREE.Mesh(
        new THREE.BoxGeometry(dw + 0.12, dh + 0.12, wallThick + 0.1),
        new THREE.MeshBasicMaterial({
          color: SPATIAL_THEME.states.selected.outlineColor,
          wireframe: true,
        })
      );
      doorGroup.add(highlightBox);
    }

    return doorGroup;
  }

  public static createWindowMesh(
    win: WindowModel,
    room: RoomModel,
    isSelected: boolean
  ): THREE.Group {
    const [rw, rl] = room.dimensions;
    const winGroup = new THREE.Group();
    winGroup.name = win.id;

    const ww = win.width;
    const wh = win.height;

    // Marco de ventana
    const frameGeo = new THREE.BoxGeometry(ww, wh, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({
      color: isSelected ? SPATIAL_THEME.states.selected.outlineColor : '#ffffff',
      roughness: 0.3,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    winGroup.add(frameMesh);

    // Cristal translúcido con transmisión
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(ww - 0.08, wh - 0.08, 0.02),
      new THREE.MeshPhysicalMaterial({
        color: '#bae6fd',
        transmission: 0.85,
        opacity: 0.55,
        transparent: true,
        roughness: 0.1,
        ior: 1.5,
      })
    );
    winGroup.add(glass);

    // Travesaños / Mullions
    const mulH = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.08, 0.03, 0.03), frameMat);
    const mulV = new THREE.Mesh(new THREE.BoxGeometry(0.03, wh - 0.08, 0.03), frameMat);
    winGroup.add(mulH);
    winGroup.add(mulV);

    // Posicionar en pared
    const winElevation = 1.6;
    if (win.wall === 'sur') {
      winGroup.position.set(win.position, winElevation, rl / 2 + 0.04);
    } else if (win.wall === 'norte') {
      winGroup.position.set(win.position, winElevation, -rl / 2 - 0.04);
    } else if (win.wall === 'oeste') {
      winGroup.rotation.y = Math.PI / 2;
      winGroup.position.set(-rw / 2 - 0.04, winElevation, win.position);
    } else if (win.wall === 'este') {
      winGroup.rotation.y = Math.PI / 2;
      winGroup.position.set(rw / 2 + 0.04, winElevation, win.position);
    }

    if (isSelected) {
      const highlightBox = new THREE.Mesh(
        new THREE.BoxGeometry(ww + 0.1, wh + 0.1, 0.16),
        new THREE.MeshBasicMaterial({
          color: SPATIAL_THEME.states.selected.outlineColor,
          wireframe: true,
        })
      );
      winGroup.add(highlightBox);
    }

    return winGroup;
  }
}
