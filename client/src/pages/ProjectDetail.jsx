import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Plus, ArrowLeft, Trash2,
  Send, Calendar, User, MessageSquare, Loader2, Mail, Copy, Check,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatDate, getDueDateStatus } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const STATUS_VARIANTS = { todo: 'secondary', in_progress: 'info', done: 'success' };

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

function TaskSheet({ taskId, open, onOpenChange, isAdmin, onUpdated, onDeleted }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('todo');
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    setTask(null);
    Promise.all([
      api.get(`/api/tasks/${taskId}`),
      api.get(`/api/tasks/${taskId}/comments`),
    ]).then(([taskRes, commentsRes]) => {
      const t = taskRes.data;
      setTask(t);
      setName(t.name);
      setDueDate(t.due_date || '');
      setStatus(t.status);
      setComments(commentsRes.data);
    }).finally(() => setLoading(false));
  }, [open, taskId]);

  const canEdit = isAdmin || task?.assignments?.some(
    (a) => a.id === user?.id && a.permission === 'edit'
  );

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.put(`/api/tasks/${taskId}`, {
        name,
        due_date: dueDate || null,
        status,
      });
      setTask((prev) => ({ ...prev, ...res.data }));
      onUpdated(res.data);
      toast({ title: 'Task saved', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      onDeleted(taskId);
      onOpenChange(false);
      toast({ title: 'Task deleted', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete', variant: 'destructive' });
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const res = await api.post(`/api/tasks/${taskId}/comments`, { content: commentText });
      setComments((prev) => [...prev, res.data]);
      setCommentText('');
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Task Details</SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="px-6 py-4 space-y-4">
              <Skeleton className="h-9 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="px-6 py-4 space-y-5 flex-1">
              {/* Actions */}
              {canEdit && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 -ml-2"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Task
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              )}

              {/* Task Name */}
              <div className="space-y-1.5">
                <Label>Task Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              {/* Due Date + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  {canEdit ? (
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm py-2">
                      <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                      {formatDate(dueDate)}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  {canEdit ? (
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="py-2">
                      <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignees */}
              {task?.assignments?.length > 0 && (
                <div className="space-y-2">
                  <Label>Assignees</Label>
                  <div className="flex flex-wrap gap-2">
                    {task.assignments.map((a) => (
                      <span
                        key={a.id}
                        className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs"
                      >
                        <User className="h-3 w-3" />
                        <span className="font-medium">{a.username}</span>
                        <Badge
                          variant={a.permission === 'edit' ? 'default' : 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {a.permission}
                        </Badge>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Comments */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" />
                  Comments
                  <span className="text-[hsl(var(--muted-foreground))] font-normal">
                    ({comments.length})
                  </span>
                </h4>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-2">
                      No comments yet.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="rounded-lg bg-[hsl(var(--muted))] p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-[#0066CC]">{c.username}</span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {new Date(c.created_at).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {canEdit && (
                  <form onSubmit={handleComment} className="space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment…"
                      rows={2}
                      className="resize-none"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!commentText.trim() || sendingComment}
                      className="w-full"
                    >
                      {sendingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Post Comment
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task and all its comments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onClick }) {
  const dueDateStatus = getDueDateStatus(task.due_date);

  return (
    <tr
      className={[
        'cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors',
        dueDateStatus === 'overdue' ? 'border-l-2 border-l-red-500' : '',
        dueDateStatus === 'due-soon' ? 'border-l-2 border-l-yellow-500' : '',
      ].join(' ')}
      onClick={onClick}
    >
      <td className="py-2.5 pl-4 pr-3 text-sm font-medium">{task.name}</td>
      <td className="px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))]">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatDate(task.due_date)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <Badge variant={STATUS_VARIANTS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
      </td>
      <td className="px-3 py-2.5 pr-4 text-sm text-[hsl(var(--muted-foreground))]">
        {task.assignee_names || '—'}
      </td>
    </tr>
  );
}

// ─── Task List Section ────────────────────────────────────────────────────────

function TaskListSection({ list, isAdmin }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', due_date: '', status: 'todo' });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get(`/api/task-lists/${list.id}/tasks`).then((res) => {
      setTasks(res.data);
      setLoading(false);
    });
  }, [list.id]);

  function handleTaskUpdated(updated) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
  }

  function handleTaskDeleted(taskId) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await api.post(`/api/task-lists/${list.id}/tasks`, {
        name: newTask.name,
        due_date: newTask.due_date || null,
        status: newTask.status,
        assignees: [],
      });
      setTasks((prev) => [...prev, { ...res.data, assignee_names: null }]);
      setNewTask({ name: '', due_date: '', status: 'todo' });
      setCreateOpen(false);
      toast({ title: 'Task created', variant: 'success' });
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-lg border bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--card))]">
        <button
          className="flex items-center gap-2 text-sm font-semibold hover:text-[#0066CC] transition-colors"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
          {list.name}
          <span className="font-normal text-[hsl(var(--muted-foreground))]">
            ({tasks.length})
          </span>
        </button>
        {isAdmin && !collapsed && (
          <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        )}
      </div>

      {!collapsed && (
        <>
          {loading ? (
            <div className="border-t px-4 py-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            <p className="border-t px-4 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No tasks yet.
            </p>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-[hsl(var(--muted))/50] text-xs uppercase text-[hsl(var(--muted-foreground))]">
                    <th className="py-2 pl-4 pr-3 font-medium">Task Name</th>
                    <th className="px-3 py-2 font-medium">Due Date</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 pr-4 font-medium">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onClick={() => { setSelectedTaskId(task.id); setSheetOpen(true); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create task dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task — {list.name}</DialogTitle>
            <DialogDescription>Fill in the task details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Task Name</Label>
              <Input
                value={newTask.name}
                onChange={(e) => setNewTask((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Balance drum levels"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask((p) => ({ ...p, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={newTask.status}
                  onValueChange={(v) => setNewTask((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create Task'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task detail sheet */}
      <TaskSheet
        taskId={selectedTaskId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isAdmin={isAdmin}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
    </div>
  );
}

// ─── ProjectDetail Page ───────────────────────────────────────────────────────

export function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [project, setProject] = useState(null);
  const [taskLists, setTaskLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [listError, setListError] = useState('');
  const [listCreating, setListCreating] = useState(false);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/api/projects/${id}`),
      api.get(`/api/projects/${id}/task-lists`),
    ]).then(([projectRes, listsRes]) => {
      setProject(projectRes.data);
      setTaskLists(listsRes.data);
    }).catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError('');
    setInviteLink('');
    setInviteSending(true);
    try {
      const res = await api.post(`/api/projects/${id}/invite`, { email: inviteEmail });
      setInviteLink(res.data.inviteUrl);
      if (res.data.emailSent) {
        toast({ title: 'Invitation sent', description: `Email sent to ${inviteEmail}`, variant: 'success' });
      } else {
        toast({ title: 'Invitation created', description: 'Copy the link below to share it manually', variant: 'default' });
      }
      setInviteEmail('');
    } catch (err) {
      setInviteError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviteSending(false);
    }
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleCreateList(e) {
    e.preventDefault();
    setListError('');
    setListCreating(true);
    try {
      const res = await api.post(`/api/projects/${id}/task-lists`, { name: newListName });
      setTaskLists((prev) => [...prev, res.data]);
      setNewListName('');
      setCreateListOpen(false);
      toast({ title: `Task list "${res.data.name}" created`, variant: 'success' });
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to create list');
    } finally {
      setListCreating(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#1a1a2e] dark:text-white truncate">
              {project?.name}
            </h1>
            {project?.description && (
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {project.description}
              </p>
            )}
            {project?.members?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.members.map((m) => (
                  <span
                    key={m.id}
                    className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium"
                  >
                    {m.username}
                    {m.role === 'admin' && (
                      <span className="ml-1 text-[#0066CC]">·admin</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => { setInviteLink(''); setInviteOpen(true); }}>
                <Mail className="h-4 w-4" />
                Invite
              </Button>
              <Button size="sm" onClick={() => setCreateListOpen(true)}>
                <Plus className="h-4 w-4" />
                New List
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Task Lists */}
      <div className="space-y-4">
        {taskLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-lg font-semibold">No task lists yet</p>
            {isAdmin && (
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Add your first task list above.
              </p>
            )}
          </div>
        ) : (
          taskLists.map((list) => (
            <TaskListSection key={list.id} list={list} isAdmin={isAdmin} />
          ))
        )}
      </div>

      {/* Create Task List Dialog */}
      <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task List</DialogTitle>
            <DialogDescription>Add a new task list to this project.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateList} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>List Name</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g. Mixing, Mastering…"
                required
              />
            </div>
            {listError && <p className="text-sm text-red-600">{listError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateListOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={listCreating}>
                {listCreating ? 'Creating…' : 'Create List'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={open => { setInviteOpen(open); if (!open) { setInviteLink(''); setInviteError(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to {project?.name}</DialogTitle>
            <DialogDescription>
              Send an invitation link to a new engineer. They'll create an account and join this project automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="engineer@example.com"
                required
              />
            </div>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            {inviteLink && (
              <div className="rounded-md border bg-[hsl(var(--muted))] p-3">
                <p className="mb-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Invite link — share this manually if email isn't configured:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate text-xs">{inviteLink}</code>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={copyInviteLink}>
                    {linkCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Close</Button>
              <Button type="submit" disabled={inviteSending}>
                {inviteSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : <><Mail className="mr-2 h-4 w-4" />Send Invite</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
