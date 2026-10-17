import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackendModeNotice } from '../../components/BackendModeNotice';

afterEach(() => { delete window.lumiDesktop; });

describe('Python backend availability notice', () => {
  it('does not claim ScenePlan is unavailable after spatial compilation is supported', async () => {
    window.lumiDesktop = { analyze: vi.fn(), execute: vi.fn(), availability: vi.fn().mockResolvedValue({ available: true, message: 'Proceso Python iniciado.' }) };
    render(<BackendModeNotice real refresh={false} />);
    expect(await screen.findByText(/Proceso Python iniciado/)).toBeInTheDocument();
    expect(screen.queryByText(/ScenePlan y trazas pendientes/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Modo Python real')).toHaveTextContent('Trazas espaciales todavía no disponibles');
  });
});
