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

    // 1. Verify TopBar with title and branding is mounted
    expect(screen.getByText('Studio LUMI')).toBeInTheDocument();

    // 2. Verify Compilation actions are present
    const compileButtons = screen.getAllByText(/Compilar/i);
    expect(compileButtons.length).toBeGreaterThanOrEqual(1);

    // 3. Verify Console tabs are mounted
    expect(screen.getByText('Salida')).toBeInTheDocument();
    expect(screen.getByText('Diagnósticos')).toBeInTheDocument();
    expect(screen.getByText('Depurador Espacial')).toBeInTheDocument();

    // 4. Verify Project Explorer is mounted
    const projectExplorer = container.querySelector('#project-explorer') || screen.getAllByText(/PROYECTO/i)[0];
    expect(projectExplorer).toBeInTheDocument();

    // 5. Verify Viewport 3D container is mounted
    const viewportMain = container.querySelector('#viewport-3d-main');
    expect(viewportMain).toBeInTheDocument();

    // 6. Verify Lumi Mascot container is mounted
    const lumiCompanion = screen.getByLabelText('Asistente Lumi');
    expect(lumiCompanion).toBeInTheDocument();

    // 7. Wait for initial project to load and open default file tabs
    await waitFor(() => {
      const fileElements = screen.getAllByText('principal.lumi');
      expect(fileElements.length).toBeGreaterThanOrEqual(1);
    });

    // 8. Confirm #root element is not empty and has comprehensive DOM structure
    expect(container.innerHTML.length).toBeGreaterThan(1000);
  });
});
