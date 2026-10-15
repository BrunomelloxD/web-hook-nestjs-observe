import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('renderiza com as variantes padrão', () => {
    render(<Button>Salvar</Button>);

    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toHaveAttribute('data-slot', 'button');
    expect(button.className).toContain('bg-primary');
  });

  it('aplica variante, tamanho e classes extras', () => {
    render(
      <Button variant="destructive" size="sm" className="extra">
        Excluir
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Excluir' });
    expect(button.className).toContain('text-destructive');
    expect(button.className).toContain('h-7');
    expect(button.className).toContain('extra');
  });

  it('dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ok</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Ok' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('buttonVariants gera as classes para outros elementos (ex.: links)', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border-border');
  });
});
