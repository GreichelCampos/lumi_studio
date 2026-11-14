import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BackendModeNotice } from '../../components/BackendModeNotice';

describe('BackendModeNotice', () => {
  it('hides the banner when Python is available', async () => {
    vi.stubGlobal('lumiDesktop', { availability: vi.fn().mockResolvedValue({ available: true, message: 'Python iniciado' }) });
    try {
      await act(async () => { render(<BackendModeNotice real refresh={false} />); });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(window.lumiDesktop?.availability).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows a message when Python is unavailable', async () => {
    vi.stubGlobal('lumiDesktop', { availability: vi.fn().mockResolvedValue({ available: false, message: 'Python no disponible' }) });
    try {
      render(<BackendModeNotice real refresh={false} />);
      expect(await screen.findByRole('alert')).toHaveTextContent('Python no disponible');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
