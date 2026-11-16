import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import type { DebugStep, LumiFile, LumiProject } from '../../types';
import { createMockDebugSteps, createMockFile, createMockProject } from '../fixtures/testFixtures';
import type { ViewportSelection, ViewportWindowBridge, ViewportWindowState } from '../../viewportBridge';

const state = vi.hoisted(() => ({
  project: null as LumiProject | null,
  steps: [] as DebugStep[],
  runCompile: vi.fn(),
  runExecute: vi.fn(),
}));

let viewportSelectionListener: ((selection: ViewportSelection) => void) | null = null;
const viewportBridge = {
  show: vi.fn(async (_state: ViewportWindowState) => undefined),
  update: vi.fn((_state: ViewportWindowState) => undefined),
  clear: vi.fn(),
  onState: vi.fn(() => () => undefined),
  selectObject: vi.fn(),
  onObjectSelected: vi.fn((listener: (selection: ViewportSelection) => void) => {
    viewportSelectionListener = listener;
    return () => { if (viewportSelectionListener === listener) viewportSelectionListener = null; };
  }),
} satisfies ViewportWindowBridge;

vi.mock('../../hooks/useProjectManager', async () => {
  const { useState } = await import('react');
  return { useProjectManager: () => {
    const [activeFileId, select] = useState('main');
    const [tabs, setTabs] = useState(['main']);
    return {
      currentProject: state.project, currentProjectId: state.project?.id,
      projects: state.project ? [state.project] : [], legacyProjects: [],
      activeFileId, activeFile: state.project?.files.find(file => file.id === activeFileId),
      entryFile: state.project?.files[0], openTabIds: tabs, isLoaded: true,
      projectRevision: 1, isDirty: () => false, dirtyCount: 0,
      getFileContent: (file: LumiFile) => file.content,
      handleSelectFile: (id: string) => { select(id); setTabs(previous => previous.includes(id) ? previous : [...previous, id]); },
    };
  } };
});
vi.mock('../../hooks/useCompiler', async () => {
  const { useState } = await import('react');
  return { useCompiler: () => {
    const [scenePlan, setScenePlan] = useState(state.steps[0]?.sceneSnapshot ?? null);
    return { scenePlan, setScenePlan, sceneSource: 'artifact', debugSteps: state.steps,
      diagnostics: [], logs: [], lastCompileResult: null, isRealBackend: true,
      lastCompiledRevision: null, isCompiling: false, lumiState: 'ready',
      runCompile: state.runCompile, runExecute: state.runExecute };
  } };
});
vi.mock('../../components/TopBar', () => ({ TopBar: (props: { onCompile(): void; onRun(): void }) => <>
  <button onClick={props.onCompile}>Compilar prueba</button>
  <button onClick={props.onRun}>Ejecutar prueba</button>
</> }));
vi.mock('../../components/ProjectExplorer', () => ({ ProjectExplorer: () => null }));
vi.mock('../../components/modals/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('../../components/DocumentationModal', () => ({ DocumentationModal: () => null }));
vi.mock('../../components/CodeEditor', () => ({ CodeEditor: (props: {
  activeFileId: string; openTabIds: string[]; highlightedLine: number | null;
  onSelectFile(id: string): void;
  sourceNavigation: { fileId: string; line: number; column?: number } | null;
}) => <><output data-testid="editor">{JSON.stringify(props)}</output>
  <button onClick={() => props.onSelectFile('other')}>Activar archivo secundario</button></> }));
vi.mock('../../components/ConsolePanel', () => ({ ConsolePanel: (props: {
  onStepChange(index: number): void; currentStepIndex: number;
}) => <button onClick={() => props.onStepChange(props.currentStepIndex + 1)}>Siguiente fixture</button> }));

const editor = () => JSON.parse(screen.getByTestId('editor').textContent!);

beforeEach(() => {
  state.project = createMockProject({ files: [
    createMockFile({ id: 'main' }),
    createMockFile({ id: 'other', name: 'other.lumi', path: 'ProyectoTest/lib/other.lumi' }),
  ] });
  state.steps = createMockDebugSteps().map((step, index) => ({
    ...step, sourceRef: { file: index === 0 ? 'principal.lumi' : 'lib/other.lumi', line: index + 1, column: 2 },
  }));
  state.runCompile.mockReset();
  state.runExecute.mockReset();
  viewportBridge.show.mockClear();
  viewportBridge.update.mockClear();
  viewportBridge.clear.mockClear();
  viewportSelectionListener = null;
  window.lumiViewport = viewportBridge;
});

describe('App explicit compiler operations', () => {
  it('does not analyze when a restored project mounts, changes, rerenders, or mounts under StrictMode', () => {
    const view = render(<React.StrictMode><App /></React.StrictMode>);
    expect(state.runCompile).not.toHaveBeenCalled();
    expect(state.runExecute).not.toHaveBeenCalled();

    state.project = createMockProject({ id: 'second-project' });
    view.rerender(<React.StrictMode><App /></React.StrictMode>);
    expect(state.runCompile).not.toHaveBeenCalled();
    expect(state.runExecute).not.toHaveBeenCalled();
  });

  it('runs exactly one analysis for Compilar/F5 and one execution for Ejecutar/F6', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Compilar prueba'));
    expect(state.runCompile).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'F5' });
    expect(state.runCompile).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText('Ejecutar prueba'));
    expect(state.runExecute).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'F6' });
    expect(state.runExecute).toHaveBeenCalledTimes(2);
  });

  it('does not override the project main file when the active editor changes', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Activar archivo secundario'));

    fireEvent.click(screen.getByText('Ejecutar prueba'));
    expect(state.runExecute).toHaveBeenLastCalledWith(expect.anything(), 1);

    fireEvent.keyDown(window, { key: 'F6' });
    expect(state.runExecute).toHaveBeenLastCalledWith(expect.anything(), 1);
    expect(state.runExecute).toHaveBeenCalledTimes(2);
  });

  it('starts every valid execution with a new session and no previous selection', async () => {
    const scenePlan = state.steps[0].sceneSnapshot!;
    state.runExecute.mockResolvedValue({
      compilationId: 'execution', status: 'completed', success: true, diagnostics: [], scenePlan,
      entryFileInfo: null, durationMs: 1, logs: [], debugSteps: [], timestamp: new Date(0).toISOString(),
    });
    render(<App />);

    fireEvent.click(screen.getByText('Ejecutar prueba'));
    await waitFor(() => expect(viewportBridge.show).toHaveBeenCalledTimes(1));
    const first = viewportBridge.show.mock.calls[0][0];
    expect(first.activeObjectId).toBeNull();

    act(() => viewportSelectionListener?.({ sessionId: first.sessionId, objectId: 'obj-mesa-1' }));
    await waitFor(() => expect(viewportBridge.update).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: first.sessionId, activeObjectId: 'obj-mesa-1',
    })));

    fireEvent.click(screen.getByText('Ejecutar prueba'));
    await waitFor(() => expect(viewportBridge.show).toHaveBeenCalledTimes(2));
    const second = viewportBridge.show.mock.calls[1][0];
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.activeObjectId).toBeNull();

    act(() => viewportSelectionListener?.({ sessionId: first.sessionId, objectId: 'obj-mesa-1' }));
    expect(viewportBridge.update).not.toHaveBeenLastCalledWith(expect.objectContaining({
      sessionId: second.sessionId, activeObjectId: 'obj-mesa-1',
    }));
  });
});

