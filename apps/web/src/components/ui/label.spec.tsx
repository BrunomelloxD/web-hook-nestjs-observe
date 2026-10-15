import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label', () => {
  it('associa o rótulo ao campo', () => {
    render(
      <>
        <Label htmlFor="campo" className="extra">
          Nome
        </Label>
        <input id="campo" />
      </>,
    );

    expect(screen.getByLabelText('Nome')).toBe(
      document.getElementById('campo'),
    );
    expect(screen.getByText('Nome')).toHaveClass('extra');
  });
});
