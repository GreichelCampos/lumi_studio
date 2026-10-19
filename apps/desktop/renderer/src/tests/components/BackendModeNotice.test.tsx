import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackendModeNotice } from '../../components/BackendModeNotice';

describe('BackendModeNotice', () => {
  it('distinguishes scene generation from pending Python traces', () => {
    render(<BackendModeNotice real refresh={false} />);
    const notice = screen.getByLabelText('Modo Python real');
    expect(notice).toHaveTextContent('Ejecutar puede generar ScenePlan');
    expect(notice).toHaveTextContent('trazas pendientes');
    expect(notice).not.toHaveTextContent('ScenePlan y trazas pendientes');
  });
});
