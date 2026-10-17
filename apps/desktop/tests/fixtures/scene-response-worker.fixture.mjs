import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const artifact = JSON.parse(await readFile(new URL('../../../../docs/contracts/lumic/v1.0.0/examples/valid-basic.lumic', import.meta.url), 'utf8'));
const mode = process.argv[2];
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  const result = {
    entryFile: request.entryFile, analysisStatus: 'completed', stage: 'semantic',
    output: [], diagnostics: [], limitations: [], executionAttempted: request.operation === 'execute',
    capabilities: { scenePlan: mode !== 'absent', debugTrace: false, interactiveInput: false, cancellation: false },
  };
  if (mode !== 'absent') {
    result.scenePlan = structuredClone(artifact.scenePlan);
    result.scenePlan.rooms[0].name = 'Fixture de transporte; no generado por Python';
    if (mode === 'invalid') result.scenePlan.rooms[0].dimensions[0] = 0;
  }
  process.stdout.write(JSON.stringify({ protocolVersion: '1.0.0', requestId: request.requestId,
    operation: request.operation, status: 'completed', result }) + '\n');
}
