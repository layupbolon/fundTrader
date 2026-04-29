import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteLoadErrorBoundary from '../RouteLoadErrorBoundary';

function BrokenRoute(): ReactNode {
  throw new Error('Failed to fetch dynamically imported module');
}

describe('RouteLoadErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show a reload action when a lazy route fails to load', () => {
    render(
      <RouteLoadErrorBoundary>
        <BrokenRoute />
      </RouteLoadErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: '页面资源加载失败' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '刷新页面' })).toBeTruthy();
  });
});
