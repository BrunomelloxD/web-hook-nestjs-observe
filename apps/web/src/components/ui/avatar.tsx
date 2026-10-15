import { cn } from '@/lib/utils';

/** Color pairs from the design's `avatar/*` tokens. */
export const AVATAR_TONES = ['pink', 'green'] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

const TONE_CLASSES: Record<AvatarTone | 'brand', string> = {
  pink: 'bg-avatar-pink-bg text-avatar-pink-fg',
  green: 'bg-avatar-green-bg text-avatar-green-fg',
  brand: 'bg-brand text-on-brand',
};

const SIZE_CLASSES = {
  sm: 'size-6 text-xs',
  md: 'size-8 text-sm',
};

const graphemes = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/** First grapheme, so "érica" gives "É" even when the accent is a combining mark. */
export function initialOf(name: string): string {
  return Array.from(
    graphemes.segment(name.trim().normalize('NFC')),
    (s) => s.segment,
  )
    .slice(0, 1)
    .join('')
    .toLocaleUpperCase('pt-BR');
}

/** FNV-1a (32 bits): the same seed always gets the same tone. */
export function pickAvatarTone(seed: string): AvatarTone {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

type AvatarProps = {
  name: string;
  /** Usually the participant id, so the color doesn't change with the name. */
  colorSeed: string;
  /** `brand` is the current participant's own avatar. */
  tone?: 'auto' | 'brand';
  size?: 'sm' | 'md';
  className?: string;
};

export function Avatar({
  name,
  colorSeed,
  tone = 'auto',
  size = 'md',
  className,
}: AvatarProps) {
  const toneClass =
    TONE_CLASSES[tone === 'brand' ? 'brand' : pickAvatarTone(colorSeed)];

  return (
    <span
      role="img"
      aria-label={name}
      data-slot="avatar"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        SIZE_CLASSES[size],
        toneClass,
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}
