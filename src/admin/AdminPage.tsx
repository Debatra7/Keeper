import { useState } from 'react';
import { AdminAuth } from './AdminAuth';
import { AdminDashboard } from './AdminDashboard';
import { isAdminAuthenticated, clearAdminSession } from '../lib/adminAuth';

interface AdminPageProps {
  onExit: () => void;
}

export function AdminPage({ onExit }: AdminPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isAdminAuthenticated());

  const handleLogout = () => {
    clearAdminSession();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminAuth onSuccess={() => setIsAuthenticated(true)} onExit={onExit} />;
  }

  return <AdminDashboard onExit={onExit} onLogout={handleLogout} />;
}
