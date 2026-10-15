import { chatDictionary as t } from '../chat.dictionary';

type TypingIndicatorProps = {
  names: readonly string[];
};

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  return <p className="text-xs text-fg-muted italic">{t.typing(names)}</p>;
}
