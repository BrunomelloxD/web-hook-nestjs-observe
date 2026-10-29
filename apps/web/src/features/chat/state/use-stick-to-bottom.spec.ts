import { act, renderHook } from '@testing-library/react';
import { useStickToBottom } from './use-stick-to-bottom';

const CLIENT_HEIGHT = 400;

/** jsdom has no layout: the scroller's heights are set by hand. */
function scroller(scrollHeight = 2000) {
  const element = document.createElement('div');
  const size = { scrollHeight };
  Object.defineProperty(element, 'scrollHeight', {
    get: () => size.scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', { value: CLIENT_HEIGHT });
  /** Puts the reader `distance` px above the bottom, as a user scroll would. */
  const scrollTo = (distance: number) =>
    act(() => {
      element.scrollTop = size.scrollHeight - CLIENT_HEIGHT - distance;
      element.dispatchEvent(new Event('scroll'));
    });
  /** A new message makes the content taller. */
  const grow = (px: number) => {
    size.scrollHeight += px;
  };
  return { element, size, scrollTo, grow };
}

function renderStick(element: HTMLElement | null, count = 5, forceKey = 0) {
  // One ref for every render, as useRef gives the component.
  const ref = { current: element };
  return renderHook((deps) => useStickToBottom(ref, deps), {
    initialProps: { count, forceKey },
  });
}

describe('useStickToBottom', () => {
  it('ao montar, rola até o fim', () => {
    const { element } = scroller(2000);

    const { result } = renderStick(element);

    expect(element.scrollTop).toBe(2000);
    expect(result.current.showNewBelow).toBe(false);
  });

  it('a 80 px do fim, nova mensagem rola até o fim (SCROLL-01 AC1)', () => {
    const { element, scrollTo, grow, size } = scroller();
    const { result, rerender } = renderStick(element, 5);
    scrollTo(80);

    grow(100);
    rerender({ count: 6, forceKey: 0 });

    expect(element.scrollTop).toBe(size.scrollHeight);
    expect(result.current.showNewBelow).toBe(false);
  });

  it('a 81 px do fim, nova mensagem mantém a posição e liga showNewBelow (SCROLL-01 AC2)', () => {
    const { element, scrollTo, grow } = scroller(2000);
    const { result, rerender } = renderStick(element, 5);
    scrollTo(81);
    const position = element.scrollTop;

    grow(100);
    rerender({ count: 6, forceKey: 0 });

    expect(element.scrollTop).toBe(position);
    expect(result.current.showNewBelow).toBe(true);
  });

  it('rolar até o fim desliga showNewBelow (SCROLL-01 AC4)', () => {
    const { element, scrollTo, grow } = scroller();
    const { result, rerender } = renderStick(element, 5);
    scrollTo(500);
    grow(100);
    rerender({ count: 6, forceKey: 0 });
    expect(result.current.showNewBelow).toBe(true);

    scrollTo(0);

    expect(result.current.showNewBelow).toBe(false);
  });

  it('rolar sem chegar ao fim mantém showNewBelow ligado', () => {
    const { element, scrollTo, grow } = scroller();
    const { result, rerender } = renderStick(element, 5);
    scrollTo(500);
    grow(100);
    rerender({ count: 6, forceKey: 0 });

    scrollTo(300);

    expect(result.current.showNewBelow).toBe(true);
  });

  it('mudar forceKey rola até o fim mesmo longe do fim (SCROLL-01 AC5)', () => {
    const { element, scrollTo, grow, size } = scroller();
    const { result, rerender } = renderStick(element, 5, 0);
    scrollTo(900);

    grow(100);
    rerender({ count: 6, forceKey: 1 });

    expect(element.scrollTop).toBe(size.scrollHeight);
    expect(result.current.showNewBelow).toBe(false);
  });

  it('depois de rolar por forceKey, a próxima mensagem também rola', () => {
    const { element, scrollTo, grow, size } = scroller();
    const { rerender } = renderStick(element, 5, 0);
    scrollTo(900);
    rerender({ count: 6, forceKey: 1 });

    grow(100);
    rerender({ count: 7, forceKey: 1 });

    expect(element.scrollTop).toBe(size.scrollHeight);
  });

  it('scrollToBottom rola até o fim e desliga showNewBelow (SCROLL-01 AC3)', () => {
    const { element, scrollTo, grow, size } = scroller();
    const { result, rerender } = renderStick(element, 5);
    scrollTo(500);
    grow(100);
    rerender({ count: 6, forceKey: 0 });
    expect(result.current.showNewBelow).toBe(true);

    act(() => result.current.scrollToBottom());

    expect(element.scrollTop).toBe(size.scrollHeight);
    expect(result.current.showNewBelow).toBe(false);
  });

  it('sem elemento rolável (lista fora de um contêiner com overflow), não quebra', () => {
    const { result, rerender } = renderStick(null, 5);

    rerender({ count: 6, forceKey: 1 });

    expect(result.current.showNewBelow).toBe(false);
  });
});
