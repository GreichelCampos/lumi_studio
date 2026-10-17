import { useState, useCallback, useMemo } from 'react';
import { Breakpoint } from '../types';

export function useEditorState(activeFileName?: string) {
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [breakpointsMap, setBreakpointsMap] = useState<Breakpoint[]>([]);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);

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
    breakpoints: activeBreakpoints,
    allBreakpoints: breakpointsMap,
    toggleBreakpoint,
    activeObjectId,
    setActiveObjectId,
    clearHighlight,
  };
}
