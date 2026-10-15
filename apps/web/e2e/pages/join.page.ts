import { expect, type Locator, type Page } from '@playwright/test';
import { chatDictionary as t } from '../../src/features/chat/chat.dictionary';

export class JoinPage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: t.join.title });
    this.nameInput = page.getByLabel(t.join.name, { exact: true });
    this.submitButton = page.getByRole('button', { name: t.join.submit });
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  async join(name: string) {
    await this.nameInput.fill(name);
    await this.submitButton.click();
  }

  fieldError(text: string): Locator {
    return this.page.locator('#join-name-error').filter({ hasText: text });
  }
}
