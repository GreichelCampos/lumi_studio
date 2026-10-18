import type { DoorModel, RoomModel, WindowModel } from '../../../types';

export const WALL_THICKNESS = 0.16;
export const WINDOW_CENTER_HEIGHT = 1.6;

export function openingPlacement(opening: DoorModel | WindowModel, room: RoomModel, centerY: number): {
  position: [number, number, number]; rotationY: number;
} {
  const [width, length] = room.dimensions;
  const half = WALL_THICKNESS / 2;
  switch (opening.wall) {
    case 'norte': return { position: [opening.position, centerY, -length / 2 - half], rotationY: 0 };
    case 'sur': return { position: [opening.position, centerY, length / 2 + half], rotationY: 0 };
    case 'este': return { position: [width / 2 + half, centerY, opening.position], rotationY: Math.PI / 2 };
    case 'oeste': return { position: [-width / 2 - half, centerY, opening.position], rotationY: Math.PI / 2 };
  }
}

export interface WallSegment { left: number; right: number; bottom: number; top: number }

export function wallSegments(room: RoomModel, wall: DoorModel['wall']): WallSegment[] {
  const span = wall === 'norte' || wall === 'sur' ? room.dimensions[0] : room.dimensions[1];
  const height = room.dimensions[2];
  const holes = [
    ...room.doors.filter(item => item.wall === wall).map(item => ({ item, bottom: 0, top: item.height })),
    ...room.windows.filter(item => item.wall === wall).map(item => ({
      item, bottom: WINDOW_CENTER_HEIGHT - item.height / 2, top: WINDOW_CENTER_HEIGHT + item.height / 2,
    })),
  ].map(({ item, bottom, top }) => ({
    left: Math.max(-span / 2, item.position - item.width / 2),
    right: Math.min(span / 2, item.position + item.width / 2),
    bottom: Math.max(0, bottom), top: Math.min(height, top),
  })).filter(hole => hole.right > hole.left && hole.top > hole.bottom);
  const xs = [...new Set([-span / 2, span / 2, ...holes.flatMap(hole => [hole.left, hole.right])])].sort((a, b) => a - b);
  const ys = [...new Set([0, height, ...holes.flatMap(hole => [hole.bottom, hole.top])])].sort((a, b) => a - b);
  const segments: WallSegment[] = [];
  for (let x = 1; x < xs.length; x++) {
    for (let y = 1; y < ys.length; y++) {
      const centerX = (xs[x - 1] + xs[x]) / 2;
      const centerY = (ys[y - 1] + ys[y]) / 2;
      if (!holes.some(hole => centerX > hole.left && centerX < hole.right && centerY > hole.bottom && centerY < hole.top)) {
        segments.push({ left: xs[x - 1], right: xs[x], bottom: ys[y - 1], top: ys[y] });
      }
    }
  }
  return segments;
}
