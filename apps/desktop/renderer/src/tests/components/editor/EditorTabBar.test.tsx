import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorTabBar } from '../../../components/editor/EditorTabBar';
import { LumiFile } from '../../../types';

describe('EditorTabBar (componente modular de pestañas)', () => {
  const sampleFiles: LumiFile[] = [
    { id: 'file-1', name: 'main.lumi', path: '/main.lumi', content: 'escena { }', isEntry: true },
    { id: 'file-2', name: 'sala.lumi', path: '/sala.lumi', content: 'habitacion Sala { }', isEntry: false },
    { id: 'file-3', name: 'cocina.lumi', path: '/cocina.lumi', content: 'habitacion Cocina { }', isEntry: false },
    { id: 'file-4', name: 'patio.lumi', path: '/patio.lumi', content: 'habitacion Patio { }', isEntry: false },
  ];

  it('1. Renderizado de pestañas abiertas: debe mostrar los nombres de los archivos abiertos', () => {
    render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-1', 'file-2']}
        activeFileId="file-1"
        onSelectFile={vi.fn()}
        onCloseTab={vi.fn()}
        onNewFile={vi.fn()}
      />
    );

    expect(screen.getByText('main.lumi')).toBeInTheDocument();
    expect(screen.getByText('sala.lumi')).toBeInTheDocument();
    expect(screen.queryByText('cocina.lumi')).not.toBeInTheDocument();
  });

  it('2. Selección de la pestaña activa: debe marcar correctamente el atributo data-active-tab y activar callbacks', () => {
    const handleSelectFile = vi.fn();
    render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-1', 'file-2']}
        activeFileId="file-2"
        onSelectFile={handleSelectFile}
        onCloseTab={vi.fn()}
        onNewFile={vi.fn()}
      />
    );

    const tab1 = screen.getByTestId('tab-file-1');
    const tab2 = screen.getByTestId('tab-file-2');

    expect(tab1).toHaveAttribute('data-active-tab', 'false');
    expect(tab2).toHaveAttribute('data-active-tab', 'true');
    expect(tab2.className).toContain('glass-tab-active');

    fireEvent.click(tab1);
    expect(handleSelectFile).toHaveBeenCalledWith('file-1');
  });

  it('3. Cierre de pestañas: debe llamar a onCloseTab con el id correcto sin disparar onSelectFile', () => {
    const handleSelectFile = vi.fn();
    const handleCloseTab = vi.fn();

    render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-1', 'file-2']}
        activeFileId="file-1"
        onSelectFile={handleSelectFile}
        onCloseTab={handleCloseTab}
        onNewFile={vi.fn()}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Cerrar pestaña main.lumi' });
    fireEvent.click(closeBtn);

    expect(handleCloseTab).toHaveBeenCalledWith('file-1');
    expect(handleSelectFile).not.toHaveBeenCalled();
  });

  it('4. Visualización de cambios sin guardar: muestra el indicador ámbar cuando el archivo tiene cambios', () => {
    const dirtyFiles = new Set(['file-2']);

    render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-1', 'file-2']}
        activeFileId="file-1"
        onSelectFile={vi.fn()}
        onCloseTab={vi.fn()}
        onNewFile={vi.fn()}
        isDirty={(id) => dirtyFiles.has(id)}
      />
    );

    expect(screen.queryByTestId('dirty-indicator-file-1')).not.toBeInTheDocument();
    const dirtyIndicator = screen.getByTestId('dirty-indicator-file-2');
    expect(dirtyIndicator).toBeInTheDocument();
    expect(dirtyIndicator).toHaveAttribute('title', 'Archivo con cambios sin guardar');
  });

  it('5. Conservación del orden: renderiza las pestañas en el orden estricto de openTabIds', () => {
    const { rerender } = render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-3', 'file-1', 'file-2']}
        activeFileId="file-3"
        onSelectFile={vi.fn()}
        onCloseTab={vi.fn()}
        onNewFile={vi.fn()}
      />
    );

    let tabs = screen.getAllByTestId(/^tab-/);
    expect(tabs[0]).toHaveTextContent('cocina.lumi');
    expect(tabs[1]).toHaveTextContent('main.lumi');
    expect(tabs[2]).toHaveTextContent('sala.lumi');

    // Cambiar orden inverso
    rerender(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-2', 'file-1', 'file-3']}
        activeFileId="file-2"
        onSelectFile={vi.fn()}
        onCloseTab={vi.fn()}
        onNewFile={vi.fn()}
      />
    );

    tabs = screen.getAllByTestId(/^tab-/);
    expect(tabs[0]).toHaveTextContent('sala.lumi');
    expect(tabs[1]).toHaveTextContent('main.lumi');
    expect(tabs[2]).toHaveTextContent('cocina.lumi');
  });

  it('6. Insignia de archivo principal: muestra el ícono de estrella para el archivo de entrada', () => {
    render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-1', 'file-2']}
        activeFileId="file-1"
        onSelectFile={vi.fn()}
        onCloseTab={vi.fn()}
        onNewFile={vi.fn()}
      />
    );

    const starIcon = screen.getByTitle('Archivo Principal');
    expect(starIcon).toBeInTheDocument();
  });

  it('7. Integración con botón de nuevo archivo: dispara onNewFile al pulsar el botón +', () => {
    const handleNewFile = vi.fn();
    render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-1']}
        activeFileId="file-1"
        onSelectFile={vi.fn()}
        onCloseTab={vi.fn()}
        onNewFile={handleNewFile}
      />
    );

    const newFileBtn = screen.getByRole('button', { name: 'Crear nuevo archivo .lumi' });
    fireEvent.click(newFileBtn);

    expect(handleNewFile).toHaveBeenCalledTimes(1);
  });

  it('8. Renderizado de acciones personalizadas: respeta el slot de actions', () => {
    render(
      <EditorTabBar
        files={sampleFiles}
        openTabIds={['file-1']}
        activeFileId="file-1"
        onSelectFile={vi.fn()}
        onCloseTab={vi.fn()}
        onNewFile={vi.fn()}
        actions={<button data-testid="custom-action-btn">Acción Extra</button>}
      />
    );

    expect(screen.getByTestId('custom-action-btn')).toBeInTheDocument();
  });
});
