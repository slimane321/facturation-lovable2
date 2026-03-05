import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useLang } from '@/contexts/LanguageContext';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';

export default function Layout() {
  const { dir } = useLang();

  // Fire notification triggers on layout mount
  useNotificationTriggers();

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir={dir}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex items-center justify-end px-6 py-2 border-b border-border bg-card/50 backdrop-blur-sm no-print">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto scroll-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
