import { parsePageParam } from './search-params';

describe('parsePageParam', () => {
  it.each([
    [undefined, 1],
    ['3', 3],
    [['4', '5'], 4],
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['abc', 1],
  ])('%j vira %i', (value, expected) => {
    expect(parsePageParam(value)).toBe(expected);
  });
});
