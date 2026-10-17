import React, { useState, useRef, useEffect } from 'react';
import { LumiFile } from '../types';
import { useIdeSettings } from '../context/IdeSettingsContext';
import { renderHighlightedLine } from './editor/LumiSyntaxHighlighter';
import { EditorTabBar } from './editor/EditorTabBar';
import { 
  Copy, 
  Check, 
  Save, 
  Sparkles, 
  FilePlus,
  Compass
} from 'lucide-react';

interface CodeEditorProps {
  files: LumiFile[];
  activeFileId: string | null;
  openTabIds: string[];
  onSelectFile: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewFile: () => void;
  onCodeChange: (fileId: string, newContent: string) => void;
  onSaveFile?: (fileId?: string) => void;
  onSaveAll?: () => void;
  isDirty?: (fileId: string) => boolean;
  getFileContent?: (file: LumiFile) => string;
  highlightedLine?: number | null;
  errorLines?: number[];
  warningLines?: number[];
  breakpoints?: number[];
  onToggleBreakpoint?: (line: number) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  files,
  activeFileId,
  openTabIds,
  onSelectFile,
  onCloseTab,
  onNewFile,
  onCodeChange,
  onSaveFile,
  onSaveAll,
  isDirty,
  getFileContent,
  highlightedLine = null,
  errorLines = [],
  warningLines = [],
  breakpoints = [],
  onToggleBreakpoint,
}) => {
  const activeFile = files.find((f) => f.id === activeFileId) || null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const { settings } = useIdeSettings();
  const lineHeightPx = Math.round(settings.fontSize * 1.55);

  const currentContent = activeFile
    ? getFileContent
      ? getFileContent(activeFile)
      : activeFile.content
    : '';

  const lines = currentContent ? currentContent.split('\n') : [];
  const currentFileIsDirty = activeFile && isDirty ? isDirty(activeFile.id) : false;

  useEffect(() => {
    if (settings.autoSave === 'off' || !activeFile || !currentFileIsDirty || !onSaveFile) return;
    const intervalMs = settings.autoSave === '30s' ? 30000 : 60000;
    const timer = setInterval(() => {
      onSaveFile(activeFile.id);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [settings.autoSave, activeFile, currentFileIsDirty, onSaveFile]);

  // Sincronización precisa de scroll entre el textarea, el coloreado sintáctico y los números de línea
  const syncScroll = () => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollLeft } = textareaRef.current;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  const handleScroll = () => {
    syncScroll();
  };

  // Mantener scroll sincronizado al cambiar de archivo o modificar el contenido
  useEffect(() => {
    syncScroll();
  }, [activeFileId, currentContent]);

  // Auto-scroll to highlightedLine when focused from diagnostic
  useEffect(() => {
    if (highlightedLine !== null && textareaRef.current) {
      const lineHeight = lineHeightPx;
      const targetScrollTop = Math.max(0, (highlightedLine - 3) * lineHeight);
      if (typeof textareaRef.current.scrollTo === 'function') {
        textareaRef.current.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      } else {
        textareaRef.current.scrollTop = targetScrollTop;
      }
      syncScroll();

      const linesArray = currentContent.split('\n');
      let charIndex = 0;
      for (let i = 0; i < Math.min(highlightedLine - 1, linesArray.length); i++) {
        charIndex += linesArray[i].length + 1;
      }
      try {
        textareaRef.current.setSelectionRange(charIndex, charIndex + (linesArray[highlightedLine - 1]?.length || 0));
        textareaRef.current.focus();
        setCursorPos({ line: highlightedLine, col: 1 });
      } catch (err) {
      }
    }
  }, [highlightedLine, currentContent, lineHeightPx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          if (onSaveAll) onSaveAll();
        } else {
          if (onSaveFile && activeFileId) onSaveFile(activeFileId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSaveFile, onSaveAll, activeFileId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeFile) return;
    onCodeChange(activeFile.id, e.target.value);
  };

  const handleCursorMove = () => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value.substring(0, textareaRef.current.selectionStart);
    const lineCount = text.split('\n').length;
    const lastLineLength = text.split('\n').pop()?.length || 0;
    setCursorPos({ line: lineCount, col: lastLineLength + 1 });
  };

  const copyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="code-editor-panel"
      className="relative w-full h-full flex flex-col glass-panel shadow-2xl overflow-hidden select-none"
    >
      <EditorTabBar
        files={files}
        openTabIds={openTabIds}
        activeFileId={activeFileId}
        onSelectFile={onSelectFile}
        onCloseTab={onCloseTab}
        onNewFile={onNewFile}
        isDirty={isDirty}
        actions={
          <>
            {onSaveFile && activeFile && (
              <button
                onClick={() => onSaveFile(activeFile.id)}
                disabled={!currentFileIsDirty}
                className={`relative p-1.5 rounded-xl glass-btn transition-all ${
                  currentFileIsDirty
                    ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-text)] border border-[var(--ide-btn-border)] hover:brightness-110 shadow-sm cursor-pointer'
                    : 'text-[var(--ide-text-muted)]/40 opacity-40 cursor-default border border-transparent'
                }`}
                title={currentFileIsDirty ? "Guardar archivo (Ctrl+S) - Hay cambios sin guardar" : "Guardado (sin cambios)"}
              >
                <Save className="w-3.5 h-3.5 text-[var(--ide-accent)]" />
                {currentFileIsDirty && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                )}
              </button>
            )}

            {activeFile && (
              <button
                onClick={copyCode}
                className="p-1.5 rounded-xl glass-btn text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                title="Copiar código fuente"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </>
        }
      />

      {!activeFile ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-transparent space-y-4">
          <div className="w-16 h-16 rounded-2xl glass-card border border-[var(--ide-panel-border)] flex items-center justify-center text-[var(--ide-text)] shadow-xl">
            <Compass className="w-8 h-8 text-[var(--ide-accent)]" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-sm font-bold text-[var(--ide-text)]">No hay ningún archivo abierto</h3>
            <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">
              Selecciona un archivo <code className="text-[var(--ide-accent)] font-mono">.lumi</code> en el explorador lateral o crea un nuevo módulo para comenzar a editar.
            </p>
          </div>
          <button
            onClick={onNewFile}
            className="px-4 py-2 rounded-xl bg-[var(--ide-accent)] hover:brightness-110 text-[var(--ide-accent-text,#02110c)] font-bold text-xs shadow-lg transition-all flex items-center gap-1.5"
          >
            <FilePlus className="w-4 h-4" />
            <span>Crear Archivo</span>
          </button>
        </div>
      ) : (
        <div 
          className="relative flex-1 flex overflow-hidden font-mono"
          style={{ fontFamily: settings.fontFamily }}
        >
          {settings.lineNumbers && (
            <div
              ref={lineNumbersRef}
              className="w-12 bg-[var(--ide-control-bg,rgba(0,0,0,0.1))] border-r border-[var(--ide-panel-border)] flex flex-col items-end py-3 pr-2 text-[var(--ide-text-muted)] select-none flex-shrink-0 overflow-hidden"
              style={{ fontSize: `${settings.fontSize}px` }}
            >
              {lines.map((_, idx) => {
                const lineNum = idx + 1;
                const hasBreakpoint = breakpoints.includes(lineNum);
                const isError = errorLines.includes(lineNum);
                const isWarning = warningLines.includes(lineNum);
                const isCurrentExec = highlightedLine === lineNum;

                return (
                  <div
                    key={idx}
                    onClick={() => onToggleBreakpoint && onToggleBreakpoint(lineNum)}
                    style={{ height: `${lineHeightPx}px`, lineHeight: `${lineHeightPx}px` }}
                    className={`w-full flex items-center justify-between px-1 cursor-pointer transition-colors ${
                      isCurrentExec
                        ? 'bg-[var(--ide-btn-bg)] text-[var(--ide-accent)] font-bold border-l-2 border-[var(--ide-accent)] shadow-inner'
                        : isError
                        ? 'bg-rose-950/60 text-rose-400 font-bold'
                        : isWarning
                        ? 'bg-amber-950/60 text-amber-400 font-bold'
                        : 'hover:text-[var(--ide-text)]'
                    }`}
                    title={hasBreakpoint ? `Punto de interrupción en línea ${lineNum}` : `Clic para fijar punto de interrupción en línea ${lineNum}`}
                  >
                    <div className="w-3 h-3 flex items-center justify-center">
                      {isCurrentExec ? (
                        <span className="text-[10px] text-[var(--ide-accent)] font-bold">▶</span>
                      ) : hasBreakpoint ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
                      ) : null}
                    </div>
                    <span>{lineNum}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative flex-1 h-full overflow-hidden bg-[var(--ide-panel-solid,rgba(0,0,0,0.1))]">
            <div
              ref={highlightRef}
              style={{ 
                fontSize: `${settings.fontSize}px`, 
                lineHeight: `${lineHeightPx}px`,
                fontFamily: settings.fontFamily 
              }}
              className={`absolute inset-0 py-3 px-3 pointer-events-none font-mono z-0 overflow-hidden ${
                settings.wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
              }`}
            >
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                const isCurrentExec = highlightedLine === lineNum;
                const isError = errorLines.includes(lineNum);
                const isWarning = warningLines.includes(lineNum);

                return (
                  <div
                    key={idx}
                    style={{ height: `${lineHeightPx}px`, lineHeight: `${lineHeightPx}px` }}
                    className={`px-1 rounded transition-colors ${
                      isCurrentExec
                        ? 'bg-[var(--ide-btn-bg,#1a422f)]/60 ring-1 ring-[var(--ide-accent,#f3ebd6)]/60'
                        : isError
                        ? 'bg-rose-950/40'
                        : isWarning
                        ? 'bg-amber-950/30'
                        : ''
                    }`}
                  >
                    {renderHighlightedLine(line)}
                  </div>
                );
              })}
            </div>

            {/* Editable Transparent Overlay Textarea - The SINGLE authoritative scrollbar */}
            <textarea
              ref={textareaRef}
              value={currentContent}
              onChange={handleTextChange}
              onKeyUp={handleCursorMove}
              onClick={handleCursorMove}
              onScroll={handleScroll}
              spellCheck={false}
              aria-label={`Editor de código fuente: ${activeFile?.name || 'sin archivo'}`}
              style={{ 
                fontSize: `${settings.fontSize}px`, 
                lineHeight: `${lineHeightPx}px`,
                fontFamily: settings.fontFamily,
                tabSize: settings.tabSize 
              }}
              className={`absolute inset-0 py-3 px-4 w-full h-full bg-transparent text-transparent caret-[var(--ide-accent,#f3ebd6)] font-mono resize-none outline-none z-10 overflow-y-auto overflow-x-auto ${
                settings.wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
              }`}
            />
          </div>
        </div>
      )}

      {activeFile && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--ide-control-bg,rgba(0,0,0,0.15))] border-t border-[var(--ide-panel-border)] text-[11px] text-[var(--ide-text-muted)] font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[var(--ide-text)] drop-shadow-[0_0_6px_var(--ide-accent-bg)] font-semibold">
              <Sparkles className="w-3 h-3 text-[var(--ide-accent)]" />
              <span>Lumi 1.0</span>
            </span>
            <span className="text-[var(--ide-panel-border)]">|</span>
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span className="text-[var(--ide-panel-border)]">|</span>
            <span>{lines.length} líneas</span>
          </div>

          <div className="flex items-center gap-3">
            {currentFileIsDirty ? (
              <span className="text-amber-400 flex items-center gap-1 font-sans font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Modificado (Ctrl+S para guardar)
              </span>
            ) : (
              <span className="text-emerald-400 font-sans font-medium">Guardado</span>
            )}
            <span className="text-[var(--ide-panel-border)]">|</span>
            <span>UTF-8</span>
          </div>
        </div>
      )}
    </div>
  );
};
