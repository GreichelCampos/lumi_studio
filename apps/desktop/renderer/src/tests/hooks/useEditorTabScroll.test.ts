import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorTabScroll } from '../../hooks/useEditorTabScroll';

describe('useEditorTabScroll hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('debe inicializarse con estados de scroll en falso', () => {
    const { result } = renderHook(() => useEditorTabScroll({ activeFileId: 'f1', openTabCount: 2 }));

    expect(result.current.canScrollLeft).toBe(false);
    expect(result.current.canScrollRight).toBe(false);
    expect(result.current.tabsContainerRef.current).toBeNull();
  });

  it('debe calcular canScrollLeft y canScrollRight según el desbordamiento del contenedor', () => {
    const { result } = renderHook(() => useEditorTabScroll({ activeFileId: 'f1', openTabCount: 5 }));

    const mockDiv = document.createElement('div');
    Object.defineProperty(mockDiv, 'scrollLeft', { value: 50, writable: true });
    Object.defineProperty(mockDiv, 'scrollWidth', { value: 500, writable: true });
    Object.defineProperty(mockDiv, 'clientWidth', { value: 200, writable: true });

    (result.current.tabsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = mockDiv;

    act(() => {
      result.current.checkTabScroll();
    });

    expect(result.current.canScrollLeft).toBe(true);
    expect(result.current.canScrollRight).toBe(true);

    act(() => {
      Object.defineProperty(mockDiv, 'scrollLeft', { value: 300, writable: true });
      result.current.checkTabScroll();
    });

    expect(result.current.canScrollRight).toBe(false);
  });

  it('debe ejecutar scrollBy en scrollTabs con la dirección correcta', () => {
    const { result } = renderHook(() => useEditorTabScroll({ activeFileId: 'f1', openTabCount: 3 }));

    const mockDiv = document.createElement('div');
    const scrollBySpy = vi.fn();
    mockDiv.scrollBy = scrollBySpy;
    (result.current.tabsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = mockDiv;

    act(() => {
      result.current.scrollTabs('right');
    });

    expect(scrollBySpy).toHaveBeenCalledWith({ left: 180, behavior: 'smooth' });

    act(() => {
      result.current.scrollTabs('left');
    });

    expect(scrollBySpy).toHaveBeenCalledWith({ left: -180, behavior: 'smooth' });
  });

  it('debe auto-desplazar la pestaña activa mediante scrollIntoView', () => {
    const containerDiv = document.createElement('div');
    const tabEl = document.createElement('div');
    tabEl.setAttribute('data-active-tab', 'true');
    const scrollIntoViewSpy = vi.fn();
    tabEl.scrollIntoView = scrollIntoViewSpy;
    containerDiv.appendChild(tabEl);

    const ref = { current: containerDiv };

    renderHook(() =>
      useEditorTabScroll({
        activeFileId: 'f2',
        openTabCount: 2,
        containerRef: ref,
      })
    );

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  });
});
