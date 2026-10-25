import { ScenePlan, RoomModel, SpatialObject, DiagnosticItem, isPlacedSpatialObject } from '../../types';
import { MockDiagnosticFactory } from './MockDiagnosticFactory';

/**
 * Helper factory for simulated spatial scene graph snapshots and rule validations.
 */
export class MockScenePlanFactory {
  public static createSceneSnapshot(rooms: RoomModel[], diagnostics: DiagnosticItem[]): ScenePlan {
    return {
      version: '1.0.0',
      rooms: rooms.map((r) => ({
        ...r,
        doors: [...r.doors],
        windows: [...r.windows],
        objects: [...r.objects],
      })),
      debugInfo: {
        totalEntities: rooms.reduce((acc, r) => acc + r.objects.length, 0),
        collisionCount: rooms.reduce((acc, r) => acc + r.objects.filter((o) => o.hasCollision).length, 0),
        warningsCount: diagnostics.filter((d) => d.severity === 'warning').length,
        compiledAt: new Date().toISOString(),
      },
    };
  }

  public static validateSpatialPlacements(
    newObj: SpatialObject,
    currentRoom: RoomModel,
    targetFileName: string,
    lineNum: number,
    compilationId: string,
    diagnostics: DiagnosticItem[]
  ): void {
    if (!isPlacedSpatialObject(newObj)) return;
    const [posX, posY, posZ] = newObj.position;
    const dims = newObj.dimensions;
    const roomHalfW = currentRoom.dimensions[0] / 2;
    const roomHalfL = currentRoom.dimensions[1] / 2;
    const objHalfW = dims[0] / 2;
    const objHalfD = dims[2] / 2;

    // 1. Out of bounds check (spatial error, non-blocking)
    const isOutOfBounds = Math.abs(posX) + objHalfW > roomHalfW || Math.abs(posZ) + objHalfD > roomHalfL;
    if (isOutOfBounds) {
      newObj.isOutOfBounds = true;
      newObj.hasError = true;
      diagnostics.push(
        MockDiagnosticFactory.outOfBounds(
          compilationId,
          targetFileName,
          lineNum,
          newObj.name,
          newObj.id,
          currentRoom.name,
          currentRoom.id,
          [posX, posY, posZ],
          roomHalfW,
          roomHalfL,
          objHalfW,
          objHalfD
        )
      );
    }

    // 2. Collision with existing objects in room (spatial warning, non-blocking)
    for (const existing of currentRoom.objects) {
      if (!isPlacedSpatialObject(existing)) continue;
      const dx = Math.abs(existing.position[0] - posX);
      const dz = Math.abs(existing.position[2] - posZ);
      const minRequiredX = (existing.dimensions[0] + dims[0]) / 2.1;
      const minRequiredZ = (existing.dimensions[2] + dims[2]) / 2.1;

      if (dx < minRequiredX && dz < minRequiredZ) {
        newObj.hasCollision = true;
        newObj.hasWarning = true;
        existing.hasCollision = true;
        existing.hasWarning = true;
        diagnostics.push(
          MockDiagnosticFactory.collision(
            compilationId,
            targetFileName,
            lineNum,
            newObj.name,
            newObj.id,
            existing.name,
            existing.id,
            currentRoom.id
          )
        );
      }
    }

    // 3. Door clearance check (spatial warning, non-blocking)
    for (const door of currentRoom.doors) {
      let isBlockingDoor = false;
      if (door.wall === 'norte' && Math.abs(posZ - -roomHalfL) < 0.6 && Math.abs(posX - door.position) < 0.8) {
        isBlockingDoor = true;
      } else if (door.wall === 'sur' && Math.abs(posZ - roomHalfL) < 0.6 && Math.abs(posX - door.position) < 0.8) {
        isBlockingDoor = true;
      } else if (door.wall === 'este' && Math.abs(posX - roomHalfW) < 0.6 && Math.abs(posZ - door.position) < 0.8) {
        isBlockingDoor = true;
      } else if (door.wall === 'oeste' && Math.abs(posX - -roomHalfW) < 0.6 && Math.abs(posZ - door.position) < 0.8) {
        isBlockingDoor = true;
      }

      if (isBlockingDoor) {
        newObj.hasWarning = true;
        diagnostics.push(
          MockDiagnosticFactory.doorBlock(
            compilationId,
            targetFileName,
            lineNum,
            newObj.name,
            newObj.id,
            door.id,
            door.wall,
            currentRoom.id
          )
        );
      }
    }
  }
}
