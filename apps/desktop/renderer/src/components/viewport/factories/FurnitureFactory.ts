import * as THREE from 'three';
import { SpatialObject, isPlacedSpatialObject } from '../../../types';
import { SPATIAL_THEME } from '../../../services/spatial/SpatialVisualTheme';

import { surfaceColor, surfaceMaterial } from '../helpers/surfaceMaterial';

export class FurnitureFactory {
  public static createFurnitureMesh(
    item: SpatialObject,
    isSelected: boolean,
    isWireframe: boolean,
    isDebugActive = false
  ): THREE.Group {
    const objGroup = new THREE.Group();
    objGroup.name = item.id;

    if (!isPlacedSpatialObject(item)) return objGroup;

    const [ox, oy, oz] = item.position;
    const [rx, ry, rz] = item.rotation;
    const [ow, oh, od] = item.dimensions;

    const hasError = Boolean(item.isOutOfBounds || item.hasError);
    const hasWarning = Boolean(!hasError && (item.hasCollision || item.hasWarning));

    const objColor = surfaceColor(item.color, '#64748b');

    // Emissive tint if selected, error, warning or active debug
    let emissiveColor = '#000000';
    let emissiveIntensity = 0;

    if (hasError) {
      emissiveColor = SPATIAL_THEME.states.error.emissive;
      emissiveIntensity = SPATIAL_THEME.states.error.emissiveIntensity;
    } else if (hasWarning) {
      emissiveColor = SPATIAL_THEME.states.warning.emissive;
      emissiveIntensity = SPATIAL_THEME.states.warning.emissiveIntensity;
    } else if (isDebugActive) {
      emissiveColor = SPATIAL_THEME.states.activeDebug.emissive;
      emissiveIntensity = SPATIAL_THEME.states.activeDebug.emissiveIntensity;
    } else if (isSelected) {
      emissiveColor = SPATIAL_THEME.states.selected.emissive;
      emissiveIntensity = SPATIAL_THEME.states.selected.emissiveIntensity;
    }

    const standardMat = new THREE.MeshStandardMaterial({
      color: objColor,
      ...surfaceMaterial(item.material),
      emissive: emissiveColor,
      emissiveIntensity: emissiveIntensity,
      wireframe: isWireframe,
    });

    const body = new THREE.Group();
    this.buildGeometryByType(body, item.type.toLowerCase(), standardMat, Math.max(ow, 0.25), Math.max(oh, 0.5), Math.max(od, 0.25));
    const bounds = new THREE.Box3().setFromObject(body);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    body.scale.set(ow / size.x, oh / size.y, od / size.z);
    body.position.set(-center.x * body.scale.x, -bounds.min.y * body.scale.y, -center.z * body.scale.z);
    body.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) if ('wireframe' in material) material.wireframe = isWireframe;
      }
    });
    objGroup.add(body);

    // Aplicar posición y rotación (en radianes)
    objGroup.position.set(ox, oy, oz);
    objGroup.rotation.set(
      (rx * Math.PI) / 180,
      (ry * Math.PI) / 180,
      (rz * Math.PI) / 180
    );

    // Resaltado visual centralizado (Debug / Selección / Error / Warning)
    if (isSelected || hasError || hasWarning || isDebugActive) {
      const stateColor = hasError
        ? SPATIAL_THEME.states.error.outlineColor
        : isDebugActive
        ? SPATIAL_THEME.states.activeDebug.outlineColor
        : hasWarning
        ? SPATIAL_THEME.states.warning.outlineColor
        : SPATIAL_THEME.states.selected.outlineColor;

      const boxGeo = new THREE.BoxGeometry(ow + 0.08, oh + 0.08, od + 0.08);
      const boxMat = new THREE.MeshBasicMaterial({
        color: stateColor,
        wireframe: true,
        transparent: true,
        opacity: 0.95,
      });
      const highlightBox = new THREE.Mesh(boxGeo, boxMat);
      highlightBox.position.set(0, oh / 2, 0);
      highlightBox.userData.ignorePicking = true;
      objGroup.add(highlightBox);

      const ringColor = hasError
        ? SPATIAL_THEME.states.error.ringColor
        : isDebugActive
        ? SPATIAL_THEME.states.activeDebug.ringColor
        : hasWarning
        ? SPATIAL_THEME.states.warning.ringColor
        : SPATIAL_THEME.states.selected.ringColor;

      const ringOpacity = hasError
        ? SPATIAL_THEME.states.error.ringOpacity
        : isDebugActive
        ? SPATIAL_THEME.states.activeDebug.ringOpacity
        : hasWarning
        ? SPATIAL_THEME.states.warning.ringOpacity
        : SPATIAL_THEME.states.selected.ringOpacity;

      const discGeo = new THREE.RingGeometry(0.08, Math.max(ow, od) / 1.45, 24);
      const discMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: ringOpacity,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 0.015;
      disc.userData.ignorePicking = true;
      objGroup.add(disc);

      // Si hay error o warning Y selección o debug simultánea: agregar borde secundario
      if ((hasError || hasWarning) && (isSelected || isDebugActive)) {
        const dualBox = new THREE.Mesh(
          new THREE.BoxGeometry(ow + 0.14, oh + 0.14, od + 0.14),
          new THREE.MeshBasicMaterial({
            color: isDebugActive ? SPATIAL_THEME.states.activeDebug.outlineColor : SPATIAL_THEME.states.selected.outlineColor,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
          })
        );
        dualBox.position.set(0, oh / 2, 0);
        dualBox.userData.ignorePicking = true;
        objGroup.add(dualBox);
      }
    }

    return objGroup;
  }

  private static buildGeometryByType(
    group: THREE.Group,
    type: string,
    standardMat: THREE.MeshStandardMaterial,
    ow: number,
    oh: number,
    od: number
  ): void {
    switch (type) {
      case 'mesa':
        this.buildMesa(group, standardMat, ow, oh, od);
        break;
      case 'silla':
        this.buildSilla(group, standardMat, ow, oh, od);
        break;
      case 'cama':
        this.buildCama(group, standardMat, ow, oh, od);
        break;
      case 'sofa':
        this.buildSofa(group, standardMat, ow, oh, od);
        break;
      case 'armario':
        this.buildArmario(group, standardMat, ow, oh, od);
        break;
      case 'escritorio':
        this.buildEscritorio(group, standardMat, ow, oh, od);
        break;
      case 'estante':
        this.buildEstante(group, standardMat, ow, oh, od);
        break;
      case 'lampara':
        this.buildLampara(group, standardMat, ow, oh, od);
        break;
      case 'televisor':
        this.buildTelevisor(group, standardMat, ow, oh, od);
        break;
      case 'planta':
        this.buildPlanta(group, standardMat, ow, oh, od);
        break;
      default:
        this.buildGeneric(group, standardMat, ow, oh, od);
        break;
    }
  }

  private static buildMesa(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const topH = Math.min(0.06, oh * 0.1);
    const top = new THREE.Mesh(new THREE.BoxGeometry(ow, topH, od), standardMat);
    top.position.y = oh - topH / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.6 });
    const legRadius = Math.min(0.03, Math.min(ow, od) * 0.04);
    const legH = oh - topH;
    const insetX = ow * 0.1;
    const insetZ = od * 0.1;

    [
      [-ow / 2 + insetX, legH / 2, -od / 2 + insetZ],
      [ow / 2 - insetX, legH / 2, -od / 2 + insetZ],
      [-ow / 2 + insetX, legH / 2, od / 2 - insetZ],
      [ow / 2 - insetX, legH / 2, od / 2 - insetZ],
    ].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius, legRadius, legH, 12), legMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      group.add(leg);
    });
  }

  private static buildSilla(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const seatH = oh * 0.48;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(ow, 0.05, od * 0.85), standardMat);
    seat.position.set(0, seatH, od * 0.05);
    seat.castShadow = true;
    group.add(seat);

    const backH = oh - seatH;
    const back = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.95, backH, 0.04), standardMat);
    back.position.set(0, seatH + backH / 2, -od * 0.4 + 0.02);
    back.castShadow = true;
    group.add(back);

    const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
    const legR = 0.018;
    const insetX = ow * 0.1;
    const insetZ = od * 0.1;
    [
      [-ow / 2 + insetX, seatH / 2, -od / 2 + insetZ],
      [ow / 2 - insetX, seatH / 2, -od / 2 + insetZ],
      [-ow / 2 + insetX, seatH / 2, od / 2 - insetZ],
      [ow / 2 - insetX, seatH / 2, od / 2 - insetZ],
    ].forEach(([cx, cy, cz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 0.7, seatH, 8), legMat);
      leg.position.set(cx, cy, cz);
      group.add(leg);
    });
  }

  private static buildCama(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const frameMat = standardMat;
    const mattressMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 });
    const duvetMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.7 });

    const bFrameH = oh * 0.35;
    const bFrame = new THREE.Mesh(new THREE.BoxGeometry(ow, bFrameH, od), frameMat);
    bFrame.position.y = bFrameH / 2;
    bFrame.castShadow = true;
    group.add(bFrame);

    const headboardH = oh * 1.05;
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(ow, headboardH, 0.08), frameMat);
    headboard.position.set(0, headboardH / 2, -od / 2 + 0.04);
    headboard.castShadow = true;
    group.add(headboard);

    const matH = oh * 0.35;
    const matMesh = new THREE.Mesh(new THREE.BoxGeometry(ow - 0.06, matH, od - 0.1), mattressMat);
    matMesh.position.set(0, bFrameH + matH / 2, 0.02);
    matMesh.castShadow = true;
    group.add(matMesh);

    const pillowGeo = new THREE.BoxGeometry(ow * 0.4, 0.08, od * 0.22);
    const p1 = new THREE.Mesh(pillowGeo, mattressMat);
    p1.position.set(-ow * 0.24, bFrameH + matH + 0.04, -od * 0.28);
    const p2 = new THREE.Mesh(pillowGeo, mattressMat);
    p2.position.set(ow * 0.24, bFrameH + matH + 0.04, -od * 0.28);
    group.add(p1);
    group.add(p2);

    const duvet = new THREE.Mesh(new THREE.BoxGeometry(ow - 0.04, 0.06, od * 0.62), duvetMat);
    duvet.position.set(0, bFrameH + matH + 0.03, od * 0.16);
    duvet.castShadow = true;
    group.add(duvet);
  }

  private static buildSofa(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const baseH = oh * 0.3;
    const base = new THREE.Mesh(new THREE.BoxGeometry(ow, baseH, od), standardMat);
    base.position.y = baseH / 2;
    base.castShadow = true;
    group.add(base);

    const cushionMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.42, oh * 0.18, od * 0.72), cushionMat);
    c1.position.set(-ow * 0.22, baseH + (oh * 0.18) / 2, od * 0.06);
    c1.castShadow = true;
    group.add(c1);

    const c2 = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.42, oh * 0.18, od * 0.72), cushionMat);
    c2.position.set(ow * 0.22, baseH + (oh * 0.18) / 2, od * 0.06);
    c2.castShadow = true;
    group.add(c2);

    const backH = oh * 0.65;
    const back = new THREE.Mesh(new THREE.BoxGeometry(ow, backH, od * 0.24), standardMat);
    back.position.set(0, baseH + backH / 2, -od * 0.36);
    back.castShadow = true;
    group.add(back);

    const armW = ow * 0.12;
    const armH = oh * 0.55;
    const armLeft = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, od), standardMat);
    armLeft.position.set(-ow / 2 + armW / 2, armH / 2, 0);
    armLeft.castShadow = true;
    group.add(armLeft);

    const armRight = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, od), standardMat);
    armRight.position.set(ow / 2 - armW / 2, armH / 2, 0);
    armRight.castShadow = true;
    group.add(armRight);
  }

  private static buildArmario(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(ow, oh - 0.08, od), standardMat);
    body.position.y = (oh - 0.08) / 2 + 0.08;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const footerMat = new THREE.MeshStandardMaterial({ color: '#0f172a' });
    const foot1 = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.9, 0.08, od * 0.9), footerMat);
    foot1.position.y = 0.04;
    group.add(foot1);

    const seamMat = new THREE.MeshBasicMaterial({ color: '#1e293b' });
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.01, oh * 0.85, 0.02), seamMat);
    seam.position.set(0, oh / 2 + 0.04, od / 2 + 0.005);
    group.add(seam);

    const handleMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.8, roughness: 0.2 });
    const hLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, oh * 0.2, 8), handleMat);
    hLeft.position.set(-ow * 0.06, oh * 0.5, od / 2 + 0.02);
    const hRight = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, oh * 0.2, 8), handleMat);
    hRight.position.set(ow * 0.06, oh * 0.5, od / 2 + 0.02);
    group.add(hLeft);
    group.add(hRight);
  }

  private static buildEscritorio(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const top = new THREE.Mesh(new THREE.BoxGeometry(ow, 0.05, od), standardMat);
    top.position.y = oh - 0.025;
    top.castShadow = true;
    group.add(top);

    const drawerW = ow * 0.35;
    const drawerH = oh - 0.05;
    const drawerUnit = new THREE.Mesh(new THREE.BoxGeometry(drawerW, drawerH, od * 0.9), standardMat);
    drawerUnit.position.set(-ow / 2 + drawerW / 2, drawerH / 2, 0);
    drawerUnit.castShadow = true;
    group.add(drawerUnit);

    const handleMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.7, roughness: 0.3 });
    for (let c = 1; c <= 3; c++) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(drawerW * 0.4, 0.02, 0.02), handleMat);
      handle.position.set(-ow / 2 + drawerW / 2, (drawerH / 4) * c, od * 0.46);
      group.add(handle);
    }

    const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.04, oh - 0.05, od * 0.9), legMat);
    rightLeg.position.set(ow / 2 - 0.02, (oh - 0.05) / 2, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    const modesty = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.6, (oh - 0.05) * 0.6, 0.02), legMat);
    modesty.position.set(ow * 0.15, (oh - 0.05) * 0.6, -od / 2 + 0.03);
    group.add(modesty);
  }

  private static buildEstante(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const sideMat = standardMat;
    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.03, oh, od), sideMat);
    leftSide.position.set(-ow / 2 + 0.015, oh / 2, 0);
    leftSide.castShadow = true;
    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.03, oh, od), sideMat);
    rightSide.position.set(ow / 2 - 0.015, oh / 2, 0);
    rightSide.castShadow = true;
    group.add(leftSide);
    group.add(rightSide);

    const back = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, 0.02), sideMat);
    back.position.set(0, oh / 2, -od / 2 + 0.01);
    group.add(back);

    const shelfCount = 4;
    for (let i = 0; i < shelfCount; i++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(ow - 0.06, 0.03, od - 0.02), sideMat);
      const sy = (oh / (shelfCount - 1)) * i;
      shelf.position.set(0, Math.min(sy, oh - 0.015), 0.01);
      shelf.castShadow = true;
      group.add(shelf);

      if (i > 0 && i < 3) {
        const bookColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[i % 4] });
        const books = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.25, 0.18, od * 0.6), bookMat);
        books.position.set(-ow * 0.2 + (i * 0.1), sy + 0.09, 0.02);
        group.add(books);
      }
    }
  }

  private static buildLampara(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const baseR = Math.min(ow, od) * 0.4;
    const lBase = new THREE.Mesh(
      new THREE.CylinderGeometry(baseR, baseR, 0.04, 16),
      standardMat
    );
    lBase.position.y = 0.02;
    lBase.castShadow = true;
    group.add(lBase);

    const lPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, oh * 0.75, 12),
      new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8, roughness: 0.2 })
    );
    lPole.position.y = (oh * 0.75) / 2;
    lPole.castShadow = true;
    group.add(lPole);

    const shadeR = Math.min(ow, od) * 0.45;
    const shadeH = oh * 0.25;
    const lShade = new THREE.Mesh(
      new THREE.ConeGeometry(shadeR, shadeH, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: standardMat.color,
        roughness: standardMat.roughness,
        metalness: standardMat.metalness,
        emissive: '#facc15',
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    lShade.position.y = oh * 0.85;
    lShade.castShadow = true;
    group.add(lShade);
  }

  private static buildTelevisor(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const standMat = standardMat;
    const tBase = new THREE.Mesh(new THREE.BoxGeometry(ow * 0.45, 0.02, od * 0.6), standMat);
    tBase.position.y = 0.01;
    tBase.castShadow = true;
    group.add(tBase);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, oh * 0.2, 8), standMat);
    neck.position.y = (oh * 0.2) / 2;
    group.add(neck);

    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(ow, oh * 0.75, 0.04), standMat);
    screenFrame.position.y = oh * 0.2 + (oh * 0.75) / 2;
    screenFrame.castShadow = true;
    group.add(screenFrame);

    const displayScreen = new THREE.Mesh(
      new THREE.BoxGeometry(ow * 0.94, oh * 0.68, 0.01),
      new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#0369a1',
        emissiveIntensity: 0.3,
        roughness: 0.1,
      })
    );
    displayScreen.position.set(0, oh * 0.2 + (oh * 0.75) / 2, 0.025);
    group.add(displayScreen);
  }

  private static buildPlanta(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const potH = oh * 0.35;
    const potR = Math.min(ow, od) * 0.38;
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(potR, potR * 0.7, potH, 16),
      standardMat
    );
    pot.position.y = potH / 2;
    pot.castShadow = true;
    group.add(pot);

    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(potR * 0.9, 16),
      new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 })
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = potH * 0.95;
    group.add(soil);

    const leafMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.6 });
    const leafCount = 8;
    for (let l = 0; l < leafCount; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(ow * 0.2, oh * 0.5, 5), leafMat);
      const angle = (l / leafCount) * Math.PI * 2;
      leaf.position.set(
        Math.cos(angle) * (ow * 0.15),
        potH + oh * 0.18 + (l % 3) * 0.08,
        Math.sin(angle) * (ow * 0.15)
      );
      leaf.rotation.x = Math.sin(angle) * 0.45;
      leaf.rotation.z = Math.cos(angle) * 0.45;
      leaf.castShadow = true;
      group.add(leaf);
    }
  }

  private static buildGeneric(group: THREE.Group, standardMat: THREE.MeshStandardMaterial, ow: number, oh: number, od: number): void {
    const generic = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, od), standardMat);
    generic.position.y = oh / 2;
    generic.castShadow = true;
    generic.receiveShadow = true;
    group.add(generic);
  }
}
