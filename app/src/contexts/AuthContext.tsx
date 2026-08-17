import { createContext, useCallback, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  signInWithPassword,
  restoreUser,
  loadAdminProfile,
  type AppUser,
  type UserRole,
} from '@/lib/auth.service';
import {
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_NOTICE_KEY,
  setAccessToken,
} from '@/lib/apiClient';
import { isRunningAsPWA } from '@/lib/pwaInstall';
import StartupScreen from '@/components/StartupScreen';

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'ahadiya-last-activity';
const TIMEOUT_NOTICE_KEY = SESSION_EXPIRED_NOTICE_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<AppUser | null>(null);
  const manualLogoutRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const logout = useCallback(() => {
    manualLogoutRef.current = true;
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setAccessToken(null);
    setUser(null);
    void supabase.auth.signOut({ scope: 'local' }).finally(() => {
      manualLogoutRef.current = false;
    });
  }, []);

  const expireSession = useCallback(() => {
    sessionStorage.setItem(TIMEOUT_NOTICE_KEY, 'true');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setAccessToken(null);
    setUser(null);
    void supabase.auth.signOut({ scope: 'local' });
  }, []);

  useEffect(() => {
    // 1. Restore session on page load
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    const installedApp = isRunningAsPWA();
    const sessionAlreadyIdle = !installedApp && lastActivity > 0 && Date.now() - lastActivity >= IDLE_TIMEOUT_MS;

    // Installed apps should behave like apps, not short-lived browser sessions.
    if (installedApp) localStorage.removeItem(LAST_ACTIVITY_KEY);

    (sessionAlreadyIdle
      ? supabase.auth.signOut().then(() => {
          sessionStorage.setItem(TIMEOUT_NOTICE_KEY, 'true');
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          setAccessToken(null);
          return null;
        })
      : restoreUser())
      .then((profile) => {
        setUser(profile);
        if (profile && !installedApp && !lastActivity) {
          localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setIsLoading(false));

    // 2. Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Always bridge the token to the API client for FastAPI calls
      setAccessToken(session?.access_token ?? null);

      if (event === 'SIGNED_OUT') {
        if (userRef.current && !manualLogoutRef.current) {
          sessionStorage.setItem(TIMEOUT_NOTICE_KEY, 'true');
        }
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
            await supabase.auth.signOut();
            setUser(null);
          }
        } catch {
          if (event === 'SIGNED_IN') setUser(null);
        }
      }
    });

    const handleExpiredSession = () => {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      setAccessToken(null);
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    };
  }, []);

  useEffect(() => {
    if (!user || isRunningAsPWA()) return;

    let timeoutId: number | undefined;
    let lastWrite = 0;

    const expireIfIdle = () => {
      window.clearTimeout(timeoutId);
      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
      const lastActivity = stored || Date.now();
      if (!stored) localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);

      if (remaining <= 0) {
        expireSession();
        return;
      }
      timeoutId = window.setTimeout(expireIfIdle, remaining);
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 15_000) return;
      lastWrite = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      expireIfIdle();
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') expireIfIdle();
    };
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_KEY) return;
      if (event.newValue === null) {
        void supabase.auth.signOut();
        setAccessToken(null);
        setUser(null);
        return;
      }
      expireIfIdle();
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll',
    ];
    activityEvents.forEach(event => window.addEventListener(event, recordActivity, { passive: true }));
    document.addEventListener('visibilitychange', checkWhenVisible);
    window.addEventListener('focus', expireIfIdle);
    window.addEventListener('storage', syncAcrossTabs);
    expireIfIdle();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach(event => window.removeEventListener(event, recordActivity));
      document.removeEventListener('visibilitychange', checkWhenVisible);
      window.removeEventListener('focus', expireIfIdle);
      window.removeEventListener('storage', syncAcrossTabs);
    };
  }, [expireSession, user]);

  const login = async (email: string, password: string) => {
    const profile = await signInWithPassword(email, password);
    if (!isRunningAsPWA()) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }
    setUser(profile);
  };

  const refreshUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const profile = await loadAdminProfile(
      session.user.id,
      session.user.email ?? '',
    );
    setUser(profile);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Prevents users from opening role-restricted pages through a direct URL. */
export function RoleProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  return user && allowedRoles.includes(user.role) ? <>{children}</> : <Navigate to="/" replace />;
}

export const useAuth = () => useContext(AuthContext);

/** Wrapper component that redirects unauthenticated users to /login */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <StartupScreen />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export const isAdmin = (role?: UserRole | string) =>
  role === 'Admin' || role === 'Principal' || role === 'Super Admin';
