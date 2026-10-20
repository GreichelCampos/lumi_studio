import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import type { DebugStep, LumiFile, LumiProject } from '../../types';
import { createMockDebugSteps, createMockFile, createMockProject } from '../fixtures/testFixtures';

const state = vi.hoisted(() => ({ project: null as LumiProject | null, steps: [] as DebugStep[] }));

vi.mock('../../hooks/useProjectManager', async () => {
  const { useState } = await import('react');
  return { useProjectManager: () => {
    const [activeFileId, select] = useState('main');
    const [tabs, setTabs] = useState(['main']);
    return {
      currentProject: state.project, currentProjectId: state.project?.id,
      projects: state.project ? [state.project] : [], legacyProjects: [],
      activeFileId, activeFile: state.project?.files.find(file => file.id === activeFileId),
      entryFile: state.project?.files[0], openTabIds: tabs, isLoaded: false,
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
      lastCompiledRevision: null, isCompiling: false, lumiState: 'ready' };
  } };
});
vi.mock('../../components/TopBar', () => ({ TopBar: () => null }));
vi.mock('../../components/ProjectExplorer', () => ({ ProjectExplorer: () => null }));
vi.mock('../../components/modals/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('../../components/DocumentationModal', () => ({ DocumentationModal: () => null }));
vi.mock('../../components/CodeEditor', () => ({ CodeEditor: (props: {
  activeFileId: string; openTabIds: string[]; highlightedLine: number | null;
  sourceNavigation: { fileId: string; line: number; column?: number } | null;
}) => <output data-testid="editor">{JSON.stringify(props)}</output> }));
vi.mock('../../components/Viewport3D', () => ({ Viewport3D: (props: unknown) =>
  <output data-testid="viewport">{JSON.stringify(props)}</output> }));
vi.mock('../../components/ConsolePanel', () => ({ ConsolePanel: (props: {
  onStepChange(index: number): void; currentStepIndex: number;
}) => <button onClick={() => props.onStepChange(props.currentStepIndex + 1)}>Siguiente fixture</button> }));

const editor = () => JSON.parse(screen.getByTestId('editor').textContent!);
const viewport = () => JSON.parse(screen.getByTestId('viewport').textContent!);

beforeEach(() => {
  state.project = createMockProject({ files: [
    createMockFile({ id: 'main' }),
    createMockFile({ id: 'other', name: 'other.lumi', path: 'ProyectoTest/lib/other.lumi' }),
  ] });
  state.steps = createMockDebugSteps().map((step, index) => ({
    ...step, sourceRef: { file: index === 0 ? 'principal.lumi' : 'lib/other.lumi', line: index + 1, column: 2 },
  }));
});

describe('App navigation with imported fixture events, not Python traces', () => {
  it('opens the other tab and synchronizes source, snapshot and spatial selection', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Siguiente fixture'));
    expect(editor()).toMatchObject({ activeFileId: 'other', openTabIds: ['main', 'other'], highlightedLine: 2,
      sourceNavigation: { fileId: 'other', line: 2, column: 2 } });
    expect(viewport().scenePlan).toEqual(state.steps[1].sceneSnapshot);
    expect(viewport().activeObjectId).toBe(state.steps[1].activeObjectId);
    fireEvent.click(screen.getByText('Siguiente fixture'));
    expect(viewport().activeObjectId).toBeNull();
    expect(viewport().debugActiveObjectId).toBeNull();
  });

  it('clears invalid source, missing snapshot and entity without opening a path', () => {
    state.steps[1] = { ...state.steps[1], sourceRef: { file: '../outside.lumi', line: 1 },
      sceneSnapshot: undefined } as unknown as DebugStep;
    render(<App />);
    fireEvent.click(screen.getByText('Siguiente fixture'));
    expect(editor()).toMatchObject({ activeFileId: 'main', openTabIds: ['main'], highlightedLine: null, sourceNavigation: null });
    expect(viewport()).toMatchObject({ scenePlan: null, activeObjectId: null, debugActiveObjectId: null });
  });

  it('clears highlights on empty events and never selects an old index from a replacement', () => {
    const view = render(<App />);
    fireEvent.click(screen.getByText('Siguiente fixture'));
    const replacement = { ...state.steps[0], id: 'replacement', sourceRef: { file: 'principal.lumi', line: 3 } };
    state.steps = [replacement];
    act(() => view.rerender(<App />));
    expect(editor()).toMatchObject({ activeFileId: 'main', highlightedLine: 3 });
    expect(viewport().scenePlan).toEqual(replacement.sceneSnapshot);
    state.steps = [];
    act(() => view.rerender(<App />));
    expect(editor()).toMatchObject({ highlightedLine: null, sourceNavigation: null });
    expect(viewport().activeObjectId).toBeNull();
  });
});
