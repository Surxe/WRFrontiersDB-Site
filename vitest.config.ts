import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.ts', 'tests/**/*.js'],
    // tests/**/support/ holds shared helpers (oracles, replays), not suites.
    exclude: [
      'tests/**/support/**',
      ...(process.env.HEAVY_TESTS ? [] : ['tests/**/*.heavy.ts']),
    ],
    testTimeout: process.env.HEAVY_TESTS ? 30000 : 5000,
    hookTimeout: process.env.HEAVY_TESTS ? 35000 : 10000,
  },
});