describe('App navigation with imported fixture events, not Python traces', () => {
  it('opens the other tab and synchronizes source, snapshot and spatial selection', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Siguiente fixture'));
    expect(editor()).toMatchObject({ activeFileId: 'other', openTabIds: ['main', 'other'], highlightedLine: 2,
      sourceNavigation: { fileId: 'other', line: 2, column: 2 } });
    fireEvent.click(screen.getByText('Siguiente fixture'));
  });

  it('clears invalid source, missing snapshot and entity without opening a path', () => {
    state.steps[1] = { ...state.steps[1], sourceRef: { file: '../outside.lumi', line: 1 },
      sceneSnapshot: undefined } as unknown as DebugStep;
    render(<App />);
    fireEvent.click(screen.getByText('Siguiente fixture'));
    expect(editor()).toMatchObject({ activeFileId: 'main', openTabIds: ['main'], highlightedLine: null, sourceNavigation: null });
  });

  it('clears highlights on empty events and never selects an old index from a replacement', () => {
    const view = render(<App />);
    fireEvent.click(screen.getByText('Siguiente fixture'));
    const replacement = { ...state.steps[0], id: 'replacement', sourceRef: { file: 'principal.lumi', line: 3 } };
    state.steps = [replacement];
    act(() => view.rerender(<App />));
    expect(editor()).toMatchObject({ activeFileId: 'main', highlightedLine: 3 });
    state.steps = [];
    act(() => view.rerender(<App />));
    expect(editor()).toMatchObject({ highlightedLine: null, sourceNavigation: null });
  });
});
