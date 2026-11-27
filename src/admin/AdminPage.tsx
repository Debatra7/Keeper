import { useEffect, useState } from 'react';
import { AdminAuth } from './AdminAuth';
import { AdminDashboard } from './AdminDashboard';
import {
  isAdminAuthenticated,
  clearAdminSession,
  getAdminSessionRemainingMs,
} from '../lib/adminAuth';

interface AdminPageProps {
  onExit: () => void;
}

export function AdminPage({ onExit }: AdminPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isAdminAuthenticated());

  useEffect(() => {
    if (!isAuthenticated) return;
    const remainingMs = getAdminSessionRemainingMs();
    if (remainingMs <= 0) {
      clearAdminSession();
      setIsAuthenticated(false);
      return;
    }
    const timer = window.setTimeout(() => {
      clearAdminSession();
      setIsAuthenticated(false);
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <AdminAuth onSuccess={() => setIsAuthenticated(true)} onExit={onExit} />;
  }

  return <AdminDashboard onExit={onExit} />;
}
