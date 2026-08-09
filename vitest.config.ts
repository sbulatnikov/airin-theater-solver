import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/core/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      include: [
        'core/shared/base-engine.ts',
        'core/v2/engine.ts',
        'packages/ui/src/**/*.ts',
        'scripts/changelog.ts',
        'scripts/coverage/**/*.ts',
        'scripts/release-version.ts',
        'scripts/repository-release.ts',
        'scripts/verify-release-tag.ts',
        'scripts/rc/naming.ts',
        'scripts/release/main-release.ts',
        'scripts/release/release-notes.ts',
        'scripts/release/release-policy.ts',
        'scripts/shared/**/*.ts',
      ],
      exclude: ['**/index.ts', '**/types.ts', '**/transport.ts'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
