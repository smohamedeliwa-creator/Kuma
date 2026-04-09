import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, UserPlus, Shield } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'engineer' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/api/admin/users').then((res) => {
      setUsers(res.data);
    }).catch(() => {
      toast({ title: 'Failed to load users', variant: 'destructive' });
    }).finally(() => setLoading(false));
  }, [toast]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      const res = await api.post('/api/admin/users', form);
      setUsers((prev) => [...prev, res.data]);
      setForm({ username: '', password: '', role: 'engineer' });
      setCreateOpen(false);
      toast({ title: `User "${res.data.username}" created`, variant: 'success' });
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {users.length} user{users.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[hsl(var(--muted-foreground))]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                placeholder="e.g. eng4"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="engineer">Engineer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab() {
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [projectMembers, setProjectMembers] = useState({});
  const [addMemberOpen, setAddMemberOpen] = useState(null); // project id
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addError, setAddError] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/projects'),
      api.get('/api/admin/users'),
    ]).then(([projRes, userRes]) => {
      setProjects(projRes.data);
      setAllUsers(userRes.data);
    }).finally(() => setLoading(false));
  }, []);

  async function loadMembers(projectId) {
    if (projectMembers[projectId]) return;
    const res = await api.get(`/api/projects/${projectId}`);
    setProjectMembers((prev) => ({ ...prev, [projectId]: res.data.members }));
  }

  function toggleExpand(projectId) {
    if (expanded === projectId) {
      setExpanded(null);
    } else {
      setExpanded(projectId);
      loadMembers(projectId);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!selectedUserId) return;
    setAddError('');
    try {
      await api.post(`/api/projects/${addMemberOpen}/members`, { userId: parseInt(selectedUserId) });
      const user = allUsers.find((u) => u.id === parseInt(selectedUserId));
      setProjectMembers((prev) => ({
        ...prev,
        [addMemberOpen]: [...(prev[addMemberOpen] || []), user],
      }));
      setSelectedUserId('');
      setAddMemberOpen(null);
      toast({ title: 'Member added', variant: 'success' });
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add member');
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    const { projectId, userId } = removeTarget;
    try {
      await api.delete(`/api/projects/${projectId}/members/${userId}`);
      setProjectMembers((prev) => ({
        ...prev,
        [projectId]: prev[projectId]?.filter((m) => m.id !== userId) || [],
      }));
      toast({ title: 'Member removed', variant: 'success' });
    } catch {
      toast({ title: 'Failed to remove member', variant: 'destructive' });
    } finally {
      setRemoveTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div key={project.id} className="rounded-lg border overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors text-left"
            onClick={() => toggleExpand(project.id)}
          >
            <span>{project.name}</span>
            <span className="text-[hsl(var(--muted-foreground))]">
              {expanded === project.id ? '▲' : '▼'}
            </span>
          </button>

          {expanded === project.id && (
            <div className="border-t px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Members</p>
                <Button size="sm" variant="outline" onClick={() => { setAddMemberOpen(project.id); setAddError(''); }}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Member
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(projectMembers[project.id] || []).map((m) => (
                  <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--muted))] pl-3 pr-1 py-1 text-xs">
                    {m.username}
                    <Badge variant={m.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
                      {m.role}
                    </Badge>
                    <button
                      className="ml-1 rounded-full p-0.5 hover:bg-red-100 hover:text-red-600 transition-colors"
                      onClick={() => setRemoveTarget({ projectId: project.id, userId: m.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {projectMembers[project.id]?.length === 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No members.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add member dialog */}
      <Dialog open={Boolean(addMemberOpen)} onOpenChange={(v) => !v && setAddMemberOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Select a user to add to this project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Select a user…" /></SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((u) => !projectMembers[addMemberOpen]?.find((m) => m.id === u.id))
                    .map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username} ({u.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddMemberOpen(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedUserId}>Add</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation */}
      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user from the project. They will lose access to all project tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────

function AssignmentsTab() {
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [taskLists, setTaskLists] = useState({});
  const [tasks, setTasks] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [assignOpen, setAssignOpen] = useState(null); // task id
  const [assignForm, setAssignForm] = useState({ userId: '', permission: 'view' });
  const [assignError, setAssignError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/projects'),
      api.get('/api/admin/users'),
    ]).then(([projRes, userRes]) => {
      setProjects(projRes.data);
      setAllUsers(userRes.data);
    }).finally(() => setLoading(false));
  }, []);

  async function toggleProject(projectId) {
    if (expanded === projectId) { setExpanded(null); return; }
    setExpanded(projectId);
    if (!taskLists[projectId]) {
      const res = await api.get(`/api/projects/${projectId}/task-lists`);
      setTaskLists((prev) => ({ ...prev, [projectId]: res.data }));
      for (const list of res.data) {
        if (!tasks[list.id]) {
          api.get(`/api/task-lists/${list.id}/tasks`).then((r) => {
            setTasks((prev) => ({ ...prev, [list.id]: r.data }));
          });
        }
      }
    }
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!assignOpen || !assignForm.userId) return;
    setAssignError('');
    try {
      await api.post(`/api/tasks/${assignOpen}/assignments`, {
        userId: parseInt(assignForm.userId),
        permission: assignForm.permission,
      });
      // Refresh the task's detail
      const res = await api.get(`/api/tasks/${assignOpen}`);
      setTasks((prev) => {
        const updated = { ...prev };
        for (const listId of Object.keys(updated)) {
          updated[listId] = updated[listId].map((t) =>
            t.id === assignOpen ? { ...t, assignments: res.data.assignments } : t
          );
        }
        return updated;
      });
      setAssignOpen(null);
      setAssignForm({ userId: '', permission: 'view' });
      toast({ title: 'Assignment added', variant: 'success' });
    } catch (err) {
      setAssignError(err.response?.data?.error || 'Failed to add assignment');
    }
  }

  async function handleRemoveAssignment(taskId, userId) {
    try {
      await api.delete(`/api/tasks/${taskId}/assignments/${userId}`);
      setTasks((prev) => {
        const updated = { ...prev };
        for (const listId of Object.keys(updated)) {
          updated[listId] = updated[listId].map((t) =>
            t.id === taskId
              ? { ...t, assignments: (t.assignments || []).filter((a) => a.id !== userId) }
              : t
          );
        }
        return updated;
      });
      toast({ title: 'Assignment removed', variant: 'success' });
    } catch {
      toast({ title: 'Failed to remove assignment', variant: 'destructive' });
    }
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div key={project.id} className="rounded-lg border overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors text-left"
            onClick={() => toggleProject(project.id)}
          >
            <span>{project.name}</span>
            <span className="text-[hsl(var(--muted-foreground))]">
              {expanded === project.id ? '▲' : '▼'}
            </span>
          </button>

          {expanded === project.id && (
            <div className="border-t divide-y">
              {(taskLists[project.id] || []).map((list) => (
                <div key={list.id} className="px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))] tracking-wider">
                    {list.name}
                  </p>
                  {(tasks[list.id] || []).map((task) => (
                    <div key={task.id} className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{task.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={async () => {
                            // Load full task with assignments
                            const res = await api.get(`/api/tasks/${task.id}`);
                            setTasks((prev) => {
                              const updated = { ...prev };
                              updated[list.id] = updated[list.id].map((t) =>
                                t.id === task.id ? { ...t, assignments: res.data.assignments } : t
                              );
                              return updated;
                            });
                            setAssignOpen(task.id);
                            setAssignError('');
                            setAssignForm({ userId: '', permission: 'view' });
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Assign
                        </Button>
                      </div>
                      {task.assignments?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {task.assignments.map((a) => (
                            <span key={a.id} className="flex items-center gap-1 rounded-full bg-white dark:bg-[hsl(var(--card))] px-2 py-0.5 text-xs border">
                              {a.username}
                              <Badge variant={a.permission === 'edit' ? 'default' : 'secondary'} className="text-[10px] px-1">
                                {a.permission}
                              </Badge>
                              <button
                                className="hover:text-red-600 ml-0.5"
                                onClick={() => handleRemoveAssignment(task.id, a.id)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Assign dialog */}
      <Dialog open={Boolean(assignOpen)} onOpenChange={(v) => !v && setAssignOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User</DialogTitle>
            <DialogDescription>Add a user assignment to this task.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssign} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>User</Label>
              <Select
                value={assignForm.userId}
                onValueChange={(v) => setAssignForm((p) => ({ ...p, userId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a user…" /></SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.username} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Permission</Label>
              <Select
                value={assignForm.permission}
                onValueChange={(v) => setAssignForm((p) => ({ ...p, permission: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignError && <p className="text-sm text-red-600">{assignError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
              <Button type="submit" disabled={!assignForm.userId}>Assign</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

export function Admin() {
  const { user } = useAuth();

  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-primary)]/10">
          <Shield className="h-5 w-5 text-[var(--brand-primary)]" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1a1a2e] dark:text-white">Admin Panel</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Manage users, projects, and assignments</p>
        </div>
      </div>

      <Separator className="mb-6" />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="projects"><ProjectsTab /></TabsContent>
        <TabsContent value="assignments"><AssignmentsTab /></TabsContent>
      </Tabs>
    </>
  );
}
