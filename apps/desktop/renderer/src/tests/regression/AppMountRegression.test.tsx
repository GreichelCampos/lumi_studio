import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { IdeSettingsProvider } from '../../context/IdeSettingsContext';

describe('App Root Mounting and Visibility Regression Test', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the IDE root without throwing uncaught exceptions or rendering a blank screen', async () => {
    const { container } = render(
      <IdeSettingsProvider>
        <App />
      </IdeSettingsProvider>
    );

    expect(screen.getByText('Studio LUMI')).toBeInTheDocument();

    const compileButtons = screen.getAllByText(/Compilar/i);
    expect(compileButtons.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Salida')).toBeInTheDocument();
    expect(screen.getByText('Diagnósticos')).toBeInTheDocument();
    expect(screen.getByText('Depurador Espacial')).toBeInTheDocument();

    const projectExplorer = container.querySelector('#project-explorer') || screen.getAllByText(/PROYECTO/i)[0];
    expect(projectExplorer).toBeInTheDocument();

    const viewportMain = container.querySelector('#viewport-3d-main');
    expect(viewportMain).toBeInTheDocument();

    const lumiCompanion = screen.getByLabelText('Asistente Lumi');
    expect(lumiCompanion).toBeInTheDocument();

    await waitFor(() => {
      const fileElements = screen.getAllByText('principal.lumi');
      expect(fileElements.length).toBeGreaterThanOrEqual(1);
    });

    expect(container.innerHTML.length).toBeGreaterThan(1000);
  });
});
