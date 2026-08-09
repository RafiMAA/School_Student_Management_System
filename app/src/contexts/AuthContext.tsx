import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Restore session on page load
    restoreUser()
      .then((profile) => {
        setUser(profile);
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

  const login = async (email: string, password: string, captchaToken?: string) => {
    const profile = await signInWithPassword(email, password, captchaToken);
    setUser(profile);
  };

  const logout = () => {
    supabase.auth.signOut();
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
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
