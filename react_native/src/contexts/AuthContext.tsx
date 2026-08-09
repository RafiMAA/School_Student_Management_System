import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  signInWithPassword,
  restoreUser,
  loadAdminProfile,
} from '../services/auth.service';
import { setAccessToken } from '../services/api';
import type { AppUser, UserRole } from '../types';

type AuthValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  login: async () => undefined,
  logout: async () => undefined,
  refreshUser: async () => undefined,
});

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore session on app launch
    restoreUser()
      .then((profile) => {
        setUser(profile);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));

    // 2. Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Always bridge the token to the API client for FastAPI calls
      setAccessToken(session?.access_token ?? null);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        try {
          const profile = await loadAdminProfile(
            session.user.id,
            session.user.email ?? '',
          );
          if (profile) {
            setUser(profile);
          } else if (event === 'SIGNED_IN') {
            // User authenticated but not an active admin — sign out
            await supabase.auth.signOut();
            setUser(null);
          }
        } catch {
          // Profile load failed — keep existing user state on TOKEN_REFRESHED
          if (event === 'SIGNED_IN') setUser(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const profile = await signInWithPassword(email, password);
    setUser(profile);
    // Token bridging is handled by onAuthStateChange listener
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAccessToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const profile = await loadAdminProfile(
      session.user.id,
      session.user.email ?? '',
    );
    if (profile) setUser(profile);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const isAdmin = (role?: UserRole | string) =>
  role === 'Admin' || role === 'Principal' || role === 'Super Admin';
