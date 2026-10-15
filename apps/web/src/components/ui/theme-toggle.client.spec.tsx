import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './theme-toggle.client';

const labels = { toDark: 'Usar tema escuro', toLight: 'Usar tema claro' };
const html = document.documentElement;

function systemPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches }) as MediaQueryList),
  );
}

// jsdom's cookie getter drops the attributes, so the setter call is the evidence (AC8).
function spyCookieWrites() {
  return vi.spyOn(document, 'cookie', 'set');
}

const COOKIE_ATTRIBUTES = 'Path=/; Max-Age=31536000; SameSite=Lax';

async function clickToggle() {
  // jsdom applies no CSS, so both labels are part of the button's name.
  await userEvent.click(screen.getByRole('button'));
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const name of ['theme', 'notheme', 'xtheme', 'other']) {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
  html.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe('ThemeToggle', () => {
  it('com o tema claro, o clique troca para escuro e grava o cookie', async () => {
    html.setAttribute('data-theme', 'light');
    systemPrefersDark(true);
    render(<ThemeToggle labels={labels} />);
    const cookieWrites = spyCookieWrites();

    await clickToggle();

    expect(html.getAttribute('data-theme')).toBe('dark');
    expect(document.cookie).toBe('theme=dark');
    expect(cookieWrites).toHaveBeenCalledExactlyOnceWith(
      `theme=dark; ${COOKIE_ATTRIBUTES}`,
    );
  });

  it('com o tema escuro, o clique troca para claro e grava o cookie', async () => {
    html.setAttribute('data-theme', 'dark');
    systemPrefersDark(false);
    render(<ThemeToggle labels={labels} />);
    const cookieWrites = spyCookieWrites();

    await clickToggle();

    expect(html.getAttribute('data-theme')).toBe('light');
    expect(document.cookie).toBe('theme=light');
    expect(cookieWrites).toHaveBeenCalledExactlyOnceWith(
      `theme=light; ${COOKIE_ATTRIBUTES}`,
    );
  });

  it.each([
    [true, 'light'],
    [false, 'dark'],
  ] as const)(
    'sem cookie, inverte o tema do sistema (escuro=%s → %s)',
    async (prefersDark, next) => {
      systemPrefersDark(prefersDark);
      render(<ThemeToggle labels={labels} />);
      const cookieWrites = spyCookieWrites();

      await clickToggle();

      expect(html.getAttribute('data-theme')).toBe(next);
      expect(document.cookie).toBe(`theme=${next}`);
      expect(cookieWrites).toHaveBeenCalledExactlyOnceWith(
        `theme=${next}; ${COOKIE_ATTRIBUTES}`,
      );
    },
  );

  it('mostra cada rótulo só no tema certo', () => {
    render(<ThemeToggle labels={labels} />);

    const toDark = screen.getByText(labels.toDark).parentElement;
    const toLight = screen.getByText(labels.toLight).parentElement;
    expect(toDark).toHaveClass('dark:hidden');
    expect(toDark).not.toHaveClass('hidden');
    expect(toLight).toHaveClass('hidden', 'dark:inline-flex');
  });

  it('mostra a lua no estado do tema claro e o sol no do escuro', () => {
    render(<ThemeToggle labels={labels} />);

    const lightState = screen.getByText(labels.toDark).parentElement!;
    const darkState = screen.getByText(labels.toLight).parentElement!;
    expect(lightState.querySelector('svg.lucide-moon')).not.toBeNull();
    expect(lightState.querySelector('svg.lucide-sun')).toBeNull();
    expect(darkState.querySelector('svg.lucide-sun')).not.toBeNull();
    expect(darkState.querySelector('svg.lucide-moon')).toBeNull();
  });

  it('reaplica o tema do cookie no <html> ao montar', () => {
    document.cookie = 'theme=dark; Path=/';
    render(<ThemeToggle labels={labels} />);

    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it.each(['notheme=dark', 'xtheme=dark; other=1'])(
    'cookie de nome parecido (%s): não aplica ao montar e o clique segue o sistema',
    async (cookies) => {
      for (const cookie of cookies.split('; ')) {
        document.cookie = `${cookie}; Path=/`;
      }
      systemPrefersDark(false);
      render(<ThemeToggle labels={labels} />);

      expect(html.hasAttribute('data-theme')).toBe(false);

      await clickToggle();

      // System is light, so the toggle goes dark (it would go light if it read dark).
      expect(html.getAttribute('data-theme')).toBe('dark');
    },
  );

  it('sem cookie válido, não mexe no <html> ao montar', () => {
    document.cookie = 'theme=blue; Path=/';
    render(<ThemeToggle labels={labels} />);

    expect(html.hasAttribute('data-theme')).toBe(false);
  });
});
