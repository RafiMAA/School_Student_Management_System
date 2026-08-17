import { useEffect, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Save, Lock, KeyRound, Eye, EyeOff, Download, Smartphone, CheckCircle, Bell, Database, Info, LogOut } from 'lucide-react';
import { canInstallPWA, isRunningAsPWA, promptPWAInstall, subscribeToPWAInstall } from '@/lib/pwaInstall';
import { setWebPushEnabled, webPushEnabled } from '@/lib/pushNotifications';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function Settings() {
  const { addToast } = useToast();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [canInstall, setCanInstall] = useState(canInstallPWA());
  const [isInstalled, setIsInstalled] = useState(isRunningAsPWA());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(true);

  useEffect(() => subscribeToPWAInstall(() => {
    setCanInstall(canInstallPWA());
    setIsInstalled(isRunningAsPWA());
  }), []);

  useEffect(() => {
    webPushEnabled()
      .then(setNotificationsEnabled)
      .finally(() => setNotificationLoading(false));
  }, []);

  const toggleNotifications = async () => {
    setNotificationLoading(true);
    try {
      const enabled = await setWebPushEnabled(!notificationsEnabled);
      setNotificationsEnabled(enabled);
      addToast(enabled ? 'success' : 'info', enabled
        ? 'Sunday attendance reminders enabled'
        : 'Attendance reminders disabled');
    } catch (error: unknown) {
      addToast('error', getErrorMessage(error, 'Could not update notifications'));
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleInstall = async () => {
    const outcome = await promptPWAInstall();
    if (outcome === 'accepted') {
      setCanInstall(false);
      addToast('success', 'Ahadiya School app installed successfully');
    } else if (outcome === 'dismissed') {
      addToast('info', 'Installation was cancelled');
    } else {
      setCanInstall(false);
      addToast('info', 'Use the install icon in the address bar or your browser menu');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current_password) {
      addToast('error', 'Enter your current password');
      return;
    }
    if (passwords.new_password !== passwords.confirm_password) {
      addToast('error', 'Passwords do not match');
      return;
    }
    if (passwords.new_password.length < 8) {
      addToast('error', 'Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        current_password: passwords.current_password,
        password: passwords.new_password,
      });
      if (error) throw error;
      addToast('success', 'Password updated successfully');
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error: unknown) {
      addToast('error', getErrorMessage(error, 'Failed to update password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pwa-settings max-w-2xl mx-auto space-y-6">
      <div className="pwa-only pwa-page-heading">
        <h1>Settings</h1>
        <p>Appearance, security and app details</p>
      </div>
      <section className="pwa-only pwa-appearance-card">
        <h2>Appearance</h2>
        <div>
          {(['light', 'dark', 'system'] as ThemeMode[]).map(mode => (
            <button type="button" key={mode} className={theme === mode ? 'is-active' : ''} onClick={() => setTheme(mode)}>
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="pwa-only pwa-settings-native-details">
        <div className="pwa-settings-native-row">
          <span className="pwa-settings-native-icon"><Bell aria-hidden="true" /></span>
          <div>
            <strong>Sunday attendance reminders</strong>
            <small>8:30 AM · 10:25 teacher · 10:40 admin</small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            aria-label="Sunday attendance reminders"
            disabled={notificationLoading}
            onClick={toggleNotifications}
            className={`pwa-settings-switch ${notificationsEnabled ? 'is-on' : ''}`}
          ><span /></button>
        </div>
        <div className="pwa-settings-native-row">
          <span className="pwa-settings-native-icon"><Database aria-hidden="true" /></span>
          <div>
            <strong>API Server</strong>
            <small>https://ahadiya-student-management-system.onrender.com/api</small>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="pwa-only pwa-settings-native-password">
        <h2>Change Password</h2>
        <label htmlFor="pwa-current-password">Current password</label>
        <input
          id="pwa-current-password"
          type="password"
          name="current_password"
          value={passwords.current_password}
          onChange={handleChange}
          autoComplete="current-password"
          required
        />
        <label htmlFor="pwa-new-password">New password</label>
        <input
          id="pwa-new-password"
          type="password"
          name="new_password"
          value={passwords.new_password}
          onChange={handleChange}
          autoComplete="new-password"
          required
        />
        <label htmlFor="pwa-confirm-password">Confirm password</label>
        <input
          id="pwa-confirm-password"
          type="password"
          name="confirm_password"
          value={passwords.confirm_password}
          onChange={handleChange}
          autoComplete="new-password"
          required
        />
        <button
          type="submit"
          disabled={loading || !passwords.current_password || !passwords.new_password || !passwords.confirm_password}
        >
          <KeyRound aria-hidden="true" /> {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <section className="pwa-only pwa-settings-about">
        <span className="pwa-settings-native-icon"><Info aria-hidden="true" /></span>
        <div><strong>About</strong><small>Al-Meera Ahadiya Management System · Mobile 1.0.0</small></div>
      </section>

      <button type="button" className="pwa-only pwa-settings-signout" onClick={logout}>
        <LogOut aria-hidden="true" /> Sign Out
      </button>

      <div className="pwa-install-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Install Ahadiya School App</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Use the management system like an app from your home screen</p>
          </div>
        </div>
        <div className="p-6">
          {isInstalled ? (
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" /> App is installed on this device
            </div>
          ) : canInstall ? (
            <button onClick={handleInstall} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors">
              <Download className="w-4 h-4" /> Install App
            </button>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>. On iPhone and iPad, use Safari's Share menu.
            </p>
          )}
        </div>
      </div>

      <div className="pwa-settings-desktop-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sunday Attendance Reminders</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">8:30 AM · 10:25 assigned teacher · 10:40 administrators</p>
          </div>
        </div>
        <div className="p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Conditional reminders are sent only while attendance is still missing.
          </p>
          <button
            type="button"
            disabled={notificationLoading}
            onClick={toggleNotifications}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${notificationsEnabled ? 'bg-slate-600 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {notificationLoading ? 'Checking…' : notificationsEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      <div className="pwa-settings-desktop-card bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Security Settings</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Update your password and secure your account</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Current Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  name="current_password"
                  value={passwords.current_password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showNewPassword ? "text" : "password"}
                  name="new_password"
                  value={passwords.new_password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Confirm New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirm_password"
                  value={passwords.confirm_password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-start">
            <button
              type="submit"
              disabled={loading || !passwords.current_password || !passwords.new_password || !passwords.confirm_password}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
