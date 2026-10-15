import { chatDictionary as t } from '../chat.dictionary';

type OnlineBadgeProps = {
  count: number;
};

export function OnlineBadge({ count }: OnlineBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
      <span
        aria-hidden="true"
        data-testid="online-dot"
        className="size-2 rounded-full bg-online"
      />
      {t.online(count)}
    </span>
  );
}
