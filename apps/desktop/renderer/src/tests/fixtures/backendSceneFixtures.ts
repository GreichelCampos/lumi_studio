import type { Operation, ResultResponse } from '../../services/integration/protocol/types';
import { createMockFile, createMockProject, createMockRoom, createMockScenePlan } from './testFixtures';

export function backendSceneFixture(requestId = 'fixture-scene', operation: Operation = 'analyze'): ResultResponse {
  return {
    protocolVersion: '1.0.0', requestId, operation, status: 'completed',
    result: {
      entryFile: 'principal.lumi', analysisStatus: 'completed', stage: 'semantic',
      output: [], diagnostics: [], limitations: [], executionAttempted: operation === 'execute',
      capabilities: { scenePlan: true, debugTrace: false, interactiveInput: false, cancellation: false },
      scenePlan: createMockScenePlan({ rooms: [createMockRoom({
        name: `Fixture ${requestId}`, objects: [], doors: [], windows: [],
      })] }),
    },
  };
}

export function backendSceneProject() {
  return createMockProject({ files: [createMockFile({ content: 'principal { habitacion sala(5, 4, 2.7) {} }' })] });
}
