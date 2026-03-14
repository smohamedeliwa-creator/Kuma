import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, FolderOpen, Users, CheckSquare } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getProjectStatus } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const STATUS_VARIANTS = {
  Done: 'success',
  'In Progress': 'info',
  'To Do': 'secondary',
  Empty: 'outline',
};

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full mt-1" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
      <CardFooter className="pt-0 gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </CardFooter>
    </Card>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, isAdmin, onEdit, onDelete, onClick }) {
  const status = getProjectStatus(project);
  const memberCount = project.member_count ?? 0;

  return (
    <Card
      className="group relative cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-1 flex-1">{project.name}</CardTitle>
          {isAdmin && (
            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                aria-label="Edit project"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                aria-label="Delete project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <Badge variant={STATUS_VARIANTS[status] || 'secondary'} className="w-fit text-xs">
          {status}
        </Badge>
      </CardHeader>

      <CardContent className="pb-2">
        <CardDescription className="line-clamp-2 text-sm min-h-[2.5rem]">
          {project.description || 'No description provided.'}
        </CardDescription>
      </CardContent>

      <CardFooter className="pt-2 border-t text-xs text-[hsl(var(--muted-foreground))] gap-4">
        <span className="flex items-center gap-1">
          <CheckSquare className="h-3.5 w-3.5" />
          {project.task_count ?? 0} task{project.task_count !== 1 ? 's' : ''}
          {project.task_count > 0 && ` · ${project.done_count ?? 0} done`}
        </span>
        {memberCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

// ─── Project Form Dialog ──────────────────────────────────────────────────────

function ProjectFormDialog({ open, onOpenChange, project, onSaved }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(project);

  useEffect(() => {
    if (open) {
      setName(project?.name || '');
      setDescription(project?.description || '');
      setError('');
    }
  }, [open, project]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        const res = await api.put(`/api/projects/${project.id}`, { name, description });
        onSaved(res.data);
        toast({ title: 'Project updated', variant: 'success' });
      } else {
        const res = await api.post('/api/projects', { name, description });
        onSaved(res.data);
        toast({ title: 'Project created', variant: 'success' });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Project' : 'New Project'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update project details.' : 'Create a new audio project.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Album Mastering 2025"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project…"
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get('/api/projects');
      setProjects(res.data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  function handleEdit(project) {
    setEditProject(project);
    setFormOpen(true);
  }

  function handleSaved(updated) {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updated };
        return next;
      }
      return [{ ...updated, member_count: 1 }, ...prev];
    });
    setEditProject(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/projects/${deleteTarget.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast({ title: 'Project deleted', variant: 'success' });
      setDeleteTarget(null);
    } catch {
      toast({ title: 'Failed to delete project', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1a1a2e] dark:text-white">Projects</h1>
          {!loading && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditProject(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
            <FolderOpen className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          </div>
          <h2 className="text-xl font-semibold">No projects yet</h2>
          {isAdmin ? (
            <>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Create your first project to get started.
              </p>
              <Button className="mt-4" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </>
          ) : (
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              You haven't been added to any projects yet.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onClick={() => navigate(`/projects/${p.id}`)}
            />
          ))}
        </div>
      )}

      {/* Project form dialog */}
      <ProjectFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditProject(null); }}
        project={editProject}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project along with all its task lists, tasks, and
              comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
