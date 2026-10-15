import { expect, type Locator, type Page } from '@playwright/test';
import { chatDictionary as t } from '../../src/features/chat/chat.dictionary';

export class RoomPage {
  readonly heading: Locator;
  readonly onlineBadge: Locator;
  readonly messages: Locator;
  readonly composer: Locator;
  readonly sendButton: Locator;
  readonly leaveButton: Locator;
  readonly themeToggle: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: t.room.title });
    this.onlineBadge = page.getByText(/^\d+ pessoas? online$/);
    this.messages = page.getByRole('list', { name: t.room.messages });
    this.composer = page.getByPlaceholder(t.composer.placeholder);
    this.sendButton = page.getByRole('button', { name: t.composer.send });
    this.leaveButton = page.getByRole('button', { name: t.room.leave });
    this.themeToggle = page.getByRole('button', { name: /Usar tema/ });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/chat$/);
    await expect(this.heading).toBeVisible();
  }

  async onlineCount(): Promise<number> {
    const text = await this.onlineBadge.textContent();
    return Number(text?.match(/\d+/)?.[0]);
  }

  /** Types the message and presses Enter (SEND-01 AC1). */
  async send(content: string) {
    await this.composer.fill(content);
    await this.composer.press('Enter');
  }

  bubble(content: string): Locator {
    return this.page.getByTestId('message-bubble').filter({
      has: this.page.getByTestId('message-content').getByText(content, {
        exact: true,
      }),
    });
  }

  systemMessage(text: string): Locator {
    return this.messages.getByText(text, { exact: true });
  }
}
