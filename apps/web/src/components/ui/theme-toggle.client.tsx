'use client';

import { Moon, Sun } from 'lucide-react';
import { useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  parseTheme,
  readEffectiveTheme,
  serializeThemeCookie,
  THEME_COOKIE,
  type Theme,
} from '@/lib/theme';

type ThemeToggleProps = {
  /** Texts come from the feature's dictionary: components/ui has no domain. */
  labels: { toDark: string; toLight: string };
};

const COOKIE_PATTERN = new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`);

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeToggle({ labels }: ThemeToggleProps) {
  // Strict Mode's dev remount clears the attribute the inline script set (AD-001).
  useLayoutEffect(() => {
    const saved = parseTheme(document.cookie.match(COOKIE_PATTERN)?.[1]);
    if (saved) applyTheme(saved);
  }, []);

  function toggle() {
    const current = readEffectiveTheme(document, (query) =>
      window.matchMedia(query),
    );
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    document.cookie = serializeThemeCookie(next);
  }

  // Both states are in the HTML and CSS shows one: no state, no hydration mismatch.
  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      <span className="inline-flex dark:hidden">
        <Moon aria-hidden="true" />
        <span className="sr-only">{labels.toDark}</span>
      </span>
      <span className="hidden dark:inline-flex">
        <Sun aria-hidden="true" />
        <span className="sr-only">{labels.toLight}</span>
      </span>
    </Button>
  );
}
