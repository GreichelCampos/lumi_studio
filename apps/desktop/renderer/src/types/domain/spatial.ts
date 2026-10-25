import { SourceReference } from './diagnostics';

interface SpatialObjectProperties {
  id: string;
  type: string;
  name: string;
  rotation: [number, number, number]; // [rx, ry, rz] in degrees
  dimensions: [number, number, number]; // [width, height, depth] in meters
  color?: string;
  material?: string;
  sourceRef?: SourceReference;
  hasCollision?: boolean;
  isOutOfBounds?: boolean;
  hasError?: boolean;
  hasWarning?: boolean;
  roomId?: string;
}

export type PlacedSpatialObject = SpatialObjectProperties & {
  placed?: true;
  position: [number, number, number]; // [x, y, z] centered at floor center [0,0,0]
};

export type UnplacedSpatialObject = SpatialObjectProperties & {
  placed: false;
  position?: never;
};

export type LegacySpatialObject = SpatialObjectProperties & {
  placed?: unknown;
  position: [number, number, number];
};

export type SpatialObject = PlacedSpatialObject | UnplacedSpatialObject | LegacySpatialObject;

export function isPlacedSpatialObject(object: SpatialObject): object is PlacedSpatialObject | LegacySpatialObject {
  return object.position !== undefined;
}

export interface WallFace {
  color: string;
  material?: string;
}

export interface WallConfig {
  north: WallFace;
  south: WallFace;
  east: WallFace;
  west: WallFace;
}

export interface FloorModel {
  material: string;
  color?: string;
}

export interface DoorModel {
  id: string;
  wall: 'norte' | 'sur' | 'este' | 'oeste';
  position: number; // offset along wall from center or origin
  width: number;
  height: number;
  sourceRef?: SourceReference;
}

export interface WindowModel {
  id: string;
  wall: 'norte' | 'sur' | 'este' | 'oeste';
  position: number;
  width: number;
  height: number;
  sourceRef?: SourceReference;
}

export interface RoomModel {
  id: string;
  name: string;
  dimensions: [number, number, number]; // [width (X), length (Z), height (Y)]
  floor: FloorModel;
  walls: WallConfig;
  doors: DoorModel[];
  windows: WindowModel[];
  objects: SpatialObject[];
  calculatedArea: number;
  calculatedVolume: number;
  originOffset?: [number, number, number]; // Offset for multi-room layouts
}

export interface ScenePlanDebugInfo {
  totalEntities: number;
  collisionCount: number;
  warningsCount: number;
  compiledAt: string;
}

export interface ScenePlan {
  version: string;
  rooms: RoomModel[];
  metadata?: Record<string, unknown>;
  debugInfo?: ScenePlanDebugInfo;
}
