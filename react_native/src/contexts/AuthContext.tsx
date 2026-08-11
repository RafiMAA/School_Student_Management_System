import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
  recordActivity: () => void;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  login: async () => undefined,
  logout: async () => undefined,
  refreshUser: async () => undefined,
  recordActivity: () => undefined,
});

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'ahadiya_last_activity';

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastWriteRef = useRef(0);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current < 15_000) return;
    lastWriteRef.current = now;
    void AsyncStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // 1. Restore session on app launch
    AsyncStorage.getItem(LAST_ACTIVITY_KEY)
      .then(async stored => {
        const lastActivity = Number(stored);
        if (lastActivity > 0 && Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
          await AsyncStorage.removeItem(LAST_ACTIVITY_KEY);
          await supabase.auth.signOut();
          setAccessToken(null);
          return null;
        }
        const profile = await restoreUser();
        if (profile && !lastActivity) recordActivity();
        return profile;
      })
      .then(setUser)
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
  }, [recordActivity]);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const checkIdle = async () => {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      const stored = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
      const lastActivity = Number(stored) || Date.now();
      if (!stored) await AsyncStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
      if (remaining <= 0) {
        await logout();
        return;
      }
      timer = setTimeout(checkIdle, remaining);
    };

    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void checkIdle();
    });
    void checkIdle();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      appStateSubscription.remove();
    };
  }, [logout, user]);

  const login = async (email: string, password: string) => {
    const profile = await signInWithPassword(email, password);
    lastWriteRef.current = 0;
    recordActivity();
    setUser(profile);
    // Token bridging is handled by onAuthStateChange listener
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
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, recordActivity }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const isAdmin = (role?: UserRole | string) =>
  role === 'Admin' || role === 'Principal' || role === 'Super Admin';
