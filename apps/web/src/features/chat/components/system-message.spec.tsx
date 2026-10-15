import { render, screen } from '@testing-library/react';
import { chatDictionary as t } from '../chat.dictionary';
import { SystemMessage } from './system-message';

describe('SystemMessage', () => {
  it('mostra o texto centralizado, pequeno e na cor discreta', () => {
    render(<SystemMessage text={t.system.joined('Ana')} />);

    const text = screen.getByText('Ana entrou no chat');
    expect(text).toHaveClass('text-center', 'text-sm', 'text-fg-muted');
  });
});
