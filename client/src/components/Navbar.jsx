import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Sun, Moon, Shield, Bell, CheckCheck, UserPlus, MessageSquare, ArrowRightLeft, MessageSquareText, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Avatar, getAvatarColor } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import logo from '@/assets/logo.png';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_COLORS = {
  assignment: 'bg-blue-500',
  comment: 'bg-purple-500',
  status: 'bg-green-500',
};

const TYPE_ICONS = {
  assignment: <UserPlus className="h-2.5 w-2.5" />,
  comment: <MessageSquare className="h-2.5 w-2.5" />,
  status: <ArrowRightLeft className="h-2.5 w-2.5" />,
};

export function Navbar({ darkMode, onToggleDark, unreadMessages = 0, onOpenChat }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const avatarName = user?.username || '';
  const avatarColor = getAvatarColor(avatarName);

  return (
    <header className="sticky top-0 z-40 border-b bg-[hsl(var(--card))] shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="Kuma" className="h-8 w-auto" />
        </Link>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {/* Calendar link */}
          {user && (
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link to="/calendar" className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <span>Calendar</span>
              </Link>
            </Button>
          )}

          {/* Admin link */}
          {user?.role === 'admin' && (
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link to="/admin" className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          )}

          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={onToggleDark} aria-label="Toggle theme">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Chat */}
          {user && (
            <Button variant="ghost" size="icon" aria-label="Chat" className="relative" onClick={onOpenChat}>
              <MessageSquareText className="h-4 w-4" />
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#7C3AED] text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Button>
          )}

          {/* Notifications */}
          {user && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={markAllRead}
                    >
                      <CheckCheck className="mr-1 h-3.5 w-3.5" />
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                      No notifications
                    </p>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={n.id}>
                        {i > 0 && <Separator />}
                        <button
                          onClick={() => markRead(n.id)}
                          className={`w-full px-4 py-3 text-left transition-colors hover:bg-[hsl(var(--muted))] ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-1 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-white ${TYPE_COLORS[n.type] || 'bg-gray-400'}`}>
                              {TYPE_ICONS[n.type] || null}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${!n.read ? 'font-medium' : ''}`}>
                                {n.title || n.type}
                              </p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                                {n.message}
                              </p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                {timeAgo(n.created_at)}
                              </p>
                            </div>
                            {!n.read && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0066CC]" />
                            )}
                          </div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Profile Avatar + Logout */}
          {user && (
            <>
              <Button variant="ghost" size="icon" asChild aria-label="Profile">
                <Link to="/profile">
                  <Avatar name={avatarName} color={avatarColor} size="sm" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
