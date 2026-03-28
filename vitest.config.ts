import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.ts', 'tests/**/*.js'],
    exclude: process.env.HEAVY_TESTS ? [] : ['tests/**/*.heavy.ts'],
    testTimeout: process.env.HEAVY_TESTS ? 30000 : 5000,
    hookTimeout: process.env.HEAVY_TESTS ? 35000 : 10000,
  },
});
