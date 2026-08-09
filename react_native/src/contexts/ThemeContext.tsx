import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const light = { primary: '#009b55', primaryDark: '#007c44', primarySoft: '#e9f8f0', background: '#f6f8fa', surface: '#ffffff', surfaceAlt: '#f1f5f9', text: '#10203a', muted: '#64748b', border: '#e2e8f0', danger: '#ef4444', dangerSoft: '#fff1f2', warning: '#f59e0b', info: '#2563eb' };
const dark = { primary: '#20c77a', primaryDark: '#16a665', primarySoft: '#0d3325', background: '#07101f', surface: '#101a2b', surfaceAlt: '#172236', text: '#f8fafc', muted: '#94a3b8', border: '#273449', danger: '#ef4444', dangerSoft: '#371824', warning: '#fbbf24', info: '#60a5fa' };
type ThemeMode = 'light' | 'dark' | 'system';
type ThemeValue = { colors: typeof light; dark: boolean; mode: ThemeMode; setMode: (v: ThemeMode) => void };
const ThemeContext = createContext<ThemeValue>({ colors: light, dark: false, mode: 'system', setMode: () => undefined });
export function ThemeProvider({ children }: React.PropsWithChildren) {
  const system = useColorScheme(); const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => { AsyncStorage.getItem('ahadiya_theme').then(v => v && setModeState(v as ThemeMode)); }, []);
  const setMode = (v: ThemeMode) => { setModeState(v); AsyncStorage.setItem('ahadiya_theme', v); };
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const value = useMemo(() => ({ colors: isDark ? dark : light, dark: isDark, mode, setMode }), [isDark, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
