import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeEditor } from '../../../components/CodeEditor';
import { IdeSettingsProvider } from '../../../context/IdeSettingsContext';
import { LumiFile } from '../../../types';

describe('CodeEditor y EditorTabBar (Integración)', () => {
  const sampleFiles: LumiFile[] = [
    { id: 'file-1', name: 'main.lumi', path: '/main.lumi', content: 'escena {\n  habitacion Sala\n}', isEntry: true },
    { id: 'file-2', name: 'modulo.lumi', path: '/modulo.lumi', content: 'habitacion Modulo {\n}', isEntry: false },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  const renderEditor = (props: Partial<React.ComponentProps<typeof CodeEditor>> = {}) => {
    const defaultProps: React.ComponentProps<typeof CodeEditor> = {
      files: sampleFiles,
      activeFileId: 'file-1',
      openTabIds: ['file-1', 'file-2'],
      onSelectFile: vi.fn(),
      onCloseTab: vi.fn(),
      onNewFile: vi.fn(),
      onCodeChange: vi.fn(),
      ...props,
    };

    return render(
      <IdeSettingsProvider>
        <CodeEditor {...defaultProps} />
      </IdeSettingsProvider>
    );
  };

  it('renderiza la barra de pestañas integrada con las pestañas de archivos abiertos', () => {
    renderEditor();

    expect(screen.getByText('main.lumi')).toBeInTheDocument();
    expect(screen.getByText('modulo.lumi')).toBeInTheDocument();

    const activeTab = screen.getByTestId('tab-file-1');
    expect(activeTab).toHaveAttribute('data-active-tab', 'true');
  });

  it('permite cambiar el archivo activo mediante click en la pestaña', () => {
    const onSelectFile = vi.fn();
    renderEditor({ onSelectFile });

    const secondTab = screen.getByTestId('tab-file-2');
    fireEvent.click(secondTab);

    expect(onSelectFile).toHaveBeenCalledWith('file-2');
  });

  it('permite cerrar pestañas mediante el botón de cierre integrado en la barra', () => {
    const onCloseTab = vi.fn();
    renderEditor({ onCloseTab });

    const closeBtn = screen.getByRole('button', { name: 'Cerrar pestaña modulo.lumi' });
    fireEvent.click(closeBtn);

    expect(onCloseTab).toHaveBeenCalledWith('file-2');
  });

  it('muestra el indicador de cambios sin guardar en la pestaña correspondiente', () => {
    renderEditor({
      isDirty: (fileId) => fileId === 'file-1',
    });

    expect(screen.getByTestId('dirty-indicator-file-1')).toBeInTheDocument();
    expect(screen.queryByTestId('dirty-indicator-file-2')).not.toBeInTheDocument();
  });

  it('permite crear un nuevo archivo pulsando el botón + de la barra de pestañas', () => {
    const onNewFile = vi.fn();
    renderEditor({ onNewFile });

    const newFileBtn = screen.getByRole('button', { name: 'Crear nuevo archivo .lumi' });
    fireEvent.click(newFileBtn);

    expect(onNewFile).toHaveBeenCalledTimes(1);
  });

  it('muestra el estado vacío cuando activeFileId es nulo', () => {
    renderEditor({
      activeFileId: null,
      openTabIds: [],
    });

    expect(screen.getByText('No hay ningún archivo abierto')).toBeInTheDocument();
  });
});
