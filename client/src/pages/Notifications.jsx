import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, UserPlus, MessageSquare, ArrowRightLeft, Info,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';

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

function groupByDate(notifications) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = { Today: [], Yesterday: [], Earlier: [] };
  for (const n of notifications) {
    const d = new Date(n.created_at);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) groups.Today.push(n);
    else if (d.getTime() === yesterday.getTime()) groups.Yesterday.push(n);
    else groups.Earlier.push(n);
  }
  return groups;
}

const TYPE_ICON = {
  assignment: UserPlus,
  comment: MessageSquare,
  status: ArrowRightLeft,
  info: Info,
};
const TYPE_COLOR = {
  assignment: 'bg-blue-500',
  comment: 'bg-[#0066CC]',
  status: 'bg-green-500',
  info: 'bg-gray-400',
};

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotifRow({ n, onClickRow }) {
  const Icon = TYPE_ICON[n.type] || Info;
  const colorCls = TYPE_COLOR[n.type] || 'bg-gray-400';

  return (
    <button
      onClick={() => onClickRow(n)}
      className={`w-full flex items-start gap-4 rounded-xl px-4 py-4 text-left transition-colors hover:bg-[hsl(var(--muted))]
        ${!n.read ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${colorCls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'} text-[hsl(var(--foreground))]`}>
          {n.title || n.type}
        </p>
        {n.message && (
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{n.message}</p>
        )}
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{timeAgo(n.created_at)}</p>
      </div>
      {!n.read && (
        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0066CC]" aria-label="Unread" />
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const groups = groupByDate(notifications);

  function handleClickRow(n) {
    markRead(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-[hsl(var(--muted-foreground))]">
          <Bell className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">No notifications yet</p>
          <p className="text-sm">You'll see task updates, comments, and assignments here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([label, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={label}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-4">
                  {label}
                </h2>
                <div className="rounded-xl border bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
                  {items.map(n => (
                    <NotifRow key={n.id} n={n} onClickRow={handleClickRow} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
