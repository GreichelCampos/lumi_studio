import { DiagnosticCategory, DiagnosticItem, DiagnosticSeverity } from '../../types';

export interface DiagnosticFilterOptions {
  severity?: 'all' | DiagnosticSeverity;
  category?: 'all' | DiagnosticCategory;
  search?: string;
}

export interface DiagnosticCountSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  blocking: number;
  spatial: number;
}

/**
 * Calculates counts for diagnostics categorized by severity and blocking status.
 */
export function calculateDiagnosticCounts(diagnostics: DiagnosticItem[]): DiagnosticCountSummary {
  let errors = 0;
  let warnings = 0;
  let info = 0;
  let blocking = 0;
  let spatial = 0;

  for (const d of diagnostics) {
    if (d.severity === 'error') {
      errors++;
    } else if (d.severity === 'warning') {
      warnings++;
    } else if (d.severity === 'info') {
      info++;
    }

    if (d.blocking) {
      blocking++;
    }

    if (d.category === 'espacial') {
      spatial++;
    }
  }

  return {
    total: diagnostics.length,
    errors,
    warnings,
    info,
    blocking,
    spatial,
  };
}

/**
 * Filters a list of diagnostics according to severity, category, and optional search text.
 * Preserves the original order of the diagnostics.
 */
export function filterDiagnostics(
  diagnostics: DiagnosticItem[],
  options: DiagnosticFilterOptions
): DiagnosticItem[] {
  const { severity = 'all', category = 'all', search } = options;
  const searchLower = search ? search.trim().toLowerCase() : '';

  return diagnostics.filter((diag) => {
    if (severity !== 'all' && diag.severity !== severity) {
      return false;
    }

    if (category !== 'all' && diag.category !== category) {
      return false;
    }

    if (searchLower) {
      const matchText = `${diag.code} ${diag.description} ${diag.file} ${diag.solution || ''}`.toLowerCase();
      if (!matchText.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Returns the object ID associated with a diagnostic (targetObjectId or objectId alias).
 */
export function getDiagnosticObjectId(diag: DiagnosticItem): string | undefined {
  return diag.targetObjectId || diag.objectId;
}

/**
 * Returns formatted location string e.g. "archivo.lumi:12:4"
 */
export function formatDiagnosticLocation(diag: DiagnosticItem): string {
  return `${diag.file}:${diag.line}:${diag.column}`;
}
