export type DiagnosticCategory =
  | 'lexico'
  | 'sintactico'
  | 'semantico'
  | 'importacion'
  | 'ejecucion'
  | 'espacial';

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'unspecified';

export interface SourceReference {
  file: string;
  line: number;
  column?: number;
}

export interface DiagnosticItem {
  id: string;
  code: string; // e.g. 'LUMI-E101', 'LUMI-W301'
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  blocking: boolean;
  file: string;
  line: number;
  column: number;
  description: string;
  solution?: string;
  targetObjectId?: string;
  targetRoomId?: string;
  objectId?: string; // alias for targetObjectId
  roomId?: string; // alias for targetRoomId
  sourceRef?: SourceReference;
}
