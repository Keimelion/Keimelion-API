import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/shared/test/setup.ts'],
    testTimeout: 15000,
    // dist/ holds compiled copies of the test files
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
})
