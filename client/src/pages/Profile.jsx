import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, Circle, AlertCircle,
  MessageSquare, FolderOpen, Pencil,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Avatar, getAvatarColor } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const AVATAR_COLORS = [
  '#0066CC', '#1A1A2E', '#059669', '#DC2626',
  '#D97706', '#0891B2', '#BE185D', '#65A30D',
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`rounded-full p-2 ${highlight ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-[#0066CC]/10 text-[#0066CC]'}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function Profile() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/profile');
      setData(res.data);
      setFullName(res.data.user.full_name || '');
      setSelectedColor(res.data.user.avatar_color || getAvatarColor(res.data.user.username));
    } catch {
      toast({ title: 'Failed to load profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/api/profile', { full_name: fullName, avatar_color: selectedColor });
      await load();
      setEditOpen(false);
      toast({ title: 'Profile updated' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const { user, stats, projects, recentActivity } = data;
  const displayName = user.full_name || user.username;
  const avatarColor = user.avatar_color || getAvatarColor(user.username);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <Card>
        <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center">
          <Avatar name={displayName} color={avatarColor} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate dark:text-white">{displayName}</h1>
            {user.full_name && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">@{user.username}</p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role}
              </Badge>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Joined {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit Profile
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<Circle className="h-5 w-5" />} label="To Do" value={stats.todo} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="In Progress" value={stats.in_progress} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Done" value={stats.done} />
        <StatCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Overdue"
          value={stats.overdue}
          highlight={stats.overdue > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" />
              Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No projects yet.</p>
            )}
            {projects.map(p => {
              const pct = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <Link
                      to={`/projects/${p.id}`}
                      className="font-medium hover:text-[#0066CC] transition-colors truncate"
                    >
                      {p.name}
                    </Link>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 ml-2">
                      {p.done_count}/{p.task_count} done
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No recent activity.</p>
            )}
            {recentActivity.map(a => (
              <div key={a.id} className="flex gap-3">
                <Avatar name={displayName} color={avatarColor} size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">Commented</span> on{' '}
                    <Link
                      to={`/projects/${a.project_id}`}
                      className="font-medium text-[#0066CC] hover:underline"
                    >
                      {a.task_name}
                    </Link>
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{a.content}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <Avatar name={fullName || user.username} color={selectedColor} size="xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar Color</Label>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                    style={{
                      backgroundColor: c,
                      ring: selectedColor === c ? '2px solid white' : undefined,
                      outline: selectedColor === c ? `3px solid ${c}` : '3px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
