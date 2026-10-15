import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: 'standalone',
  // Trace from the monorepo root so packages/* are included.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  turbopack: {
    root: path.join(import.meta.dirname, '../../'),
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
