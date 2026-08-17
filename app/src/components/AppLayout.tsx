import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import PwaBottomNav from './PwaBottomNav';
import PwaHeader from './PwaHeader';
import PwaSelectSheet from './PwaSelectSheet';
import { usePwaUi } from '@/hooks/use-pwa-ui';

export default function AppLayout() {
  const pwaUi = usePwaUi();

  if (pwaUi) {
    return (
      <div className="pwa-app-shell">
        <PwaHeader />
        <main className="pwa-app-content">
          <Outlet />
        </main>
        <PwaBottomNav />
        <PwaSelectSheet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
