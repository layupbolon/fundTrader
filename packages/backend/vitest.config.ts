import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
        target: 'es2021',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.spec.ts'],
    exclude: ['dist/**', 'coverage/**', 'test/e2e/**'],
    setupFiles: ['src/test-setup.ts'],
    testTimeout: 10_000,
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.ts',
        'src/**/*.entity.ts',
        'src/models/index.ts',
        'src/app.module.ts',
        'src/auth/auth.module.ts',
        'src/auth/index.ts',
        'src/test-compat.d.ts',
      ],
      thresholds: {
        branches: 77,
        functions: 77,
        lines: 80,
        statements: 80,
      },
    },
  },
});
