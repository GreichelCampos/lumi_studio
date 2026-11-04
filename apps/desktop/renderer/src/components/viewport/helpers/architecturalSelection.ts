import type { DoorModel, RoomModel, WallFace } from '../../../types';

export const wallFaces = [
  ['north', 'norte'], ['south', 'sur'], ['east', 'este'], ['west', 'oeste'],
] as const;

export interface DeclaredWallSelection {
  data: WallFace & { id: string };
  wall: DoorModel['wall'];
  dimensions: [number, number];
}

export function findDeclaredWall(room: RoomModel, id: string): DeclaredWallSelection | undefined {
  if (!id.trim()) return undefined;
  for (const [key, wall] of wallFaces) {
    const face = room.walls[key];
    if (face.id === id) return {
      data: face as WallFace & { id: string }, wall,
      dimensions: [key === 'north' || key === 'south' ? room.dimensions[0] : room.dimensions[1], room.dimensions[2]],
    };
  }
}

export function roomContainsEntity(room: RoomModel, id: string): boolean {
  return room.objects.some(item => item.id === id) || room.doors.some(item => item.id === id)
    || room.windows.some(item => item.id === id) || Boolean(findDeclaredWall(room, id));
}
