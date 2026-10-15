import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  it('repassa props e aceita digitação', async () => {
    render(<Input aria-label="Nome" type="text" className="extra" />);

    const input = screen.getByRole('textbox', { name: 'Nome' });
    await userEvent.type(input, 'abc');

    expect(input).toHaveValue('abc');
    expect(input).toHaveAttribute('data-slot', 'input');
    expect(input.className).toContain('extra');
  });
});
