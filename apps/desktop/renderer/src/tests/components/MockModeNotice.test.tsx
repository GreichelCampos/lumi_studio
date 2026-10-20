import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockModeNotice } from '../../components/MockModeNotice';

describe('MockModeNotice', () => {
  it('identifica las capacidades simuladas y dirige al backend real de Electron', () => {
    render(<MockModeNotice />);

    const notice = screen.getByRole('complementary', { name: 'Modo de demostración' });
    expect(notice).toHaveTextContent('compilador mock');
    expect(notice).toHaveTextContent('depuración simulada');
    expect(notice).toHaveTextContent('Abre Electron para utilizar Python real');
  });
});
