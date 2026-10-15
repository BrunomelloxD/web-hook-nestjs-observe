import { coverageConfig } from '../index.js';

describe('coverageConfig', () => {
  it('requires 100% in every metric', () => {
    expect(coverageConfig({ include: ['src/**'] }).thresholds).toEqual({
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    });
  });

  it('keeps the scope given by the app', () => {
    const config = coverageConfig({
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts'],
    });

    expect(config).toMatchObject({
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts'],
    });
  });

  it('excludes nothing by default', () => {
    expect(coverageConfig({ include: ['src/**'] }).exclude).toEqual([]);
  });
});
