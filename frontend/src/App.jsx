import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { trackPageView } from './api/tracker';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import GroupBuilder from './pages/GroupBuilder';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';
import AIChat from './pages/AIChat';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/ForgotPassword';
import Layout from './components/Layout';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div></div>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin ? children : <Navigate to="/dashboard" />;
}

function PageTracker() {
  const location = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    if (user) trackPageView(location.pathname);
  }, [location.pathname, user]);
  return null;
}

export default function App() {
  return (
    <>
      <PageTracker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="groups" element={<GroupBuilder />} />
          <Route path="reports" element={<Reports />} />
          <Route path="chat" element={<AIChat />} />
          <Route path="admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Route>
      </Routes>
    </>
  );
}
