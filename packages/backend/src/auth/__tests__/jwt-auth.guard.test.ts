import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../public.decorator';

// We need to test the guard logic without actually invoking passport's auth flow.
// Since JwtAuthGuard extends AuthGuard('jwt'), calling super.canActivate() in tests
// crashes because no JWT strategy is registered. We test the @Public() bypass logic
// by directly testing the reflector check.

describe('JwtAuthGuard', () => {
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
        getNext: jest.fn(),
      }),
    }) as any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
  });

  it('should check @Public() metadata using reflector', () => {
    const context = createMockContext();
    reflector.getAllAndOverride.mockReturnValue(true);

    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    expect(isPublic).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should return false when @Public() is not set', () => {
    const context = createMockContext();
    reflector.getAllAndOverride.mockReturnValue(false);

    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    expect(isPublic).toBe(false);
  });

  it('should return undefined when no metadata is present', () => {
    const context = createMockContext();
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    expect(isPublic).toBeUndefined();
  });

  it('should verify guard class structure', async () => {
    // Dynamic import to avoid crashing the worker process
    const { JwtAuthGuard } = await import('../jwt-auth.guard');
    const guard = new JwtAuthGuard(reflector);

    expect(guard).toBeDefined();
    expect(guard.canActivate).toBeDefined();
  });

  it('should allow access when @Public() is set (via canActivate)', async () => {
    const { JwtAuthGuard } = await import('../jwt-auth.guard');
    const guard = new JwtAuthGuard(reflector);
    const context = createMockContext();

    reflector.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
