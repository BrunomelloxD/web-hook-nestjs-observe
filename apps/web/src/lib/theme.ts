export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'theme';

const ONE_YEAR_IN_SECONDS = 31536000;

/** Anything other than `light` or `dark` counts as no preference. */
export function parseTheme(value: string | null | undefined): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function serializeThemeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}

// Runs in <head> before first paint (AD-001); keep it ES5 and self-contained.
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var t=m&&m[1];if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readEffectiveTheme(
  doc: Document,
  matchMedia: (query: string) => MediaQueryList,
): Theme {
  const applied = parseTheme(doc.documentElement.getAttribute('data-theme'));
  if (applied) return applied;

  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
