import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, setStoredToken, getStoredToken } from '../lib/api';

export type UserRole = 'student' | 'teacher' | 'coordinator' | 'principal';

export interface UserProfile {
  id: number;
  schoolId: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  isActive: boolean;
  preferences: {
    emailAlerts?: boolean;
    inAppAlerts?: boolean;
    emergencySound?: boolean;
    assignmentReminders?: boolean;
  };
  roleDetails?: Record<string, any> | null;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  academicYear: string;
  setAcademicYear: (yr: string) => void;
  academicYears: Array<{ id: number; name: string; isCurrent: boolean; status: string }>;
  schoolSettings: Record<string, any> | null;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  showToast: (title: string, description?: string, variant?: ToastMessage['variant']) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [academicYears, setAcademicYears] = useState<Array<{ id: number; name: string; isCurrent: boolean; status: string }>>([
    { id: 1, name: '2026-2027', isCurrent: true, status: 'active' },
    { id: 2, name: '2025-2026', isCurrent: false, status: 'archived' },
  ]);
  const [schoolSettings, setSchoolSettings] = useState<Record<string, any> | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, description?: string, variant: ToastMessage['variant'] = 'default') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user);
      if (data.schoolSettings) setSchoolSettings(data.schoolSettings);
      if (data.academicYears?.length) setAcademicYears(data.academicYears);
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getStoredToken()) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const login = async (identifier: string, password: string, rememberMe = false) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, rememberMe }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    showToast(`Welcome back, ${data.user.fullName}`, `Signed in as ${data.user.role.toUpperCase()}`, 'success');
    return data.user;
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    showToast('Signed Out', 'Your local session has been closed safely.');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        academicYear,
        setAcademicYear,
        academicYears,
        schoolSettings,
        login,
        logout,
        refreshUser,
        showToast,
        toasts,
        dismissToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

