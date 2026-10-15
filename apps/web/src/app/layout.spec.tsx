import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isValidElement, type ReactElement } from 'react';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import RootLayout, { metadata } from './layout';

type Element<P = Record<string, unknown>> = ReactElement<P>;

function renderLayout() {
  // <html> can't render inside RTL's container: assert on the returned tree.
  const html = RootLayout({
    children: <p>conteúdo</p>,
    params: Promise.resolve({}),
  }) as Element<{
    lang: string;
    suppressHydrationWarning?: boolean;
    children: Element<{ children: Element }>[];
  }>;
  const [head, body] = html.props.children;

  return { html, head: head!, body: body! };
}

describe('RootLayout', () => {
  it('define o idioma e envolve o conteúdo no body', () => {
    const { html, body } = renderLayout();

    expect(html.type).toBe('html');
    expect(html.props.lang).toBe('pt-BR');
    expect(body.type).toBe('body');
    expect(isValidElement(body.props.children)).toBe(true);
  });

  it('aceita o data-theme aplicado pelo script antes da hidratação', () => {
    expect(renderLayout().html.props.suppressHydrationWarning).toBe(true);
  });

  it('roda o script de tema no <head>', () => {
    const { head } = renderLayout();
    const script = head.props.children as Element<{
      dangerouslySetInnerHTML: { __html: string };
    }>;

    expect(head.type).toBe('head');
    expect(script.type).toBe('script');
    expect(script.props.dangerouslySetInnerHTML.__html).toBe(THEME_INIT_SCRIPT);
  });

  it('não lê dados da requisição (AD-001)', () => {
    const source = readFileSync(path.join(__dirname, 'layout.tsx'), 'utf8');

    expect(source).not.toContain('next/headers');
  });

  it('usa "Chat" como título e template', () => {
    expect(metadata.title).toEqual({
      default: 'Chat',
      template: '%s | Chat',
    });
  });
});
