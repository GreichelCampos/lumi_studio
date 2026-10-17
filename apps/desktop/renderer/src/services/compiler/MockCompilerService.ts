import {
  LumiProject,
  ScenePlan,
  RoomModel,
  SpatialObject,
  DiagnosticItem,
  DebugStep,
  DoorModel,
  WindowModel,
  CompileResult,
  EntryFileInfo,
} from '../../types';
import { CompilerService, CompileOptions } from './CompilerService';
import { STANDARD_FURNITURE_DIMS } from '../../data/compilerFixtures';
import { LUMI_PATTERNS } from './mockCompilerPatterns';
import { MockDiagnosticFactory } from './MockDiagnosticFactory';
import { MockScenePlanFactory } from './MockScenePlanFactory';

export class MockCompilerService implements CompilerService {
  private defaultDelayMs: number;

  constructor(defaultDelayMs: number = 280) {
    this.defaultDelayMs = defaultDelayMs;
  }

  public async compile(project: LumiProject, options?: CompileOptions | string): Promise<CompileResult> {
    const startTime = performance.now();
    const activeFileId = typeof options === 'string' ? options : options?.activeFileId;
    const delayMs =
      typeof options === 'object' && options?.delayMs !== undefined ? options.delayMs : this.defaultDelayMs;

    // Simulated background compilation latency
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const compilationId = `comp-${Date.now().toString(36)}-${Math.floor(Math.random() * 8999 + 1000)}`;

    if (!project || !project.files || project.files.length === 0) {
      return {
        compilationId,
        status: 'blocked',
        success: false,
        diagnostics: [MockDiagnosticFactory.noProject(compilationId)],
        scenePlan: null,
        entryFileInfo: null,
        durationMs: Math.round(performance.now() - startTime),
        logs: ['Error de compilación: No hay proyecto ni archivos disponibles.'],
        debugSteps: [],
        timestamp: new Date().toISOString(),
      };
    }

    const entryFiles = project.files.filter((f) => f.isEntry || f.id === project.entryFileId);
    let targetFile = project.files.find((f) => f.id === activeFileId);

    if (!targetFile) {
      targetFile = entryFiles.length === 1 ? entryFiles[0] : project.files[0];
    }

    const entryFileInfo: EntryFileInfo = {
      id: targetFile.id,
      name: targetFile.name,
      path: targetFile.path,
    };

    // Parse and generate simulated result
    const result = this.parseAndSimulate(project, targetFile, compilationId);
    const durationMs = Math.round(performance.now() - startTime);

    return {
      ...result,
      compilationId,
      entryFileInfo,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }

  private parseAndSimulate(
    project: LumiProject,
    targetFile: { id: string; name: string; path: string; content: string },
    compilationId: string
  ): Omit<CompileResult, 'compilationId' | 'entryFileInfo' | 'durationMs' | 'timestamp'> {
    const diagnostics: DiagnosticItem[] = [];
    const logs: string[] = [];
    const debugSteps: DebugStep[] = [];
    const rooms: RoomModel[] = [];

    const lines = targetFile.content.split('\n');
    const variables: Record<string, number | string | boolean | null> = {};

    let currentRoom: RoomModel | null = null;
    let openBraces = 0;

    let inDoorBlock: {
      wall: 'norte' | 'sur' | 'este' | 'oeste';
      width: number;
      height: number;
      pos: number;
      line: number;
    } | null = null;
    let inWindowBlock: {
      wall: 'norte' | 'sur' | 'este' | 'oeste';
      width: number;
      height: number;
      pos: number;
      line: number;
    } | null = null;

    const createSnapshot = () => MockScenePlanFactory.createSceneSnapshot(rooms, diagnostics);

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const lineNum = i + 1;
      const trimmed = rawLine.trim();

      if (!trimmed || LUMI_PATTERNS.comment.test(trimmed)) continue;

      // 1. Lexical checks: Unrecognized characters / illegal tokens
      if (trimmed.includes('@') || trimmed.includes('$') || (trimmed.includes('&') && !trimmed.includes('&&'))) {
        const col = Math.max(1, rawLine.indexOf('@') !== -1 ? rawLine.indexOf('@') + 1 : rawLine.indexOf('$') + 1);
        diagnostics.push(MockDiagnosticFactory.illegalSymbol(compilationId, targetFile.name, lineNum, col));
      }

      // Check for unclosed string literal on this line
      const quoteCount = (trimmed.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        diagnostics.push(
          MockDiagnosticFactory.unclosedString(compilationId, targetFile.name, lineNum, trimmed.lastIndexOf('"') + 1)
        );
      }

      // 2. Syntactic checks: Legacy comments //
      if (LUMI_PATTERNS.legacyComment.test(trimmed)) {
        diagnostics.push(MockDiagnosticFactory.legacyComment(compilationId, targetFile.name, lineNum));
      }

      if (trimmed.includes('{')) openBraces += (trimmed.match(/\{/g) || []).length;
      if (trimmed.includes('}')) openBraces -= (trimmed.match(/\}/g) || []).length;

      // 3. Import checks: importar "muebles.lumi" usar crear_comedor>>
      const importMatch = trimmed.match(LUMI_PATTERNS.importStmt);
      if (importMatch) {
        const importedName = importMatch[1];
        const existsInProject = project.files.some(
          (f) => f.name === importedName || f.path.endsWith(importedName)
        );

        if (!existsInProject) {
          diagnostics.push(
            MockDiagnosticFactory.unresolvedImport(
              compilationId,
              targetFile.name,
              lineNum,
              trimmed.indexOf(importedName),
              importedName
            )
          );
        }

        if (!trimmed.endsWith('>>') && !trimmed.endsWith(';')) {
          diagnostics.push(
            MockDiagnosticFactory.missingTerminator(
              compilationId,
              targetFile.name,
              lineNum,
              trimmed.length,
              'al final de la declaración de importación'
            )
          );
        }
        continue;
      }

      // 4. Semantic check: Operation with 'nulo'
      if (
        trimmed.includes('nulo +') ||
        trimmed.includes('+ nulo') ||
        trimmed.includes('nulo *') ||
        trimmed.includes('* nulo') ||
        trimmed.includes('nulo /') ||
        trimmed.includes('- nulo')
      ) {
        diagnostics.push(
          MockDiagnosticFactory.nullOperation(compilationId, targetFile.name, lineNum, trimmed.indexOf('nulo') + 1)
        );
      }

      // 5. Execution check: Division by zero simulated
      if (LUMI_PATTERNS.divByZero.test(trimmed)) {
        const col = trimmed.indexOf('/ 0') !== -1 ? trimmed.indexOf('/ 0') + 1 : trimmed.indexOf('/0') + 1;
        diagnostics.push(MockDiagnosticFactory.divisionByZero(compilationId, targetFile.name, lineNum, col));
      }

      // 6. Variable assignments: decimal ancho = 5.0>>
      const varDeclMatch = trimmed.match(LUMI_PATTERNS.varDecl);
      if (varDeclMatch) {
        const [, type, varName, rawVal] = varDeclMatch;
        const cleanVal = rawVal.trim().replace(/^"|"$/g, '');

        if (!trimmed.endsWith('>>') && !trimmed.endsWith(';')) {
          diagnostics.push(
            MockDiagnosticFactory.missingTerminator(
              compilationId,
              targetFile.name,
              lineNum,
              trimmed.length,
              `al final de la asignación de "${varName}"`
            )
          );
        }

        if (cleanVal === 'nulo') {
          variables[varName] = null;
        } else if (type === 'entero' || type === 'decimal') {
          const num = parseFloat(cleanVal);
          variables[varName] = isNaN(num) ? 0 : num;
        } else if (type === 'booleano') {
          variables[varName] = cleanVal === 'verdadero' || cleanVal === 'true';
        } else {
          variables[varName] = cleanVal;
        }
        continue;
      }

      // 7. Room declaration: habitacion sala(ancho, largo, alto) {
      const roomMatch = trimmed.match(LUMI_PATTERNS.roomDecl);
      if (roomMatch) {
        const roomName = roomMatch[1];
        const resolveDim = (dimStr: string) => {
          const key = dimStr.trim();
          if (variables[key] !== undefined && typeof variables[key] === 'number') {
            return variables[key] as number;
          }
          const parsed = parseFloat(key);
          return isNaN(parsed) ? 4.0 : parsed;
        };

        const rWidth = resolveDim(roomMatch[2]);
        const rLength = resolveDim(roomMatch[3]);
        const rHeight = resolveDim(roomMatch[4]);

        if (rWidth <= 0 || rLength <= 0 || rHeight <= 0) {
          diagnostics.push(
            MockDiagnosticFactory.invalidRoomDimensions(compilationId, targetFile.name, lineNum, roomName, [
              rWidth,
              rLength,
              rHeight,
            ])
          );
        }

        const newRoom: RoomModel = {
          id: `room-${roomName}-${rooms.length + 1}`,
          name: roomName,
          dimensions: [rWidth > 0 ? rWidth : 4.0, rLength > 0 ? rLength : 4.0, rHeight > 0 ? rHeight : 2.7],
          floor: { material: 'madera' },
          walls: {
            north: { color: 'blanco' },
            south: { color: 'gris' },
            east: { color: 'blanco' },
            west: { color: 'blanco' },
          },
          doors: [],
          windows: [],
          objects: [],
          calculatedArea: rWidth * rLength,
          calculatedVolume: rWidth * rLength * rHeight,
          originOffset: [0, 0, 0],
        };

        rooms.push(newRoom);
        currentRoom = newRoom;

        debugSteps.push({
          id: `step-${debugSteps.length + 1}`,
          stepIndex: debugSteps.length + 1,
          eventType: 'room_create',
          description: `Habitación '${roomName}' declarada (${rWidth}m × ${rLength}m × ${rHeight}m)`,
          sourceRef: { file: targetFile.name, line: lineNum, column: 1 },
          roomId: newRoom.id,
          lineNumber: lineNum,
          codeLine: trimmed,
          actionDescription: `Habitación '${roomName}' declarada (${rWidth}m × ${rLength}m × ${rHeight}m) con origen central [0,0,0]`,
          sceneSnapshot: createSnapshot(),
        });
        continue;
      }

      // 8. Floor & Wall definitions
      const floorMatch = trimmed.match(LUMI_PATTERNS.floorMat);
      if (floorMatch && currentRoom) {
        const matKey = floorMatch[1].trim().replace(/['"]/g, '');
        currentRoom.floor.material = (variables[matKey] as string) || matKey;
        continue;
      }

      const wallMatch = trimmed.match(LUMI_PATTERNS.wallColor);
      if (wallMatch && currentRoom) {
        const side = wallMatch[1] as 'norte' | 'sur' | 'este' | 'oeste';
        const colVal = wallMatch[2].trim().replace(/['"]/g, '');
        if (side === 'norte') currentRoom.walls.north.color = colVal;
        if (side === 'sur') currentRoom.walls.south.color = colVal;
        if (side === 'este') currentRoom.walls.east.color = colVal;
        if (side === 'oeste') currentRoom.walls.west.color = colVal;
        continue;
      }

      // 9. Door / Window blocks
      const doorMatch = trimmed.match(LUMI_PATTERNS.doorBlock);
      if (doorMatch) {
        inDoorBlock = {
          wall: doorMatch[1] as 'norte' | 'sur' | 'este' | 'oeste',
          width: 0.9,
          height: 2.1,
          pos: 0.0,
          line: lineNum,
        };
        continue;
      }

      const windowMatch = trimmed.match(LUMI_PATTERNS.windowBlock);
      if (windowMatch) {
        inWindowBlock = {
          wall: windowMatch[1] as 'norte' | 'sur' | 'este' | 'oeste',
          width: 1.5,
          height: 1.2,
          pos: 0.0,
          line: lineNum,
        };
        continue;
      }

      if (inDoorBlock) {
        if (trimmed.includes('ancho =')) inDoorBlock.width = parseFloat(trimmed.replace(/[^0-9.]/g, '')) || 0.9;
        if (trimmed.includes('alto =')) inDoorBlock.height = parseFloat(trimmed.replace(/[^0-9.]/g, '')) || 2.1;
        if (trimmed.includes('posicion =')) {
          const matchPos = trimmed.match(/posicion\s*=\s*(-?[0-9.]+)/);
          if (matchPos) inDoorBlock.pos = parseFloat(matchPos[1]);
        }
        if (trimmed.includes('}')) {
          if (currentRoom) {
            const doorObj: DoorModel = {
              id: `door-${currentRoom.doors.length + 1}`,
              wall: inDoorBlock.wall,
              position: inDoorBlock.pos,
              width: inDoorBlock.width,
              height: inDoorBlock.height,
              sourceRef: { file: targetFile.name, line: inDoorBlock.line, column: 1 },
            };
            currentRoom.doors.push(doorObj);
          }
          inDoorBlock = null;
        }
        continue;
      }

      if (inWindowBlock) {
        if (trimmed.includes('ancho =')) inWindowBlock.width = parseFloat(trimmed.replace(/[^0-9.]/g, '')) || 1.5;
        if (trimmed.includes('alto =')) inWindowBlock.height = parseFloat(trimmed.replace(/[^0-9.]/g, '')) || 1.2;
        if (trimmed.includes('posicion =')) {
          const matchPos = trimmed.match(/posicion\s*=\s*(-?[0-9.]+)/);
          if (matchPos) inWindowBlock.pos = parseFloat(matchPos[1]);
        }
        if (trimmed.includes('}')) {
          if (currentRoom) {
            const winObj: WindowModel = {
              id: `win-${currentRoom.windows.length + 1}`,
              wall: inWindowBlock.wall,
              position: inWindowBlock.pos,
              width: inWindowBlock.width,
              height: inWindowBlock.height,
              sourceRef: { file: targetFile.name, line: inWindowBlock.line, column: 1 },
            };
            currentRoom.windows.push(winObj);
          }
          inWindowBlock = null;
        }
        continue;
      }

      // 10. Furniture Placement: colocar sofa en [0.0, 0.0, -1.0]>>
      const placeMatch = trimmed.match(LUMI_PATTERNS.placeObj);
      if (placeMatch && currentRoom) {
        if (!trimmed.endsWith('>>') && !trimmed.endsWith(';')) {
          diagnostics.push(
            MockDiagnosticFactory.missingTerminator(
              compilationId,
              targetFile.name,
              lineNum,
              trimmed.length,
              `en la instrucción "colocar ${placeMatch[1]}"`
            )
          );
        }

        const objType = placeMatch[1].toLowerCase();
        const parseCoord = (coordStr: string) => {
          const c = coordStr.trim();
          if (variables[c] !== undefined && typeof variables[c] === 'number') {
            return variables[c] as number;
          }
          return parseFloat(c) || 0.0;
        };

        const posX = parseCoord(placeMatch[2]);
        const posY = parseCoord(placeMatch[3]);
        const posZ = parseCoord(placeMatch[4]);

        const dims = STANDARD_FURNITURE_DIMS[objType] || [1.0, 0.8, 1.0];
        const objId = `${objType}-${currentRoom.objects.length + 1}`;

        const newObj: SpatialObject = {
          id: objId,
          type: objType,
          name: placeMatch[1],
          position: [posX, posY, posZ],
          rotation: [0, 0, 0],
          dimensions: dims,
          sourceRef: { file: targetFile.name, line: lineNum, column: 1 },
          roomId: currentRoom.id,
        };

        // Spatial validations (bounds, collisions, door clearance)
        MockScenePlanFactory.validateSpatialPlacements(
          newObj,
          currentRoom,
          targetFile.name,
          lineNum,
          compilationId,
          diagnostics
        );

        currentRoom.objects.push(newObj);

        const hasErr = newObj.hasCollision || newObj.isOutOfBounds;
        const eventType = hasErr ? 'spatial_error' : 'place_object';
        const assistantMsg = newObj.isOutOfBounds
          ? 'Aquí aparece el problema espacial: fuera de límites.'
          : newObj.hasCollision
          ? 'Este objeto necesita revisión: colisión detectada.'
          : undefined;

        debugSteps.push({
          id: `step-${debugSteps.length + 1}`,
          stepIndex: debugSteps.length + 1,
          eventType,
          description: `Colocado '${newObj.name}' en [${posX.toFixed(1)}, ${posY.toFixed(1)}, ${posZ.toFixed(1)}]`,
          sourceRef: { file: targetFile.name, line: lineNum, column: 1 },
          roomId: currentRoom.id,
          activeObjectId: objId,
          assistantMessage: assistantMsg,
          lineNumber: lineNum,
          codeLine: trimmed,
          actionDescription: `Colocado '${newObj.name}' en [${posX.toFixed(1)}, ${posY.toFixed(1)}, ${posZ.toFixed(1)}]`,
          sceneSnapshot: createSnapshot(),
        });
        continue;
      }

      // 11. Console outputs: mostrar(...)>>
      const printMatch = trimmed.match(LUMI_PATTERNS.printStmt);
      if (printMatch) {
        const rawContent = printMatch[1];
        if (rawContent.includes('+')) {
          const parts = rawContent.split('+').map((p) => p.trim());
          const strPart = parts[0].replace(/['"]/g, '');
          const varKey = parts[1];
          const val =
            variables[varKey] !== undefined ? variables[varKey] : currentRoom ? currentRoom.calculatedArea : '';
          logs.push(`${strPart}${val}`);
        } else {
          logs.push(rawContent.replace(/['"]/g, ''));
        }
        continue;
      }

      // 12. Visualizar3D call: visualizar3D(sala)>>
      if (LUMI_PATTERNS.visualize3D.test(trimmed)) {
        const targetRoomName = trimmed.replace(/^visualizar3D\s*\(\s*|\s*\).*/g, '');
        logs.push(`visualizar3D(${targetRoomName}) -> ScenePlan v1.0 generado exitosamente.`);
        continue;
      }
    }

    // 13. Brace balance check
    if (openBraces !== 0) {
      diagnostics.push(
        MockDiagnosticFactory.unclosedBraces(
          compilationId,
          targetFile.name,
          lines.length,
          Math.abs(openBraces),
          openBraces > 0 ? '{' : '}'
        )
      );
    }

    const finalScenePlan: ScenePlan | null = createSnapshot();
    const hasBlockingErrors = diagnostics.some((d) => d.blocking === true);
    const spatialDiagnostics = diagnostics.filter((d) => d.category === 'espacial');

    const status: 'blocked' | 'completed' | 'completed_with_spatial_issues' = hasBlockingErrors
      ? 'blocked'
      : spatialDiagnostics.length > 0
      ? 'completed_with_spatial_issues'
      : 'completed';

    if (rooms.length > 0 && logs.length === 0) {
      const primary = rooms[0];
      logs.push(`Área calculada (${primary.name}): ${primary.calculatedArea.toFixed(1)} m²`);
      logs.push(`Volumen calculado (${primary.name}): ${primary.calculatedVolume.toFixed(1)} m³`);
    }

    if (hasBlockingErrors) {
      logs.push(`Compilación bloqueada: Se encontraron ${diagnostics.filter((d) => d.blocking).length} error(es) crítico(s).`);
    } else if (spatialDiagnostics.length > 0) {
      logs.push(`Compilación completada: ScenePlan generado con ${spatialDiagnostics.length} problema(s) espacial(es).`);
    } else {
      logs.push(`Compilación completada exitosamente: ScenePlan listo para visualización 3D.`);
    }

    return {
      status,
      scenePlan: hasBlockingErrors ? null : finalScenePlan,
      diagnostics,
      logs,
      debugSteps: hasBlockingErrors ? [] : debugSteps,
      success: !hasBlockingErrors,
    };
  }
}
