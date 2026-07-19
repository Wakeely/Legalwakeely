import { defineConfig } from 'vitest/config';
import path from 'path';

// Fast, no-browser test runner for pure logic and gate-checking code
// (as opposed to Playwright, which drives a real browser for UI flows).
// This is where the plan-limit and access-gate bugs found in the July
// 2026 security review are regression-tested.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
