import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Sun, Moon, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

export function Navbar({ darkMode, onToggleDark }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-[hsl(var(--card))] shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="Kuma" className="h-8 w-auto" />
        </Link>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {/* Admin link */}
          {user?.role === 'admin' && (
            <Button variant="ghost" size="sm" asChild>
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

          {/* User info + logout */}
          {user && (
            <>
              <span className="hidden text-sm text-[hsl(var(--muted-foreground))] sm:inline px-1">
                {user.username}
                {user.role === 'admin' && (
                  <span className="ml-1.5 rounded-full bg-[#0066CC]/10 px-2 py-0.5 text-xs font-medium text-[#0066CC]">
                    admin
                  </span>
                )}
              </span>
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
