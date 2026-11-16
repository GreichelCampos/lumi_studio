import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SplashScreen } from '../../components/SplashScreen';

describe('SplashScreen', () => {
  it('shows the official application logo instead of the mascot', () => {
    render(<SplashScreen />);
    expect(screen.getByRole('main', { name: 'Iniciando Lumi Studio' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { name: 'LUMI STUDIO' })).toBeInTheDocument();
    expect(screen.getByText('Iniciando Lumi Studio...')).toBeInTheDocument();
    const logo = screen.getByRole('img', { name: 'Logotipo oficial de Lumi Studio' });
    expect(logo).toHaveAttribute('src', expect.stringContaining('lumi-taskbar.png'));
    expect(screen.queryByTitle('Lumi (COMPILING)')).not.toBeInTheDocument();
  });
});

