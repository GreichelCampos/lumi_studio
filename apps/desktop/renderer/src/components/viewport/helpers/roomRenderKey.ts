import { isPlacedSpatialObject } from '../../../types';
import type { RoomModel } from '../../../types';
import { SPATIAL_THEME } from '../../../services/spatial/SpatialVisualTheme';

/** Snapshot render inputs, not object identity: detects in-place edits and ignores source metadata. */
export function roomRenderKey(room: RoomModel, wireframe: boolean, dimensions: boolean, axes: boolean): string {
  const opening = (item: RoomModel['windows'][number]) => [item.id, item.wall, item.position, item.width,
    item.height, item.color, item.material, item.elevation];
  return JSON.stringify({
    id: room.id, dimensions: room.dimensions, floor: [room.floor.color, room.floor.material],
    walls: ['north', 'south', 'east', 'west'].map(key => {
      const face = room.walls[key as keyof RoomModel['walls']];
      return [face.id, face.color, face.material];
    }),
    doors: room.doors.map(opening), windows: room.windows.map(opening),
    objects: room.objects.filter(isPlacedSpatialObject).map(item => [item.id, item.type, item.position, item.rotation,
      item.dimensions, item.color, item.material]),
    wireframe, showDimensions: dimensions, axes, theme: SPATIAL_THEME,
  });
}

export function objectDiagnosticKey(item: RoomModel['objects'][number]): string {
  return item.isOutOfBounds || item.hasError ? 'error' : item.hasCollision || item.hasWarning ? 'warning' : 'none';
}
