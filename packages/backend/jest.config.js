module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/**/*.entity.ts',
    '!src/models/index.ts',
    '!src/app.module.ts',
    '!src/auth/auth.module.ts',
    '!src/auth/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 77,
      functions: 77,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
