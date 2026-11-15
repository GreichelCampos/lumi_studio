import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SplashScreen } from '../../components/SplashScreen';

describe('SplashScreen', () => {
  it('shows the official application logo instead of the mascot', () => {
    render(<SplashScreen />);
    expect(screen.getByRole('main', { name: 'Iniciando Estudio Lumi' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { name: 'ESTUDIO LUMI' })).toBeInTheDocument();
    expect(screen.getByText('Iniciando Estudio Lumi...')).toBeInTheDocument();
    const logo = screen.getByRole('img', { name: 'Logotipo oficial de Estudio Lumi' });
    expect(logo).toHaveAttribute('src', expect.stringContaining('lumi-taskbar.png'));
    expect(screen.queryByTitle('Lumi (COMPILING)')).not.toBeInTheDocument();
  });
});

