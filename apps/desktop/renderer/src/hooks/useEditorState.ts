import { useState, useCallback, useMemo, useEffect, type SetStateAction } from 'react';
import { Breakpoint } from '../types';
import type { SourceNavigation } from '../services/editor/sourceNavigation';

export function useEditorState(activeFileName?: string, scopeKey = '') {
  const [highlightedLine, setLine] = useState<number | null>(null);
  const [sourceNavigation, setSourceNavigation] = useState<SourceNavigation | null>(null);
  const [breakpointsMap, setBreakpointsMap] = useState<Breakpoint[]>([]);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);

  useEffect(() => {
    setLine(null);
    setSourceNavigation(null);
  }, [scopeKey]);

  const setHighlightedLine = useCallback((value: SetStateAction<number | null>) => {
    setSourceNavigation(null);
    setLine(value);
  }, []);

  const navigateToLocation = useCallback((fileId: string, line: number, column?: number) => {
    setLine(line);
    setSourceNavigation({ fileId, line, column });
  }, []);

  const toggleBreakpoint = useCallback((line: number, file?: string) => {
    const targetFile = file || activeFileName || '';
    setBreakpointsMap((prev) => {
      const exists = prev.some((bp) => bp.line === line && (bp.file === targetFile || !targetFile || !bp.file));
      if (exists) {
        return prev.filter((bp) => !(bp.line === line && (bp.file === targetFile || !targetFile || !bp.file)));
      } else {
        return [...prev, { line, file: targetFile }];
      }
    });
  }, [activeFileName]);

  // Backward compatible number[] list for the current active file
  const activeBreakpoints = useMemo<number[]>(() => {
    return breakpointsMap
      .filter((bp) => !activeFileName || !bp.file || bp.file === activeFileName)
      .map((bp) => bp.line);
  }, [breakpointsMap, activeFileName]);

  const clearHighlight = useCallback(() => {
    setHighlightedLine(null);
  }, []);

  return {
    highlightedLine,
    setHighlightedLine,
    sourceNavigation,
    navigateToLocation,
    breakpoints: activeBreakpoints,
    allBreakpoints: breakpointsMap,
    toggleBreakpoint,
    activeObjectId,
    setActiveObjectId,
    clearHighlight,
  };
}
