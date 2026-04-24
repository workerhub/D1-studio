import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const path = window.location.pathname;
    if (!loading && !user && path !== '/login') {
      window.location.href = '/login';
    }
    if (!loading && user && path === '/login') {
      window.location.href = '/';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const path = window.location.pathname;

  if (!user) return <LoginPage />;
  if (path.startsWith('/admin') && user.role === 'admin') return <AdminPage />;
  return <MainPage />;
}
