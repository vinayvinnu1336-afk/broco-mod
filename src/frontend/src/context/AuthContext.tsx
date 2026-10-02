'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserDto, AuthResponse } from '@/types/auth';
import { apiFetch } from '@/lib/api';

interface AuthContextType {
  user: UserDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    role?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  quickLogin: (role: 'customer' | 'garage' | 'advisor' | 'admin') => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore saved credentials from localStorage
    try {
      const storedToken = localStorage.getItem('broco_access_token');
      const storedUser = localStorage.getItem('broco_user');

      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      localStorage.removeItem('broco_access_token');
      localStorage.removeItem('broco_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveAuthSession = (auth: AuthResponse) => {
    setAccessToken(auth.accessToken);
    setUser(auth.user);
    localStorage.setItem('broco_access_token', auth.accessToken);
    localStorage.setItem('broco_refresh_token', auth.refreshToken);
    localStorage.setItem('broco_user', JSON.stringify(auth.user));
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.success && res.data) {
        saveAuthSession(res.data);
        return { success: true };
      }

      return { success: false, error: res.message || 'Login failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    role?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) {
        saveAuthSession(res.data);
        return { success: true };
      }

      return { success: false, error: res.message || 'Registration failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('broco_refresh_token');
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignored during client cleanup
    } finally {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('broco_access_token');
      localStorage.removeItem('broco_refresh_token');
      localStorage.removeItem('broco_user');
      window.location.href = '/login';
    }
  };

  const quickLogin = async (role: 'customer' | 'garage' | 'advisor' | 'admin') => {
    const creds = {
      customer: { email: 'customer@brocomod.com', pass: 'Password123!' },
      garage: { email: 'garage.owner@centralmetro.com', pass: 'Password123!' },
      advisor: { email: 'advisor@brocomod.com', pass: 'Password123!' },
      admin: { email: 'admin@brocomod.com', pass: 'Password123!' },
    }[role];

    const result = await login(creds.email, creds.pass);
    if (result.success) {
      const targetPortal = {
        customer: '/customer/dashboard',
        garage: '/garage/dashboard',
        advisor: '/advisor/dashboard',
        admin: '/admin/dashboard',
      }[role];
      window.location.href = targetPortal;
    }
  };

  const hasRole = (role: string): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.some((r) => r.toUpperCase() === role.toUpperCase());
  };

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission.toUpperCase());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        register,
        logout,
        quickLogin,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
