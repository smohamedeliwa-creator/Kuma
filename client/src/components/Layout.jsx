import { useState, useEffect } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, Shield, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from './Navbar';
import { ChatPanel } from './ChatPanel';

function BottomTabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = user?.role === 'admin';

  const tabs = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-[hsl(var(--card))] sm:hidden">
      <div className="flex h-16 items-center justify-around">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${
                active
                  ? 'text-[#0066CC]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : ''}`} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Layout() {
  const { user, loading } = useAuth();
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('kuma-theme') === 'dark'
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('kuma-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
      <Navbar
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        unreadMessages={chatUnread}
        onOpenChat={() => setChatOpen(true)}
      />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 sm:pb-6">
        <Outlet />
      </main>
      <BottomTabBar />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onUnreadChange={setChatUnread}
      />
    </div>
  );
}
