import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

// PRD 8.2 with the 4 AA adjustments, plus the avatar pairs from the design.
const TOKENS: Record<string, { light: string; dark: string }> = {
  '--bg-page': { light: '#F4F6FB', dark: '#0B1020' },
  '--bg-surface': { light: '#FFFFFF', dark: '#151B2E' },
  '--bg-subtle': { light: '#F9FAFB', dark: '#1C2438' },
  '--border-default': { light: '#E5E7EB', dark: '#2A3350' },
  '--text-primary': { light: '#111827', dark: '#F3F4F6' },
  '--text-secondary': { light: '#687080', dark: '#9CA3AF' },
  '--text-muted': { light: '#68707F', dark: '#7C8597' },
  '--text-button': { light: '#374151', dark: '#D1D5DB' },
  '--brand-default': { light: '#4F46E5', dark: '#5B5EF0' },
  '--brand-soft': { light: '#EEF2FF', dark: '#1E1B4B' },
  '--brand-text': { light: '#4F46E5', dark: '#A5B4FC' },
  '--brand-ring': { light: '#4F46E526', dark: '#6366F14D' },
  '--text-on-brand': { light: '#FFFFFF', dark: '#FFFFFF' },
  '--status-online': { light: '#10B981', dark: '#34D399' },
  '--shadow-card': { light: '#1118270F', dark: '#00000066' },
  '--avatar-pink-bg': { light: '#FCE7F3', dark: '#500724' },
  '--avatar-pink-fg': { light: '#BE185D', dark: '#F9A8D4' },
  '--avatar-green-bg': { light: '#DCFCE7', dark: '#052E16' },
  '--avatar-green-fg': { light: '#15803D', dark: '#86EFAC' },
};

function block(pattern: RegExp): Record<string, string> {
  const body = css.match(pattern)?.[1];
  if (body === undefined) throw new Error(`Bloco não encontrado: ${pattern}`);

  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value!.trim().toUpperCase(),
    ]),
  );
}

// Anchored at the start of a line, so the nested selectors of @custom-variant don't match.
const SELECTORS = {
  ':root': block(/^:root \{([^}]*)\}/m),
  "[data-theme='dark']": block(/^\[data-theme='dark'\] \{([^}]*)\}/m),
  '@media (prefers-color-scheme: dark) :root:not([data-theme])': block(
    /^@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme\]\) \{([^}]*)\}/m,
  ),
};

const THEMES = {
  light: SELECTORS[':root'],
  dark: SELECTORS["[data-theme='dark']"],
};

describe('tokens de cor em globals.css', () => {
  describe.each(Object.entries(TOKENS))('%s', (name, expected) => {
    it('tem o valor Light em :root', () => {
      expect(SELECTORS[':root'][name]).toBe(expected.light);
    });

    it("tem o valor Dark em [data-theme='dark']", () => {
      expect(SELECTORS["[data-theme='dark']"][name]).toBe(expected.dark);
    });

    it('tem o valor Dark em :root:not([data-theme]) sob prefers-color-scheme: dark', () => {
      expect(
        SELECTORS[
          '@media (prefers-color-scheme: dark) :root:not([data-theme])'
        ][name],
      ).toBe(expected.dark);
    });
  });

  it('não usa mais a classe .dark do shadcn', () => {
    expect(css).not.toMatch(/^\.dark\b/m);
    expect(css).not.toContain('.dark *');
  });

  it('o variant dark segue data-theme e o sistema', () => {
    const variant = css.match(/@custom-variant dark \{([\s\S]*?)\n\}/)?.[1];

    expect(variant).toContain("[data-theme='dark']");
    expect(variant).toMatch(
      /@media \(prefers-color-scheme: dark\)[\s\S]*:root:not\(\[data-theme\]\)/,
    );
  });

  it.each([
    ['--background', 'var(--bg-page)'],
    ['--foreground', 'var(--text-primary)'],
    ['--card', 'var(--bg-surface)'],
    ['--primary', 'var(--brand-default)'],
    ['--primary-foreground', 'var(--text-on-brand)'],
    ['--muted-foreground', 'var(--text-secondary)'],
    ['--border', 'var(--border-default)'],
    ['--input', 'var(--border-default)'],
    ['--ring', 'var(--brand-default)'],
  ])('a variável do shadcn %s aponta para %s', (name, value) => {
    expect(SELECTORS[':root'][name]).toBe(value.toUpperCase());
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('contraste WCAG AA (≥ 4.5:1)', () => {
  // Text token → backgrounds it is drawn on (PRD 8.2 "Uso").
  const PAIRS: [string, string[]][] = [
    ['--text-primary', ['--bg-page', '--bg-surface', '--bg-subtle']],
    ['--text-secondary', ['--bg-page', '--bg-surface']],
    ['--text-muted', ['--bg-page', '--bg-surface']],
    ['--text-on-brand', ['--brand-default']],
  ];

  describe.each(Object.entries(THEMES))('tema %s', (_theme, vars) => {
    it.each(PAIRS.flatMap(([fg, bgs]) => bgs.map((bg) => [fg, bg] as const)))(
      '%s sobre %s',
      (fg, bg) => {
        expect(contrast(vars[fg]!, vars[bg]!)).toBeGreaterThanOrEqual(4.5);
      },
    );
  });
});
