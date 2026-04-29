import { Component, type ErrorInfo, type ReactNode } from 'react';

type RouteLoadErrorBoundaryProps = {
  children: ReactNode;
};

type RouteLoadErrorBoundaryState = {
  hasError: boolean;
};

export default class RouteLoadErrorBoundary extends Component<
  RouteLoadErrorBoundaryProps,
  RouteLoadErrorBoundaryState
> {
  state: RouteLoadErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): RouteLoadErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route chunk loading failed', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <section className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">页面资源加载失败</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            当前页面资源可能已随新版本更新。请刷新页面以重新加载最新资源。
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            刷新页面
          </button>
        </section>
      </main>
    );
  }
}
