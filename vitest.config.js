import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use jsdom to simulate browser environment (localStorage, DOM, etc.)
    environment: 'jsdom',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['js/**/*.js'],
      exclude: ['js/app.js', 'js/ui/**/*.js'],
    },

    // Glob patterns for test files
    include: ['js/**/*.test.js', 'tests/**/*.test.js'],

    // Global test setup
    globals: true,
  },
});
