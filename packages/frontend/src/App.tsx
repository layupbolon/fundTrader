import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Layout from './shared/Layout';
import LoadingSpinner from './shared/LoadingSpinner';
import RouteLoadErrorBoundary from './shared/RouteLoadErrorBoundary';

const LoginPage = lazy(() => import('./auth/LoginPage'));
const RegisterPage = lazy(() => import('./auth/RegisterPage'));
const DashboardPage = lazy(() => import('./dashboard/DashboardPage'));
const StrategiesPage = lazy(() => import('./strategies/StrategiesPage'));
const StrategyForm = lazy(() => import('./strategies/StrategyForm'));
const BacktestPage = lazy(() => import('./backtest/BacktestPage'));
const AnalyticsPage = lazy(() => import('./analytics/AnalyticsPage'));
const TransactionsPage = lazy(() => import('./transactions/TransactionsPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteLoadErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            }
          >
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/strategies" element={<StrategiesPage />} />
                <Route path="/strategies/new" element={<StrategyForm />} />
                <Route path="/strategies/:id/edit" element={<StrategyForm />} />
                <Route path="/backtest" element={<BacktestPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteLoadErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
