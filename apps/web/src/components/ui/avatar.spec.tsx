import { render, screen } from '@testing-library/react';
import { Avatar, AVATAR_TONES, initialOf, pickAvatarTone } from './avatar';

describe('initialOf', () => {
  it.each([
    ['érica', 'É'],
    ['e\u0301rica', 'É'], // accent typed as a combining mark
    ['ana', 'A'],
    ['  Carlos', 'C'],
  ])('%j → %j', (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });
});

describe('pickAvatarTone', () => {
  it('o mesmo seed sempre dá o mesmo tom', () => {
    expect(pickAvatarTone('ana-id')).toBe(pickAvatarTone('ana-id'));
  });

  it('usa FNV-1a sobre o seed', () => {
    // FNV-1a("a") = 0xe40c292c (even), FNV-1a("b") = 0xe70c2de5 (odd).
    expect(pickAvatarTone('a')).toBe('pink');
    expect(pickAvatarTone('b')).toBe('green');
  });

  it('seeds diferentes cobrem os dois tons', () => {
    const tones = new Set(['p-1', 'p-2', 'p-3'].map(pickAvatarTone));

    expect([...tones].sort()).toEqual([...AVATAR_TONES].sort());
  });
});

describe('Avatar', () => {
  it('mostra a inicial e expõe o nome', () => {
    render(<Avatar name="érica" colorSeed="a" />);

    const avatar = screen.getByRole('img', { name: 'érica' });
    expect(avatar).toHaveTextContent('É');
  });

  it.each([
    ['a', 'bg-avatar-pink-bg', 'text-avatar-pink-fg'],
    ['b', 'bg-avatar-green-bg', 'text-avatar-green-fg'],
  ])('com seed %s usa o par %s/%s', (seed, bg, fg) => {
    render(<Avatar name="Ana" colorSeed={seed} />);

    const avatar = screen.getByRole('img', { name: 'Ana' });
    expect(avatar).toHaveClass(bg, fg);
  });

  it('tone="brand" usa as cores da marca, não o par do seed', () => {
    render(<Avatar name="Você" colorSeed="a" tone="brand" />);

    const avatar = screen.getByRole('img', { name: 'Você' });
    expect(avatar).toHaveClass('bg-brand', 'text-on-brand');
    expect(avatar).not.toHaveClass('bg-avatar-pink-bg');
  });

  it.each([
    ['sm', 'size-6'],
    ['md', 'size-8'],
  ] as const)('tamanho %s usa %s', (size, cls) => {
    render(<Avatar name="Ana" colorSeed="a" size={size} />);

    expect(screen.getByRole('img', { name: 'Ana' })).toHaveClass(cls);
  });
});
