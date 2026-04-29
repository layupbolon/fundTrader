/// <reference types="vitest/globals" />

declare global {
  namespace jest {
    export type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> =
      import('vitest').Mock<T>;
    export type Mocked<T> = import('vitest').Mocked<T>;
  }
}

export {};
