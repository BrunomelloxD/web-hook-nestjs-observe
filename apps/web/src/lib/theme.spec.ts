import {
  parseTheme,
  readEffectiveTheme,
  serializeThemeCookie,
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
} from './theme';

const html = document.documentElement;

function setCookie(value: string) {
  document.cookie = `${THEME_COOKIE}=${value}; Path=/`;
}

function clearCookie() {
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
}

function runInitScript() {
  // Runs it the way the browser does: as an inline <script> in <head>.
  const script = document.createElement('script');
  script.textContent = THEME_INIT_SCRIPT;
  document.head.append(script);
  script.remove();
}

function mediaQuery(matches: boolean) {
  return vi.fn(() => ({ matches }) as MediaQueryList);
}

const LOOK_ALIKE_COOKIES = ['notheme=dark', 'xtheme=dark; other=1'];

function setCookies(cookies: string) {
  for (const cookie of cookies.split('; '))
    document.cookie = `${cookie}; Path=/`;
}

afterEach(() => {
  clearCookie();
  for (const name of ['notheme', 'xtheme', 'other']) {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
  html.removeAttribute('data-theme');
});

describe('parseTheme', () => {
  it.each(['light', 'dark'] as const)('aceita %s', (value) => {
    expect(parseTheme(value)).toBe(value);
  });

  it.each([undefined, '', 'DARK', 'blue'])('%j vira null', (value) => {
    expect(parseTheme(value)).toBeNull();
  });
});

describe('serializeThemeCookie', () => {
  it('grava o tema por 1 ano em todo o site', () => {
    expect(serializeThemeCookie('dark')).toBe(
      'theme=dark; Path=/; Max-Age=31536000; SameSite=Lax',
    );
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it.each(['dark', 'light'])('cookie theme=%s aplica data-theme', (value) => {
    setCookie(value);

    runInitScript();

    expect(html.getAttribute('data-theme')).toBe(value);
  });

  it('sem cookie, não aplica data-theme', () => {
    runInitScript();

    expect(html.hasAttribute('data-theme')).toBe(false);
  });

  it.each(['blue', 'DARK', ''])(
    'cookie inválido %j é tratado como ausente',
    (value) => {
      setCookie(value);

      runInitScript();

      expect(html.hasAttribute('data-theme')).toBe(false);
    },
  );

  it.each(LOOK_ALIKE_COOKIES)(
    'cookie de nome parecido (%s) não conta como theme',
    (cookies) => {
      setCookies(cookies);

      runInitScript();

      expect(html.hasAttribute('data-theme')).toBe(false);
    },
  );
});

describe('readEffectiveTheme', () => {
  it.each(['light', 'dark'] as const)(
    'usa o data-theme %s quando existe, sem olhar o sistema',
    (theme) => {
      html.setAttribute('data-theme', theme);
      const matchMedia = mediaQuery(theme === 'light');

      expect(readEffectiveTheme(document, matchMedia)).toBe(theme);
    },
  );

  it.each([
    [true, 'dark'],
    [false, 'light'],
  ] as const)(
    'sem data-theme, segue o sistema (dark=%s → %s)',
    (matches, expected) => {
      const matchMedia = mediaQuery(matches);

      expect(readEffectiveTheme(document, matchMedia)).toBe(expected);
      expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    },
  );
});
