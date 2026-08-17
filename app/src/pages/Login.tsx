import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import IslamicPatternBG from '@/components/IslamicPatternBG';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useToast();
  const { resolvedTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('ahadiya-session-timeout') === 'true') {
      sessionStorage.removeItem('ahadiya-session-timeout');
      addToast('info', 'Your last session expired.');
    }
  }, [addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (error: unknown) {
      addToast('error', getErrorMessage(error, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pwa-login-screen min-h-dvh bg-slate-50 dark:bg-slate-950 flex items-center justify-center relative overflow-hidden">
      <IslamicPatternBG />
      <div className="pwa-login-inner relative z-10 w-full max-w-sm mx-4">
        <div className="pwa-only pwa-login-native-brand">
          <img src={resolvedTheme === 'dark' ? '/ahadiya-logo-white.png' : '/ahadiya-logo-black.png'} alt="Ahadiya School" />
          <h1>Al-Meera Ahadiya School</h1>
          <p>Ahadiya Management System</p>
        </div>

        <div className="pwa-login-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-8">
          <div className="pwa-login-brand pwa-login-desktop-brand text-center mb-6">
            <img src={resolvedTheme === 'dark' ? '/ahadiya-logo-white.png' : '/ahadiya-logo-black.png'} alt="Ahadiya School" className="w-20 h-20 object-contain mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Al-Meera Ahadiya School</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ahadiya Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="pwa-only pwa-login-welcome">
              <h2>Welcome back</h2>
              <p>Sign in to manage your school</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter email"
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="pwa-only pwa-login-secure">Secure access for authorized staff</p>
      </div>
    </div>
  );
}
