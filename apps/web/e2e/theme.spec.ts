import { expect, test, type Page } from '@playwright/test';

// THEME-02: the inline <head> script sets data-theme before first paint.
// DOMContentLoaded fires before React hydrates, so reading the attribute there
// proves the theme doesn't come from client code.
async function themeAtDomContentLoaded(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { themeAtDcl: string | null }).themeAtDcl =
        document.documentElement.getAttribute('data-theme');
    });
  });
  await page.goto('/');
  return page.evaluate(
    () => (window as unknown as { themeAtDcl?: string | null }).themeAtDcl,
  );
}

async function setThemeCookie(page: Page, value: string) {
  await page
    .context()
    .addCookies([
      { name: 'theme', value, url: test.info().project.use.baseURL! },
    ]);
}

test('cookie theme=dark aplica data-theme="dark" antes da hidratação', async ({
  page,
}) => {
  await setThemeCookie(page, 'dark');

  expect(await themeAtDomContentLoaded(page)).toBe('dark');
});

test('cookie theme=light aplica data-theme="light" antes da hidratação', async ({
  page,
}) => {
  await setThemeCookie(page, 'light');

  expect(await themeAtDomContentLoaded(page)).toBe('light');
});

test('sem cookie, o <html> fica sem data-theme', async ({ page }) => {
  expect(await themeAtDomContentLoaded(page)).toBeNull();
});

test('cookie theme=blue é tratado como ausente', async ({ page }) => {
  await setThemeCookie(page, 'blue');

  expect(await themeAtDomContentLoaded(page)).toBeNull();
});
