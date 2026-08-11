import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  signInWithPassword,
  restoreUser,
  loadAdminProfile,
  type AppUser,
  type UserRole,
} from '@/lib/auth.service';
import { setAccessToken } from '@/lib/apiClient';

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
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
const TIMEOUT_NOTICE_KEY = 'ahadiya-session-timeout';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    void supabase.auth.signOut();
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // 1. Restore session on page load
    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    const sessionAlreadyIdle = lastActivity > 0 && Date.now() - lastActivity >= IDLE_TIMEOUT_MS;

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
        if (profile && !lastActivity) {
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

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let timeoutId: number | undefined;
    let lastWrite = 0;

    const expireIfIdle = () => {
      window.clearTimeout(timeoutId);
      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
      const lastActivity = stored || Date.now();
      if (!stored) localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);

      if (remaining <= 0) {
        sessionStorage.setItem(TIMEOUT_NOTICE_KEY, 'true');
        logout();
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
  }, [logout, user]);

  const login = async (email: string, password: string, captchaToken?: string) => {
    const profile = await signInWithPassword(email, password, captchaToken);
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}

export const isAdmin = (role?: UserRole | string) =>
  role === 'Admin' || role === 'Principal' || role === 'Super Admin';
