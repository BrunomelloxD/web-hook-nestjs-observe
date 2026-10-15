import { formatTime } from './format-time';

describe('formatTime', () => {
  const originalTz = process.env['TZ'];

  afterEach(() => {
    process.env['TZ'] = originalTz;
  });

  it.each(['UTC', 'Asia/Tokyo', 'America/New_York'])(
    'mostra HH:mm de São Paulo com o processo em %s',
    (tz) => {
      process.env['TZ'] = tz;

      expect(formatTime('2026-10-14T15:05:00Z')).toBe('12:05');
    },
  );
});
