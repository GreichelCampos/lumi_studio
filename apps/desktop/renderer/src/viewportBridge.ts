import type { ScenePlan } from './types';

export interface ViewportWindowState {
  sessionId: string;
  scenePlan: ScenePlan;
  sceneSource: 'simulation' | 'artifact' | 'python' | null;
  legacyPlacement: boolean;
  activeObjectId: string | null;
  debugActiveObjectId: string | null;
  debugRoomId: string | null;
}

export interface ViewportSelection {
  sessionId: string;
  objectId: string | null;
}

export interface ViewportWindowBridge {
  show(state: ViewportWindowState): Promise<void>;
  update(state: ViewportWindowState): void;
  clear(): void;
  onState(listener: (state: ViewportWindowState) => void): () => void;
  selectObject(selection: ViewportSelection): void;
  onObjectSelected(listener: (selection: ViewportSelection) => void): () => void;
}

declare global {
  interface Window { lumiViewport?: ViewportWindowBridge }
}
