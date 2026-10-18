import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWindowControls } from '../../hooks/useWindowControls';

afterEach(() => { delete window.lumiWindow; });

describe('desktop window controls', () => {
  it('keeps browser mode independent of Electron', () => {
    const { result } = renderHook(useWindowControls);
    expect(result.current.available).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('tracks native maximize changes, invokes only controls and unsubscribes', async () => {
    let notify: (value: boolean) => void = () => {};
    const unsubscribe = vi.fn();
    const bridge = {
      minimize: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
      toggleMaximize: vi.fn().mockResolvedValue(true), isMaximized: vi.fn().mockResolvedValue(false),
      onMaximizedChange: vi.fn((listener) => { notify = listener; return unsubscribe; }),
    };
    window.lumiWindow = bridge;
    const { result, unmount } = renderHook(useWindowControls);
    await act(async () => {});
    act(() => notify(true));
    expect(result.current.maximized).toBe(true);
    for (const operation of ['minimize', 'toggleMaximize', 'close'] as const) {
      await act(() => result.current.control(operation));
      expect(bridge[operation]).toHaveBeenCalledOnce();
    }
    unmount(); expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('reports IPC failures without an unhandled rejection', async () => {
    window.lumiWindow = {
      minimize: vi.fn().mockRejectedValue(new Error('denied')), close: vi.fn(), toggleMaximize: vi.fn(),
      isMaximized: vi.fn().mockRejectedValue(new Error('denied')), onMaximizedChange: () => () => {},
    };
    const { result } = renderHook(useWindowControls);
    await waitFor(() => expect(result.current.error).toContain('consultar'));
    await act(() => result.current.control('minimize'));
    expect(result.current.error).toContain('controlar');
  });
});
