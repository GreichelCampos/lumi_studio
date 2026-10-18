export * from './types/domain';

export type LumiState = 'ready' | 'compiling' | 'success' | 'warning' | 'error';

export type IdeEventType = 
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'system' 
  | 'compile' 
  | 'run';

export interface IdeLogEvent {
  id: string;
  timestamp: string;
  type: IdeEventType;
  message: string;
  details?: string;
  source?: string;
}
