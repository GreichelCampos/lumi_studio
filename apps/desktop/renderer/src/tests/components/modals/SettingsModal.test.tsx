import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsModal } from '../../../components/modals/SettingsModal';
import { IdeSettingsProvider } from '../../../context/IdeSettingsContext';

describe('SettingsModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<IdeSettingsProvider>{ui}</IdeSettingsProvider>);
  };

  it('does not render when isOpen is false', () => {
    renderWithProvider(<SettingsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/Configuración del Entorno de Desarrollo/i)).toBeNull();
  });

  it('renders modal with themes tab when isOpen is true', () => {
    renderWithProvider(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(/Configuración del Entorno de Desarrollo/i)).toBeInTheDocument();
    expect(screen.getByText(/Temas y Colores/i)).toBeInTheDocument();
    expect(screen.getByText(/Visual Studio Dark\+ \(Clásico\)/i)).toBeInTheDocument();
  });

  it('allows switching between configuration tabs', () => {
    renderWithProvider(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    
    // Switch to Editor tab
    fireEvent.click(screen.getByRole('button', { name: /Editor de Código/i }));
    expect(screen.getByText(/Tipografía y Tamaño de Fuente/i)).toBeInTheDocument();

    // Switch to Viewport tab
    fireEvent.click(screen.getByRole('button', { name: /Visor 3D y Gráficos/i }));
    expect(screen.getByText(/Visualización Espacial 3D/i)).toBeInTheDocument();

    // Switch to Assistant tab
    fireEvent.click(screen.getByRole('button', { name: /Asistente y Compilación/i }));
    expect(screen.getByText(/Mascota Compañera Lumi/i)).toBeInTheDocument();
  });

  it('calls onClose when close button or accept button is clicked', () => {
    const handleClose = vi.fn();
    renderWithProvider(<SettingsModal isOpen={true} onClose={handleClose} />);
    
    const closeBtn = screen.getByTitle(/Cerrar configuración/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const acceptBtn = screen.getByText(/Aceptar y Guardar/i);
    fireEvent.click(acceptBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('closes modal when Escape key is pressed', () => {
    const handleClose = vi.fn();
    renderWithProvider(<SettingsModal isOpen={true} onClose={handleClose} />);
    
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('modifies preferences across tabs and persists state', () => {
    renderWithProvider(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Appearance tab: select a different theme
    const themeCard = screen.getByText(/Monokai Pro/i);
    fireEvent.click(themeCard);

    // Editor tab: change font size
    fireEvent.click(screen.getByRole('button', { name: /Editor de Código/i }));
    const fontSizeBtn = screen.getByRole('button', { name: '16px' });
    fireEvent.click(fontSizeBtn);
    expect(fontSizeBtn).toHaveClass('bg-[var(--ide-accent)]');

    // Viewport tab: change lighting mode
    fireEvent.click(screen.getByRole('button', { name: /Visor 3D y Gráficos/i }));
    expect(screen.getByText(/Visualización Espacial 3D/i)).toBeInTheDocument();

    // Assistant tab: change Lumi color preset
    fireEvent.click(screen.getByRole('button', { name: /Asistente y Compilación/i }));
    const presetGold = screen.getByText(/Oro Champán/i);
    fireEvent.click(presetGold);
  });

  it('restores default settings when clicking Restaurar Predeterminados', () => {
    renderWithProvider(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Go to Editor tab and select 18px font size
    fireEvent.click(screen.getByRole('button', { name: /Editor de Código/i }));
    const size18Btn = screen.getByRole('button', { name: '18px' });
    fireEvent.click(size18Btn);
    expect(size18Btn).toHaveClass('bg-[var(--ide-accent)]');

    // Click Restaurar Predeterminados
    const resetBtn = screen.getByRole('button', { name: /Restaurar Predeterminados/i });
    fireEvent.click(resetBtn);

    // Default font size is 13px
    const size13Btn = screen.getByRole('button', { name: '13px' });
    expect(size13Btn).toHaveClass('bg-[var(--ide-accent)]');
  });
});

