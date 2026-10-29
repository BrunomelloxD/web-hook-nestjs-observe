import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

/** Tolerance for rounding in scroll positions (SCROLL-01). */
const BOTTOM_THRESHOLD_PX = 80;

function isAtBottom(element: HTMLElement): boolean {
  const distance =
    element.scrollHeight - element.scrollTop - element.clientHeight;
  return distance <= BOTTOM_THRESHOLD_PX;
}

/**
 * Keeps the scroller at the bottom while the reader is there. New items while
 * reading older ones turn on `showNewBelow` instead. A new `forceKey` (the
 * reader sent a message) always scrolls down.
 */
export function useStickToBottom(
  ref: RefObject<HTMLElement | null>,
  { count, forceKey }: { count: number; forceKey: number },
): { showNewBelow: boolean; scrollToBottom: () => void } {
  const [showNewBelow, setShowNewBelow] = useState(false);
  // Measured on scroll, before new items change scrollHeight.
  const atBottom = useRef(true);
  const lastForceKey = useRef(forceKey);

  const scrollToBottom = useCallback(() => {
    const element = ref.current;
    if (element) element.scrollTop = element.scrollHeight;
    atBottom.current = true;
    setShowNewBelow(false);
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onScroll = () => {
      atBottom.current = isAtBottom(element);
      if (atBottom.current) setShowNewBelow(false);
    };
    element.addEventListener('scroll', onScroll);
    return () => element.removeEventListener('scroll', onScroll);
  }, [ref]);

  // Before paint, so the reader never sees the list jump.
  useLayoutEffect(() => {
    const forced = lastForceKey.current !== forceKey;
    lastForceKey.current = forceKey;
    if (forced || atBottom.current) scrollToBottom();
    else setShowNewBelow(true);
  }, [count, forceKey, scrollToBottom]);

  return { showNewBelow, scrollToBottom };
}
