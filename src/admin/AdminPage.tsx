import { useState } from 'react';
import { AdminAuth } from './AdminAuth';
import { AdminDashboard } from './AdminDashboard';

interface AdminPageProps {
  onExit: () => void;
}

export function AdminPage({ onExit }: AdminPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('keeper_dev_admin_authenticated') === 'true';
  });

  const handleLogout = () => {
    sessionStorage.removeItem('keeper_dev_admin_authenticated');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminAuth onSuccess={() => setIsAuthenticated(true)} onExit={onExit} />;
  }

  return <AdminDashboard onExit={onExit} onLogout={handleLogout} />;
}
