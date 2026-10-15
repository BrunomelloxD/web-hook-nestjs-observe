export interface CoverageScope {
  include: string[];
  exclude?: string[];
}

/** Project-wide coverage rules: every app and package must reach 100%. */
export function coverageConfig({ include, exclude = [] }: CoverageScope) {
  return {
    provider: 'v8' as const,
    include,
    exclude,
    thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    reporter: ['text', 'html', 'lcov'],
  };
}
