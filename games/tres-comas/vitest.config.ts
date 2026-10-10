import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so the rules tests run in plain Node, without the Workers runtime.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
