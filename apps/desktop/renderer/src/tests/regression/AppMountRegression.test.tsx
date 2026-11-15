import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import App, { MIN_SPLASH_DURATION_MS } from '../../App';
import { IdeSettingsProvider } from '../../context/IdeSettingsContext';

describe('App Root Mounting and Visibility Regression Test', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete window.lumiStartup;
  });

  it('keeps the complete splash until Electron startup is ready', async () => {
    let finishStartup!: () => void;
    const whenReady = new Promise<void>(resolve => { finishStartup = resolve; });
    const presentSplash = vi.fn().mockResolvedValue(undefined);
    window.lumiStartup = { presentSplash, whenReady: () => whenReady };
    const startedAt = performance.now();

    render(<IdeSettingsProvider><App /></IdeSettingsProvider>);
    expect(screen.getByRole('heading', { name: 'ESTUDIO LUMI' })).toBeInTheDocument();
    await waitFor(() => expect(presentSplash).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Studio LUMI')).not.toBeInTheDocument();

    await act(async () => { finishStartup(); });
    expect(screen.getByRole('heading', { name: 'ESTUDIO LUMI' })).toBeInTheDocument();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 500)); });
    expect(screen.queryByText('Studio LUMI')).not.toBeInTheDocument();
    expect(await screen.findByText('Studio LUMI', {}, { timeout: MIN_SPLASH_DURATION_MS + 500 })).toBeInTheDocument();
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(MIN_SPLASH_DURATION_MS - 25);
  });

  it('renders the IDE root without throwing uncaught exceptions or rendering a blank screen', async () => {
    const { container } = render(
      <IdeSettingsProvider>
        <App />
      </IdeSettingsProvider>
    );

    expect(screen.getByRole('heading', { name: 'ESTUDIO LUMI' })).toBeInTheDocument();
    expect(await screen.findByText('Studio LUMI')).toBeInTheDocument();

    const compileButtons = screen.getAllByText(/Compilar/i);
    expect(compileButtons.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Salida')).toBeInTheDocument();
    expect(screen.getByText('Diagnósticos')).toBeInTheDocument();
    expect(screen.getByText('Depurador Espacial')).toBeInTheDocument();

    const projectExplorer = container.querySelector('#project-explorer') || screen.getAllByText(/PROYECTO/i)[0];
    expect(projectExplorer).toBeInTheDocument();

    expect(container.querySelector('#viewport-3d-main')).not.toBeInTheDocument();

    const lumiCompanion = screen.getByLabelText('Asistente Lumi');
    expect(lumiCompanion).toBeInTheDocument();

    await waitFor(() => {
      const fileElements = screen.getAllByText('principal.lumi');
      expect(fileElements.length).toBeGreaterThanOrEqual(1);
    });

    expect(container.innerHTML.length).toBeGreaterThan(1000);
  });
});
