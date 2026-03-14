import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Calendar, User, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import logo from '@/assets/logo.png';

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Public Project View ──────────────────────────────────────────────────────

function PublicProjectView({ project, taskLists }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{project.name}</h2>
        {project.description && (
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">{project.description}</p>
        )}
        {project.members?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.members.map(m => (
              <span key={m.id} className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium">
                {m.username}
              </span>
            ))}
          </div>
        )}
      </div>

      {taskLists.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">No task lists yet.</p>
      ) : (
        <div className="space-y-4">
          {taskLists.map(list => (
            <div key={list.id} className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
              <div className="border-b px-4 py-3 font-semibold text-sm">{list.name}</div>
              {list.tasks.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))] px-4 py-4">No tasks.</p>
              ) : (
                <div className="divide-y">
                  {list.tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-sm font-medium">{task.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                            <Calendar className="h-3 w-3" />
                            {formatDate(task.due_date)}
                          </span>
                        )}
                        <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs capitalize">
                          {task.status?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Public Task View ─────────────────────────────────────────────────────────

function PublicTaskView({ task, comments }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-[hsl(var(--card))] p-6 space-y-4">
        <div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{task.project_name}</p>
          <h2 className="text-2xl font-bold">{task.name}</h2>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
            <CheckCircle2 className="h-4 w-4" />
            <span className="capitalize">{task.status?.replace('_', ' ')}</span>
          </div>
          {task.due_date && (
            <div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(task.due_date)}</span>
            </div>
          )}
        </div>

        {task.assignees?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wide">Assignees</p>
            <div className="flex flex-wrap gap-1.5">
              {task.assignees.map(a => (
                <span key={a.id} className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium">
                  <User className="h-2.5 w-2.5" />
                  {a.username}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comments */}
      {comments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Comments</h3>
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="h-7 w-7 shrink-0 rounded-full bg-[#0066CC] flex items-center justify-center text-white text-xs font-bold">
                  {(c.username || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{c.username}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-[hsl(var(--foreground))]">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Error Page ───────────────────────────────────────────────────────────────

function ErrorPage({ code }) {
  const messages = {
    expired: { icon: Clock, title: 'Link Expired', desc: 'This share link has expired and is no longer accessible.' },
    disabled: { icon: AlertCircle, title: 'Link Disabled', desc: 'This share link has been disabled by its owner.' },
    notfound: { icon: AlertCircle, title: 'Link Not Found', desc: 'This share link doesn\'t exist or has been revoked.' },
    error: { icon: AlertCircle, title: 'Something went wrong', desc: 'We couldn\'t load this shared content. Please try again later.' },
  };
  const { icon: Icon, title, desc } = messages[code] || messages.error;

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <Icon className="h-12 w-12 text-[hsl(var(--muted-foreground))] mb-4" />
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm mb-6">{desc}</p>
      <Link
        to="/dashboard"
        className="rounded-md bg-[#0066CC] px-4 py-2 text-sm font-medium text-white hover:bg-[#0052a3] transition-colors"
      >
        Go to Kuma
      </Link>
    </div>
  );
}

// ─── Main Share View ──────────────────────────────────────────────────────────

export function ShareView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`/api/share/${token}`)
      .then(res => setData(res.data.data))
      .catch(err => {
        const status = err.response?.status;
        if (status === 410) setError('expired');
        else if (status === 403) setError('disabled');
        else if (status === 404) setError('notfound');
        else setError('error');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b bg-[hsl(var(--card))] shadow-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={logo} alt="Kuma" className="h-8 w-auto" width="32" height="32" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-xs font-medium">
              Read-only view
            </span>
            <Link
              to="/dashboard"
              className="rounded-md bg-[#0066CC] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0052a3] transition-colors"
            >
              Sign in to collaborate
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0066CC] border-t-transparent" />
          </div>
        ) : error ? (
          <ErrorPage code={error} />
        ) : data?.type === 'project' ? (
          <PublicProjectView project={data.project} taskLists={data.taskLists} />
        ) : data?.type === 'task' ? (
          <PublicTaskView task={data.task} comments={data.comments} />
        ) : null}
      </main>

      {/* Footer CTA */}
      {!loading && !error && (
        <footer className="border-t mt-12">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Collaborate on Kuma</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Sign up to comment, assign tasks, and manage projects.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="shrink-0 rounded-md bg-[#0066CC] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0052a3] transition-colors"
            >
              Get started free
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
