import successFixture from './compilationSuccessWithScenePlan.json';
import blockingFixture from './compilationWithBlockingErrors.json';
import spatialIssuesFixture from './compilationWithSpatialIssues.json';
import multiStepDebugFixture from './compilationWithMultiStepDebug.json';
import malformedFixture from './malformedCompilationResponse.json';
import sampleLumicFixture from './sampleLumicArtifact.json';
import { CompileResult, LumiCompiledArtifact } from '../../types';

export const FIXTURE_COMPILATION_SUCCESS = successFixture as unknown as CompileResult;
export const FIXTURE_COMPILATION_BLOCKING = blockingFixture as unknown as CompileResult;
export const FIXTURE_COMPILATION_SPATIAL_ISSUES = spatialIssuesFixture as unknown as CompileResult;
export const FIXTURE_COMPILATION_MULTI_STEP = multiStepDebugFixture as unknown as CompileResult;
export const FIXTURE_COMPILATION_MALFORMED = malformedFixture as unknown as Record<string, unknown>;
export const FIXTURE_LUMIC_ARTIFACT = sampleLumicFixture as unknown as LumiCompiledArtifact;

export const CONTRACT_FIXTURES_JSON = {
  success: JSON.stringify(successFixture, null, 2),
  blocking: JSON.stringify(blockingFixture, null, 2),
  spatialIssues: JSON.stringify(spatialIssuesFixture, null, 2),
  multiStepDebug: JSON.stringify(multiStepDebugFixture, null, 2),
  malformed: JSON.stringify(malformedFixture, null, 2),
  sampleLumic: JSON.stringify(sampleLumicFixture, null, 2),
};
