import * as THREE from 'three';
import { RoomModel } from '../../../types';

/**
 * Pure spatial math calculations for Viewport 3D
 */
export function calculateRoomCenter(room: RoomModel): THREE.Vector3 {
  const [, , rh] = room.dimensions;
  return new THREE.Vector3(0, rh * 0.35, 0);
}

export function calculateDynamicViewSpan(room: RoomModel, aspect = 1.0): number {
  const [rw, rl, rh] = room.dimensions;
  // Extensión horizontal proyectada a 45 grados de rotación isométrica: (rw + rl) * cos(45°)
  const projWidth = (rw + rl) * 0.7071 + 0.45; // margen optimizado para cotas métricas y etiquetas
  // Extensión vertical proyectada con inclinación isométrica (~35.26° de elevación):
  const projHeight = rh * 0.82 + projWidth * 0.40 + 0.35;

  // Factor de relleno adaptativo:
  // En pantallas panorámicas/amplias aprovecha más del 90% del espacio vertical disponible
  const paddingFactor = aspect >= 1.3 ? 1.06 : aspect >= 0.9 ? 1.10 : 1.14;

  // En cámara ortográfica: la altura visible es 2 * viewSpan y el ancho visible es 2 * viewSpan * aspect
  const spanFromHeight = (projHeight / 2) * paddingFactor;
  const spanFromWidth = ((projWidth / 2) / Math.max(aspect, 0.25)) * paddingFactor;

  // Seleccionamos el span necesario para que la habitación encaje con máxima presencia y fidelidad visual
  return Math.max(spanFromHeight, spanFromWidth, 1.8);
}

export function calculateCameraDistance(room: RoomModel): number {
  const [rw, rl, rh] = room.dimensions;
  const maxDim = Math.max(rw, rl, rh * 1.3, 3.5);
  return maxDim * 2.2;
}

export interface WallOcclusionState {
  isSouthOccluding: boolean;
  isNorthOccluding: boolean;
  isEastOccluding: boolean;
  isWestOccluding: boolean;
}

export function calculateWallOcclusion(cameraPosition: THREE.Vector3): WallOcclusionState {
  return {
    isSouthOccluding: cameraPosition.z > 0.5,
    isNorthOccluding: cameraPosition.z < -0.5,
    isEastOccluding: cameraPosition.x > 0.5,
    isWestOccluding: cameraPosition.x < -0.5,
  };
}
