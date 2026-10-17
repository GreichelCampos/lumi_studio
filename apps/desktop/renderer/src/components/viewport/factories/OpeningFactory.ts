import * as THREE from 'three';
import { DoorModel, WindowModel, RoomModel } from '../../../types';
import { SPATIAL_THEME } from '../../../services/spatial/SpatialVisualTheme';
import { openingPlacement, WALL_THICKNESS, WINDOW_CENTER_HEIGHT } from '../helpers/openingLayout';

export class OpeningFactory {
  public static createDoorMesh(
    door: DoorModel,
    room: RoomModel,
    isSelected: boolean,
    isWireframe = false
  ): THREE.Group {
    const wallThick = WALL_THICKNESS;
    const doorGroup = new THREE.Group();
    doorGroup.name = door.id;

    const dw = door.width;
    const dh = door.height;

    const frameMat = new THREE.MeshStandardMaterial({
      color: isSelected ? SPATIAL_THEME.states.selected.outlineColor : '#e2e8f0',
      roughness: 0.5,
      wireframe: isWireframe,
    });
    const border = Math.min(0.03, dw / 6, dh / 6);
    for (const x of [-dw / 2, dw / 2]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(border, dh, wallThick + 0.04), frameMat);
      jamb.position.x = x;
      doorGroup.add(jamb);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(dw + border, border, wallThick + 0.04), frameMat);
    header.position.y = dh / 2;
    doorGroup.add(header);

    const leafGeo = new THREE.BoxGeometry(dw - border, dh - border, 0.04);
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.4,
      wireframe: isWireframe,
    });
    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
    leafMesh.castShadow = true;
    doorGroup.add(leafMesh);

    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8);
    const handleMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      metalness: 0.8,
      roughness: 0.2,
      wireframe: isWireframe,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(dw * 0.35, 0, 0.03);
    doorGroup.add(handle);

    const placement = openingPlacement(door, room, dh / 2);
    doorGroup.position.set(...placement.position);
    doorGroup.rotation.y = placement.rotationY;

    if (isSelected) {
      const highlightBox = new THREE.Mesh(
        new THREE.BoxGeometry(dw + 0.12, dh + 0.12, wallThick + 0.1),
        new THREE.MeshBasicMaterial({
          color: SPATIAL_THEME.states.selected.outlineColor,
          wireframe: true,
        })
      );
      highlightBox.userData.ignorePicking = true;
      doorGroup.add(highlightBox);
    }

    return doorGroup;
  }

  public static createWindowMesh(
    win: WindowModel,
    room: RoomModel,
    isSelected: boolean,
    isWireframe = false
  ): THREE.Group {
    const winGroup = new THREE.Group();
    winGroup.name = win.id;

    const ww = win.width;
    const wh = win.height;

    const frameMat = new THREE.MeshStandardMaterial({
      color: isSelected ? SPATIAL_THEME.states.selected.outlineColor : '#ffffff',
      roughness: 0.3,
      wireframe: isWireframe,
    });
    const border = Math.min(0.04, ww / 6, wh / 6);
    for (const x of [-ww / 2 + border / 2, ww / 2 - border / 2]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(border, wh, WALL_THICKNESS + 0.04), frameMat);
      jamb.position.x = x;
      winGroup.add(jamb);
    }
    for (const y of [-wh / 2 + border / 2, wh / 2 - border / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ww - border * 2, border, WALL_THICKNESS + 0.04), frameMat);
      rail.position.y = y;
      winGroup.add(rail);
    }

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(ww - border * 2, wh - border * 2, 0.02),
      new THREE.MeshPhysicalMaterial({
        color: '#bae6fd',
        transmission: 0.85,
        opacity: 0.55,
        transparent: true,
        roughness: 0.1,
        ior: 1.5,
        wireframe: isWireframe,
      })
    );
    winGroup.add(glass);

    const mulH = new THREE.Mesh(new THREE.BoxGeometry(ww - border * 2, border / 2, 0.03), frameMat);
    const mulV = new THREE.Mesh(new THREE.BoxGeometry(border / 2, wh - border * 2, 0.03), frameMat);
    winGroup.add(mulH);
    winGroup.add(mulV);

    const placement = openingPlacement(win, room, WINDOW_CENTER_HEIGHT);
    winGroup.position.set(...placement.position);
    winGroup.rotation.y = placement.rotationY;

    if (isSelected) {
      const highlightBox = new THREE.Mesh(
        new THREE.BoxGeometry(ww + 0.1, wh + 0.1, 0.16),
        new THREE.MeshBasicMaterial({
          color: SPATIAL_THEME.states.selected.outlineColor,
          wireframe: true,
        })
      );
      highlightBox.userData.ignorePicking = true;
      winGroup.add(highlightBox);
    }

    return winGroup;
  }
}
