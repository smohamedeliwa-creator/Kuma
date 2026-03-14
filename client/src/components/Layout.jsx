import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SideNav } from './SideNav';
import { ChatPanel } from './ChatPanel';

export function Layout() {
  const { user, loading } = useAuth();

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('kuma-theme') === 'dark'
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('kuma-sidenav-collapsed') === 'true'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('kuma-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  function handleCollapsedChange(val) {
    setCollapsed(val);
    localStorage.setItem('kuma-sidenav-collapsed', String(val));
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0066CC] border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <SideNav
        collapsed={collapsed}
        onCollapsedChange={handleCollapsedChange}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
        unreadMessages={chatUnread}
        onOpenChat={() => setChatOpen(true)}
      />

      {/* Main content — offset left by sidebar width on desktop, top on mobile for hamburger */}
      <main
        style={{ transition: 'padding-left 200ms ease' }}
        className={[
          'min-h-screen px-4 pb-8 pt-16 sm:px-6 lg:pt-8',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[276px]',
        ].join(' ')}
      >
        <Outlet />
      </main>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onUnreadChange={setChatUnread}
      />
    </div>
  );
}
