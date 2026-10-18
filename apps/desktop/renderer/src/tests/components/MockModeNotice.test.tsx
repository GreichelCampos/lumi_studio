import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockModeNotice } from '../../components/MockModeNotice';

describe('MockModeNotice', () => {
  it('identifica las capacidades simuladas y la integración pendiente', () => {
    render(<MockModeNotice />);

    const notice = screen.getByRole('complementary', { name: 'Modo de demostración' });
    expect(notice).toHaveTextContent('compilador mock');
    expect(notice).toHaveTextContent('depuración simulada');
    expect(notice).toHaveTextContent('Integración con Python pendiente');
  });
});
