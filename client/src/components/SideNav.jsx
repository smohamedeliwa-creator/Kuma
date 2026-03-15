import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, MessageSquareText, Shield,
  ChevronRight, ChevronLeft, Menu, X, Plus, LogOut, Sun, Moon,
  Bell, CheckCheck, UserPlus, MessageSquare, ArrowRightLeft, FileText,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar, getAvatarColor } from '@/components/ui/avatar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import logo from '@/assets/logo.png';
import { NewPageModal } from '@/components/NewPageModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NOTIF_COLORS = {
  assignment: 'bg-blue-500',
  comment:    'bg-[#0066CC]',
  status:     'bg-green-500',
};
const NOTIF_ICONS = {
  assignment: <UserPlus className="h-2.5 w-2.5" />,
  comment:    <MessageSquare className="h-2.5 w-2.5" />,
  status:     <ArrowRightLeft className="h-2.5 w-2.5" />,
};

// ─── Tooltip (collapsed mode) ─────────────────────────────────────────────────

function Tip({ label, show, children }) {
  if (!show) return <>{children}</>;
  return (
    <div className="group/tip relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 z-[60] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1a1a2e] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/tip:opacity-100 dark:bg-[#F5F5F5] dark:text-[#111]">
        {label}
      </div>
    </div>
  );
}

// ─── Nav row ──────────────────────────────────────────────────────────────────

function NavRow({ to, icon: Icon, label, collapsed, badge, onClick, exact }) {
  const { pathname } = useLocation();
  const isActive = to
    ? exact ? pathname === to : pathname === to || pathname.startsWith(to + '/')
    : false;

  const base = `relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors select-none h-10
    ${collapsed ? 'justify-center px-0 w-full' : 'px-4 w-full'}
    ${isActive
      ? 'bg-[#E6F0FF] text-[#0066CC] dark:bg-[#0A1628] dark:text-[#0066CC] border-l-[3px] border-[#0066CC]'
      : 'text-[#111111] dark:text-[#F5F5F5] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]'}
    ${isActive && !collapsed ? '-ml-px pl-[13px]' : ''}`;

  const inner = (
    <>
      <Icon className={`h-5 w-5 shrink-0 ${isActive ? '' : 'text-[#6B7280] dark:text-[#9CA3AF]'}`} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {badge > 0 && !collapsed && (
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#0066CC] px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {badge > 0 && collapsed && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#0066CC]" />
      )}
    </>
  );

  const el = onClick
    ? <button onClick={onClick} className={base}>{inner}</button>
    : <Link to={to} className={base}>{inner}</Link>;

  return <Tip label={label} show={collapsed}>{el}</Tip>;
}

// ─── New Project Dialog ───────────────────────────────────────────────────────

function NewProjectDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setName(''); setDescription(''); setError(''); }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/api/projects', { name: name.trim(), description: description.trim() || undefined });
      onCreated(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a project for your team.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="snav-proj-name">Name</Label>
            <Input id="snav-proj-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Album Mastering 2025" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="snav-proj-desc">Description</Label>
            <Textarea id="snav-proj-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional…" rows={2} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Side Nav ─────────────────────────────────────────────────────────────────

export function SideNav({ collapsed, onCollapsedChange, darkMode, onToggleDark, unreadMessages }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const isAdmin = user?.role === 'admin';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [projectTaskLists, setProjectTaskLists] = useState({});
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  // Pages
  const [pages, setPages] = useState([]);
  const [pagesExpanded, setPagesExpanded] = useState(true);
  const [expandedPages, setExpandedPages] = useState(new Set());
  const [newPageModal, setNewPageModal] = useState({ open: false, parentId: null, projectId: null });

  useEffect(() => {
    api.get('/api/pages').then(r => setPages(r.data)).catch(() => {});
  }, [pathname]);

  function handleCreatePage(parentId = null, projectId = null) {
    setNewPageModal({ open: true, parentId, projectId });
  }

  function handlePageCreated(page) {
    setPages(prev => [...prev, page]);
    setNewPageModal({ open: false, parentId: null, projectId: null });
    navigate(`/pages/${page.id}`);
  }

  const avatarName = user?.username || '';
  const avatarColor = getAvatarColor(avatarName);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get('/api/projects');
      setProjects(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Auto-expand active project
  useEffect(() => {
    const match = pathname.match(/^\/projects\/(\d+)/);
    if (match) {
      const id = Number(match[1]);
      setExpandedProjects(prev => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // Fetch task lists if not yet loaded
      setProjectTaskLists(prev => {
        if (prev[id]) return prev;
        api.get(`/api/projects/${id}/task-lists`).then(res =>
          setProjectTaskLists(p => ({ ...p, [id]: res.data }))
        ).catch(() => {});
        return prev;
      });
    }
  }, [pathname]);

  function toggleProject(projectId) {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
        if (!projectTaskLists[projectId]) {
          api.get(`/api/projects/${projectId}/task-lists`).then(res =>
            setProjectTaskLists(p => ({ ...p, [projectId]: res.data }))
          ).catch(() => {});
        }
      }
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // ── Sidebar panel ──────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile hamburger (always visible on small screens) */}
      <button
        className="fixed left-4 top-3.5 z-40 flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E5E5E5] bg-white shadow-sm transition-colors hover:bg-[#F5F5F5] dark:border-[#2E2E2E] dark:bg-[#1A1A1A] dark:hover:bg-[#222222] lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4 text-[#111111] dark:text-[#F5F5F5]" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The sidebar itself */}
      <aside
        style={{ transition: 'width 200ms ease, transform 250ms ease' }}
        className={[
          'fixed left-0 top-0 z-50 flex h-full flex-col',
          'border-r border-[#E5E5E5] bg-white dark:border-[#1F1F1F] dark:bg-[#111111]',
          'w-[260px]',
          collapsed ? 'lg:w-[60px]' : 'lg:w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* ── Logo row ── */}
        <div className={`flex h-14 shrink-0 items-center border-b border-[#E5E5E5] dark:border-[#1F1F1F] ${collapsed ? 'lg:justify-center' : 'justify-between px-4'}`}>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 min-w-0"
            onClick={() => setMobileOpen(false)}
          >
            <img src={logo} alt="Kuma" className="h-7 w-auto shrink-0" width="28" height="28" />
            {!collapsed && (
              <span className="truncate font-bold text-[#111111] dark:text-[#F5F5F5]">Kuma</span>
            )}
            {collapsed && <span className="truncate font-bold text-[#111111] dark:text-[#F5F5F5] lg:hidden">Kuma</span>}
          </Link>
          {/* Mobile X close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-1 shrink-0 rounded-md p-1.5 text-[#6B7280] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A] transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
          {/* Desktop collapse button */}
          {!collapsed && (
            <button
              onClick={() => onCollapsedChange(true)}
              className="ml-1 shrink-0 rounded-md p-1.5 text-[#6B7280] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A] transition-colors hidden lg:flex"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Scrollable nav area ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">

          {/* Expand button when collapsed — desktop only */}
          {collapsed && (
            <Tip label="Expand sidebar" show>
              <button
                onClick={() => onCollapsedChange(false)}
                className="mb-1 hidden lg:flex w-full items-center justify-center rounded-md py-2 text-[#6B7280] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A] transition-colors"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </Tip>
          )}

          {/* Main links */}
          <NavRow to="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} exact />
          <NavRow to="/calendar" icon={CalendarDays} label="Calendar" collapsed={collapsed} />
          <NavRow
            to="/chat"
            icon={MessageSquareText}
            label="Chat"
            collapsed={collapsed}
            badge={unreadMessages}
          />

          {/* Notifications */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Tip label="Notifications" show={collapsed}>
                <button
                  className={`relative flex w-full items-center gap-3 rounded-md text-sm font-medium transition-colors h-10
                    text-[#111111] dark:text-[#F5F5F5] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]
                    ${collapsed ? 'justify-center' : 'px-4'}`}
                >
                  <Bell className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">Notifications</span>}
                  {unreadCount > 0 && !collapsed && (
                    <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  {unreadCount > 0 && collapsed && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </button>
              </Tip>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" sideOffset={8} className="w-80 p-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllRead}>
                    <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Bell className="h-7 w-7 text-[hsl(var(--muted-foreground))] opacity-40" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">No notifications yet</p>
                  </div>
                ) : notifications.map((n, i) => (
                  <div key={n.id}>
                    {i > 0 && <Separator />}
                    <button
                      onClick={() => {
                        markRead(n.id);
                        if (n.link) navigate(n.link);
                        setNotifOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-[hsl(var(--muted))] ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${NOTIF_COLORS[n.type] || 'bg-gray-400'}`}>
                          {NOTIF_ICONS[n.type] || null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${!n.read ? 'font-medium' : ''}`}>{n.title || n.type}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{n.message}</p>
                          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0066CC]" />}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t">
                <button
                  onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                  className="w-full py-2.5 text-center text-xs font-medium text-[#0066CC] hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  View all notifications
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Divider */}
          <div className="my-1 border-t border-[#E5E5E5] dark:border-[#1F1F1F]" />

          {/* Projects header */}
          {!collapsed ? (
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#6B7280]">Projects</span>
              {isAdmin && (
                <button
                  onClick={() => setNewProjectOpen(true)}
                  className="rounded p-0.5 text-[#9CA3AF] transition-colors hover:bg-[#F5F5F5] hover:text-[#111111] dark:hover:bg-[#1A1A1A] dark:hover:text-[#F5F5F5]"
                  aria-label="New project"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : isAdmin && (
            <Tip label="New project" show>
              <button
                onClick={() => setNewProjectOpen(true)}
                className="flex w-full items-center justify-center rounded-md py-2 text-[#6B7280] transition-colors hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
                aria-label="New project"
              >
                <Plus className="h-4 w-4" />
              </button>
            </Tip>
          )}

          {/* Project list */}
          <div className="space-y-px">
            {projects.map(project => {
              const isExpanded = expandedProjects.has(project.id);
              const isActiveProject = pathname === `/projects/${project.id}` || pathname.startsWith(`/projects/${project.id}/`);
              const taskLists = projectTaskLists[project.id] || [];

              return (
                <div key={project.id}>
                  <Tip label={project.name} show={collapsed}>
                    <div
                      className={[
                        'flex w-full items-center rounded-md text-sm font-medium transition-colors',
                        collapsed ? 'justify-center py-2' : 'py-1.5 pl-1 pr-2 gap-1',
                        isActiveProject
                          ? 'border-l-[3px] border-[#0066CC] bg-[#E6F0FF] text-[#0066CC] dark:bg-[#0A1628] dark:text-[#0066CC]'
                          : 'text-[#111111] hover:bg-[#F5F5F5] dark:text-[#F5F5F5] dark:hover:bg-[#1A1A1A]',
                        isActiveProject && !collapsed ? '-ml-px' : '',
                      ].join(' ')}
                    >
                      {/* Expand arrow */}
                      {!collapsed && (
                        <button
                          onClick={() => toggleProject(project.id)}
                          className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                      {/* Project link */}
                      <Link
                        to={`/projects/${project.id}`}
                        className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="shrink-0 text-sm leading-none">📁</span>
                        {!collapsed && <span className="truncate">{project.name}</span>}
                      </Link>
                    </div>
                  </Tip>

                  {/* Task lists (expanded) */}
                  {!collapsed && isExpanded && (
                    <div className="ml-6 mt-0.5 space-y-px border-l border-[#E5E5E5] pl-3 dark:border-[#1F1F1F]">
                      {taskLists.length === 0 ? (
                        <p className="py-1 text-[11px] text-[#9CA3AF]">No lists yet</p>
                      ) : taskLists.map(list => (
                        <Link
                          key={list.id}
                          to={`/projects/${project.id}`}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-[#6B7280] transition-colors hover:bg-[#F5F5F5] hover:text-[#111111] dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A] dark:hover:text-[#F5F5F5]"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D1D5DB] dark:bg-[#4B5563]" />
                          <span className="truncate">{list.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider + Pages section */}
          <div className="my-1 border-t border-[#E5E5E5] dark:border-[#1F1F1F]" />

          {!collapsed ? (
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <button
                onClick={() => setPagesExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#6B7280] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${pagesExpanded ? 'rotate-90' : ''}`} />
                Pages
              </button>
              <button
                onClick={() => handleCreatePage()}
                className="rounded p-0.5 text-[#9CA3AF] transition-colors hover:bg-[#F5F5F5] hover:text-[#111111] dark:hover:bg-[#1A1A1A] dark:hover:text-[#F5F5F5]"
                aria-label="New page"
                title="New page"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Tip label="New page" show>
              <button
                onClick={() => handleCreatePage()}
                className="flex w-full items-center justify-center rounded-md py-2 text-[#6B7280] transition-colors hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
                aria-label="New page"
              >
                <FileText className="h-4 w-4" />
              </button>
            </Tip>
          )}

          {/* Page list */}
          {!collapsed && pagesExpanded && (
            <div className="space-y-px">
              {pages.filter(p => !p.parent_id).map(page => {
                const isActive = pathname === `/pages/${page.id}`;
                const children = pages.filter(p => p.parent_id === page.id);
                const isExpanded = expandedPages.has(page.id);
                return (
                  <div key={page.id}>
                    <div className={[
                      'flex w-full items-center rounded-md text-sm font-medium transition-colors py-1 pl-1 pr-1 gap-0.5',
                      isActive
                        ? 'border-l-[3px] border-[#0066CC] bg-[#E6F0FF] text-[#0066CC] dark:bg-[#0A1628] dark:text-[#0066CC] -ml-px'
                        : 'text-[#111111] hover:bg-[#F5F5F5] dark:text-[#F5F5F5] dark:hover:bg-[#1A1A1A]',
                    ].join(' ')}>
                      {/* Sub-page toggle */}
                      <button
                        onClick={() => setExpandedPages(prev => {
                          const next = new Set(prev);
                          if (next.has(page.id)) next.delete(page.id); else next.add(page.id);
                          return next;
                        })}
                        className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        style={{ visibility: children.length > 0 ? 'visible' : 'hidden' }}
                      >
                        <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      <Link
                        to={`/pages/${page.id}`}
                        onClick={() => setMobileOpen(false)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-0.5"
                      >
                        <span className="text-sm shrink-0">{page.icon || '📄'}</span>
                        <span className="truncate text-sm">{page.title || 'Untitled'}</span>
                      </Link>
                      <button
                        onClick={() => handleCreatePage(page.id)}
                        className="shrink-0 rounded p-0.5 opacity-0 hover:opacity-100 group-hover:opacity-100 text-[#9CA3AF] hover:bg-[#F5F5F5] hover:text-[#111111] dark:hover:bg-[#1A1A1A] dark:hover:text-[#F5F5F5] transition-all"
                        title="Add sub-page"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    {/* Sub-pages */}
                    {isExpanded && children.length > 0 && (
                      <div className="ml-6 mt-0.5 space-y-px border-l border-[#E5E5E5] pl-3 dark:border-[#1F1F1F]">
                        {children.map(child => (
                          <Link
                            key={child.id}
                            to={`/pages/${child.id}`}
                            onClick={() => setMobileOpen(false)}
                            className={[
                              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                              pathname === `/pages/${child.id}`
                                ? 'text-[#0066CC] bg-[#E6F0FF] dark:bg-[#0A1628]'
                                : 'text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#111111] dark:text-[#9CA3AF] dark:hover:bg-[#1A1A1A]',
                            ].join(' ')}
                          >
                            <span className="text-xs shrink-0">{child.icon || '📄'}</span>
                            <span className="truncate">{child.title || 'Untitled'}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {pages.filter(p => !p.parent_id).length === 0 && (
                <button
                  onClick={() => handleCreatePage()}
                  className="w-full rounded-md px-3 py-1.5 text-left text-xs text-[#9CA3AF] hover:bg-[#F5F5F5] hover:text-[#111111] dark:hover:bg-[#1A1A1A] transition-colors"
                >
                  + New page
                </button>
              )}
            </div>
          )}

          {/* Divider + Admin */}
          {isAdmin && (
            <>
              <div className="my-1 border-t border-[#E5E5E5] dark:border-[#1F1F1F]" />
              <NavRow to="/admin" icon={Shield} label="Admin Panel" collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* ── Bottom user section ── */}
        <div className="shrink-0 border-t border-[#E5E5E5] dark:border-[#1F1F1F] p-2 space-y-0.5">
          {/* User row */}
          {!collapsed ? (
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-md px-4 h-10 transition-colors hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
              onClick={() => setMobileOpen(false)}
            >
              <Avatar name={avatarName} color={avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#111111] dark:text-[#F5F5F5]">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-xs capitalize text-[#6B7280] dark:text-[#9CA3AF]">{user?.role}</p>
              </div>
            </Link>
          ) : (
            <Tip label={user?.username || 'Profile'} show>
              <Link
                to="/profile"
                className="flex w-full items-center justify-center rounded-md py-2 transition-colors hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
                onClick={() => setMobileOpen(false)}
              >
                <Avatar name={avatarName} color={avatarColor} size="sm" />
              </Link>
            </Tip>
          )}

          {/* Dark mode toggle */}
          {!collapsed ? (
            <button
              onClick={onToggleDark}
              className="flex w-full items-center gap-3 rounded-md px-4 h-10 text-sm font-medium text-[#111111] dark:text-[#F5F5F5] transition-colors hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="h-5 w-5 shrink-0 text-[#6B7280] dark:text-[#9CA3AF]" /> : <Moon className="h-5 w-5 shrink-0 text-[#6B7280] dark:text-[#9CA3AF]" />}
              <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
            </button>
          ) : (
            <Tip label={darkMode ? 'Light mode' : 'Dark mode'} show>
              <button
                onClick={onToggleDark}
                className="flex w-full items-center justify-center rounded-md py-2 text-[#6B7280] transition-colors hover:bg-[#F5F5F5] hover:text-[#111111] dark:hover:bg-[#1A1A1A] dark:hover:text-[#F5F5F5]"
                aria-label="Toggle theme"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </Tip>
          )}

          {/* Logout */}
          {!collapsed ? (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-4 h-10 text-sm font-medium text-[#111111] dark:text-[#F5F5F5] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5 shrink-0 text-[#6B7280] dark:text-[#9CA3AF]" />
              <span>Logout</span>
            </button>
          ) : (
            <Tip label="Logout" show>
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center rounded-md py-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </Tip>
          )}
        </div>
      </aside>

      {/* New project dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreated={project => {
          setProjects(prev => [project, ...prev]);
          navigate(`/projects/${project.id}`);
        }}
      />

      {/* New page modal (template picker) */}
      <NewPageModal
        open={newPageModal.open}
        parentId={newPageModal.parentId}
        projectId={newPageModal.projectId}
        onClose={() => setNewPageModal({ open: false, parentId: null, projectId: null })}
        onCreated={handlePageCreated}
      />
    </>
  );
}
