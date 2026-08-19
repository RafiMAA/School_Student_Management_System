import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

interface AppContextType {
  currentAcademicYear: string;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
}

const AppContext = createContext<AppContextType>({
  currentAcademicYear: '',
  isSidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  isMobileSidebarOpen: false,
  setMobileSidebarOpen: () => {},
});

// Try to instantly hydrate from localStorage (same pattern as AuthContext)
function getInitialYear(): { year_label: string } | undefined {
  try {
    const stored = localStorage.getItem('ahadiya_academic_year');
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return undefined;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { data: currentYear } = useQuery({
    queryKey: ['current-academic-year'],
    queryFn: async () => {
      const data = await api.get<{ year_label: string }>('/academic-years/current');
      // Persist so next page load is instant
      localStorage.setItem('ahadiya_academic_year', JSON.stringify(data));
      return data;
    },
    enabled: isAuthenticated && !isAuthLoading,
    staleTime: 1000 * 60 * 5,  // 5 minutes
    gcTime: 1000 * 60 * 10,    // 10 minutes — keep in cache longer
    initialData: getInitialYear(),        // Instant from localStorage
    initialDataUpdatedAt: Date.now() - 1, // Treat as slightly stale so it refetches in background
  });

  return (
    <AppContext.Provider value={{
      currentAcademicYear: currentYear?.year_label || '',
      isSidebarCollapsed,
      setSidebarCollapsed,
      isMobileSidebarOpen,
      setMobileSidebarOpen,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
