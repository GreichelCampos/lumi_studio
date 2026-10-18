import { SourceReference } from './diagnostics';
import { ScenePlan } from './spatial';

export type DebugEventType =
  | 'start'
  | 'declaration'
  | 'assignment'
  | 'condition'
  | 'loop'
  | 'room_create'
  | 'place_object'
  | 'move_object'
  | 'rotate_object'
  | 'spatial_warning'
  | 'spatial_error'
  | 'end';

export interface Breakpoint {
  file: string;
  line: number;
}

export type DebuggerStatus = 'idle' | 'ready' | 'running' | 'paused' | 'finished';

export type PlaybackSpeed = 0.5 | 1 | 2;

export interface DebugStep {
  id: string;
  stepIndex: number;
  eventType: DebugEventType;
  description: string;
  sourceRef: SourceReference;
  roomId?: string;
  activeObjectId?: string;
  spatialState?: Record<string, unknown>;
  assistantMessage?: string;
  lineNumber: number; // backward-compatibility alias for sourceRef.line
  codeLine: string;
  actionDescription: string; // backward-compatibility alias for description
  sceneSnapshot: ScenePlan;
}
