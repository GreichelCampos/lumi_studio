import { useState, useRef, useEffect, useCallback, RefObject } from 'react';

export interface UseEditorTabScrollOptions {
  activeFileId?: string | null;
  openTabCount?: number;
  containerRef?: RefObject<HTMLDivElement | null>;
}

export interface UseEditorTabScrollReturn {
  tabsContainerRef: RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollTabs: (direction: 'left' | 'right') => void;
  checkTabScroll: () => void;
}

/**
 * Hook especializado para gestionar el desplazamiento horizontal,
 * el estado de desbordamiento (flechas izquierda/derecha) y el auto-scroll
 * de la pestaña activa en la barra de pestañas del editor.
 */
export function useEditorTabScroll({
  activeFileId,
  openTabCount = 0,
  containerRef,
}: UseEditorTabScrollOptions = {}): UseEditorTabScrollReturn {
  const internalRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = containerRef || internalRef;

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Monitorear y calcular si hay pestañas desbordadas para mostrar flechas de navegación
  const checkTabScroll = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, [tabsContainerRef]);

  const scrollTabs = useCallback(
    (direction: 'left' | 'right') => {
      const el = tabsContainerRef.current;
      if (!el) return;
      const delta = direction === 'left' ? -180 : 180;
      if (typeof el.scrollBy === 'function') {
        el.scrollBy({ left: delta, behavior: 'smooth' });
      } else {
        el.scrollLeft += delta;
      }
      setTimeout(checkTabScroll, 250);
    },
    [tabsContainerRef, checkTabScroll]
  );

  // Auto-scroll para que la pestaña activa siempre sea visible al cambiar de archivo
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const activeTabEl = el.querySelector<HTMLElement>('[data-active-tab="true"]');
    if (activeTabEl && typeof activeTabEl.scrollIntoView === 'function') {
      activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    checkTabScroll();
  }, [activeFileId, openTabCount, tabsContainerRef, checkTabScroll]);

  // Suscribirse al scroll y cambios de tamaño del contenedor
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    checkTabScroll();
    el.addEventListener('scroll', checkTabScroll);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => checkTabScroll());
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', checkTabScroll);
      if (ro) {
        ro.disconnect();
      }
    };
  }, [openTabCount, tabsContainerRef, checkTabScroll]);

  return {
    tabsContainerRef,
    canScrollLeft,
    canScrollRight,
    scrollTabs,
    checkTabScroll,
  };
}
