import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ArrowUpRight, MoreHorizontal, Check, Plus, Trash2, Calendar,
  User, AlertCircle, ArrowUp, Minus, ArrowDown, Loader2, Send,
  Mic, Paperclip, StopCircle, Download, FileText, Image as ImageIcon,
  Music2, Video, Play, Pause, MessageSquare, Activity, ChevronDown,
  Share2, Copy, Link,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getDueDateStatus } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  ColumnTypeIcon, ColumnField,
} from '@/components/CustomColumns';
import { ShareDialog } from '@/components/ShareDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getContrastColor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.179 ? '#1a1a2e' : '#ffffff';
  } catch { return '#ffffff'; }
}

function formatDuration(seconds) {
  const s = Math.floor(seconds || 0);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return ImageIcon;
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) return Music2;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return Video;
  return FileText;
}

function isImageFile(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

function getPersonColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#0066CC', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#9333EA', '#16A34A'];
  return colors[Math.abs(hash) % colors.length];
}

const PRIORITY_MAP = {
  urgent: { icon: AlertCircle, color: '#EF4444', label: 'Urgent' },
  high:   { icon: ArrowUp,     color: '#F97316', label: 'High' },
  normal: { icon: Minus,       color: '#3B82F6', label: 'Normal' },
  low:    { icon: ArrowDown,   color: '#94A3B8', label: 'Low' },
};

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

function AudioPlayer({ src, duration }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const total = duration || 0;

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} src={src} onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)} onEnded={() => setPlaying(false)} />
      <button onClick={toggle} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0066CC] text-white hover:bg-[#0052A3] transition-colors shrink-0">
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 h-1 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
        <div className="h-full bg-[#0066CC] rounded-full transition-all" style={{ width: total > 0 ? `${(current / total) * 100}%` : '0%' }} />
      </div>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-8 text-right">{formatDuration(playing ? current : total)}</span>
    </div>
  );
}

// ─── PropRow ──────────────────────────────────────────────────────────────────

function PropRow({ label, children }) {
  return (
    <div className="flex items-start min-h-[36px] rounded-md px-2 hover:bg-[hsl(var(--muted))]/60 transition-colors group">
      <div className="w-[140px] shrink-0 min-h-[36px] flex items-center">
        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</span>
      </div>
      <div className="flex-1 min-h-[36px] flex items-center min-w-0">{children}</div>
    </div>
  );
}

// ─── TaskDrawer ───────────────────────────────────────────────────────────────

export function TaskDrawer({
  taskId,
  projectId,
  projectName = '',
  listName = '',
  open,
  onOpenChange,
  isAdmin,
  onUpdated,
  onDeleted,
  statuses = [],
  listColumns = [],
  onColValuesSaved,
  columns = [],
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Core state
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [completed, setCompleted] = useState(false);

  // Subtasks
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(true);
  const newSubtaskRef = useRef(null);

  // Comments / activity
  const [activeTab, setActiveTab] = useState('comments');
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);

  // Assignees
  const [projectMembers, setProjectMembers] = useState([]);
  const [addAssigneeOpen, setAddAssigneeOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [newPermission, setNewPermission] = useState('view');
  const [assigneeBusy, setAssigneeBusy] = useState(false);

  // Custom columns
  const [colValues, setColValues] = useState({});
  const colSaveTimeouts = useRef({});

  // Other UI
  const [moreOpen, setMoreOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [savingField, setSavingField] = useState(null);
  const saveTimeoutsRef = useRef({});

  // Load data when drawer opens
  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    setTask(null);
    setSubtasks([]);
    setComments([]);
    setActivity([]);
    setColValues({});
    setCompleted(false);

    Promise.all([
      api.get(`/api/tasks/${taskId}`),
      api.get(`/api/tasks/${taskId}/comments`),
      api.get(`/api/tasks/${taskId}/subtasks`),
      api.get(`/api/tasks/${taskId}/activity`),
      api.get(`/api/tasks/${taskId}/column-values`),
    ]).then(([taskRes, commentsRes, subtasksRes, activityRes, colValsRes]) => {
      const t = taskRes.data;
      setTask(t);
      setName(t.name);
      setDescription(t.description || '');
      setDueDate(t.due_date || '');
      setStatus(t.status);
      setPriority(t.priority || 'normal');
      setComments(commentsRes.data);
      setSubtasks(subtasksRes.data);
      setActivity(activityRes.data);
      const vals = {};
      for (const v of colValsRes.data) vals[v.column_id] = v.value;
      setColValues(vals);
    }).finally(() => setLoading(false));
  }, [open, taskId]);

  useEffect(() => {
    if (!open || !projectId) return;
    api.get(`/api/projects/${projectId}`).then(res => setProjectMembers(res.data.members || []));
  }, [open, projectId]);

  const canEdit = isAdmin || task?.assignments?.some(a => a.id === user?.id && a.permission === 'edit');

  // ── Save helpers ─────────────────────────────────────────────────────────────

  async function saveTaskField(field, value) {
    setSavingField(field);
    try {
      const res = await api.put(`/api/tasks/${taskId}`, { [field]: value });
      setTask(prev => ({ ...prev, ...res.data }));
      onUpdated?.(res.data);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingField(null);
    }
  }

  function scheduleSave(field, value, delay = 600) {
    clearTimeout(saveTimeoutsRef.current[field]);
    saveTimeoutsRef.current[field] = setTimeout(() => saveTaskField(field, value), delay);
  }

  async function handleStatusChange(newStatus) {
    setStatus(newStatus);
    await saveTaskField('status', newStatus);
  }

  async function handlePriorityChange(newPriority) {
    setPriority(newPriority);
    await saveTaskField('priority', newPriority);
  }

  async function handleDueDateChange(newDate) {
    setDueDate(newDate);
    await saveTaskField('due_date', newDate || null);
  }

  async function handleColValueChange(colId, value) {
    setColValues(prev => ({ ...prev, [colId]: value }));
    clearTimeout(colSaveTimeouts.current[colId]);
    colSaveTimeouts.current[colId] = setTimeout(async () => {
      try {
        const res = await api.put(`/api/tasks/${taskId}/column-values`, {
          values: [{ column_id: colId, value }],
        });
        onColValuesSaved?.(taskId, res.data);
      } catch {
        toast({ title: 'Failed to save', variant: 'destructive' });
      }
    }, 300);
  }

  // ── Complete toggle ──────────────────────────────────────────────────────────

  async function handleToggleComplete() {
    const doneStatus = statuses.find(s => s.key === 'done' || s.label?.toLowerCase() === 'done');
    const todoStatus = statuses.find(s => s.key === 'todo' || s.label?.toLowerCase() === 'to do');
    if (!doneStatus) return;
    const next = completed ? (todoStatus?.key || statuses[0]?.key) : doneStatus.key;
    setCompleted(!completed);
    setStatus(next);
    await saveTaskField('status', next);
  }

  // ── Assignees ────────────────────────────────────────────────────────────────

  async function handleAddAssignee(memberId) {
    setAssigneeBusy(true);
    try {
      await api.post(`/api/tasks/${taskId}/assignments`, { userId: memberId, permission: newPermission });
      const member = projectMembers.find(m => m.id === memberId);
      setTask(prev => ({
        ...prev,
        assignments: [...(prev.assignments || []), { id: memberId, username: member.username, permission: newPermission }],
      }));
      setAddAssigneeOpen(false);
      setMemberSearch('');
      toast({ title: `${member.username} assigned`, variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to assign', variant: 'destructive' });
    } finally {
      setAssigneeBusy(false);
    }
  }

  async function handleRemoveAssignee(memberId) {
    try {
      await api.delete(`/api/tasks/${taskId}/assignments/${memberId}`);
      setTask(prev => ({ ...prev, assignments: prev.assignments.filter(a => a.id !== memberId) }));
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to remove', variant: 'destructive' });
    }
  }

  // ── Delete task ──────────────────────────────────────────────────────────────

  async function handleDelete() {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      onDeleted?.(taskId);
      onOpenChange(false);
      toast({ title: 'Task deleted', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete', variant: 'destructive' });
    }
  }

  // ── Subtasks ─────────────────────────────────────────────────────────────────

  async function handleAddSubtask() {
    if (!newSubtaskText.trim()) return;
    try {
      const res = await api.post(`/api/tasks/${taskId}/subtasks`, { name: newSubtaskText.trim() });
      setSubtasks(prev => [...prev, res.data]);
      setNewSubtaskText('');
      newSubtaskRef.current?.focus();
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to add subtask', variant: 'destructive' });
    }
  }

  async function handleToggleSubtask(subtaskId, checked) {
    setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, checked: checked ? 1 : 0 } : s));
    try {
      await api.put(`/api/subtasks/${subtaskId}`, { checked });
    } catch {
      setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, checked: checked ? 0 : 1 } : s));
    }
  }

  async function handleDeleteSubtask(subtaskId) {
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    try {
      await api.delete(`/api/subtasks/${subtaskId}`);
    } catch {
      // silently fail; user sees it gone already
    }
  }

  // ── Voice recording ──────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        setVoiceDuration(recordingSeconds);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      toast({ title: 'Microphone access denied', variant: 'destructive' });
    }
  }

  function stopRecording() {
    clearInterval(recordTimerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function clearVoice() {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceBlob(null);
    setVoiceUrl(null);
    setVoiceDuration(0);
    setRecordingSeconds(0);
  }

  // ── Comments ─────────────────────────────────────────────────────────────────

  async function handleSend(e) {
    e.preventDefault();
    if (!commentText.trim() && !voiceBlob && !attachedFile) return;
    setSendingComment(true);
    try {
      let newComment;
      if (voiceBlob) {
        const form = new FormData();
        form.append('file', voiceBlob, 'voice.webm');
        form.append('type', 'voice');
        form.append('duration', String(voiceDuration));
        const res = await api.post(`/api/tasks/${taskId}/comments/upload`, form);
        newComment = res.data;
        clearVoice();
      } else if (attachedFile) {
        const form = new FormData();
        form.append('file', attachedFile);
        form.append('type', 'file');
        const res = await api.post(`/api/tasks/${taskId}/comments/upload`, form);
        newComment = res.data;
        setAttachedFile(null);
      } else {
        const res = await api.post(`/api/tasks/${taskId}/comments`, { content: commentText });
        newComment = res.data;
        setCommentText('');
      }
      setComments(prev => [...prev, newComment]);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to send', variant: 'destructive' });
    } finally {
      setSendingComment(false);
    }
  }

  async function handleDeleteComment() {
    if (!deleteCommentTarget) return;
    setDeletingComment(true);
    try {
      await api.delete(`/api/comments/${deleteCommentTarget}`);
      setComments(prev => prev.map(c => c.id === deleteCommentTarget ? { ...c, deleted_at: new Date().toISOString() } : c));
      setDeleteCommentTarget(null);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeletingComment(false);
    }
  }

  // ── Copy link ────────────────────────────────────────────────────────────────

  function handleCopyLink() {
    const url = `${window.location.origin}/tasks/${taskId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Link copied', variant: 'success' });
    });
    setMoreOpen(false);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const currentStatus = statuses.find(s => s.key === status);
  const dueDateStatus = getDueDateStatus(dueDate);
  const PriorityMeta = PRIORITY_MAP[priority] || PRIORITY_MAP.normal;
  const PriorityIcon = PriorityMeta.icon;
  const doneStatus = statuses.find(s => s.key === 'done' || s.label?.toLowerCase() === 'done');
  const isComplete = status === doneStatus?.key;
  const subtasksDone = subtasks.filter(s => s.checked).length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={[
          'fixed right-0 top-0 z-50 h-full flex flex-col',
          'bg-[hsl(var(--background))] border-l border-[hsl(var(--border))]',
          'shadow-2xl transition-transform duration-250 ease-out',
          // widths: full mobile, 100vw-60px tablet, 480px desktop
          'w-full sm:w-[calc(100vw-60px)] lg:w-[480px]',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ transitionDuration: open ? '250ms' : '200ms' }}
      >
        {loading ? (
          <div className="flex flex-col gap-4 p-6 animate-pulse">
            <div className="h-5 w-32 rounded bg-[hsl(var(--muted))]" />
            <div className="h-8 w-3/4 rounded bg-[hsl(var(--muted))]" />
            <div className="h-4 w-24 rounded bg-[hsl(var(--muted))]" />
            <div className="mt-4 space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-9 w-full rounded bg-[hsl(var(--muted))]" />)}
            </div>
          </div>
        ) : (
          <>
            {/* ── Fixed Header ── */}
            <div className="shrink-0 border-b border-[hsl(var(--border))] px-4 py-3 flex flex-col gap-2">
              {/* Breadcrumb + action buttons */}
              <div className="flex items-center justify-between gap-2">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] min-w-0">
                  {projectName && (
                    <>
                      <span className="truncate max-w-[120px]">{projectName}</span>
                      <span>/</span>
                    </>
                  )}
                  {listName && (
                    <>
                      <span className="truncate max-w-[120px]">{listName}</span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Open full page */}
                  <button
                    onClick={() => { onOpenChange(false); navigate(`/tasks/${taskId}`); }}
                    title="Open full page"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </button>

                  {/* Share */}
                  <button
                    onClick={() => setShareOpen(true)}
                    title="Share task"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>

                  {/* More options */}
                  <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                    <PopoverTrigger asChild>
                      <button title="More options" className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-44 p-1">
                      <button
                        onClick={handleCopyLink}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                      >
                        <Link className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                        Copy link
                      </button>
                      <button
                        onClick={() => { navigate(`/tasks/${taskId}`); onOpenChange(false); setMoreOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                        Open full page
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { setDeleteOpen(true); setMoreOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete task
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>

                  {/* Close */}
                  <button
                    onClick={() => onOpenChange(false)}
                    title="Close"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Complete button + Title */}
              <div className="flex items-start gap-3">
                {/* Round complete checkbox */}
                <button
                  onClick={handleToggleComplete}
                  disabled={!canEdit || !doneStatus}
                  title={isComplete ? 'Mark incomplete' : 'Mark complete'}
                  className={[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
                    isComplete
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-[hsl(var(--border))] hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20',
                    !canEdit || !doneStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  {isComplete && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>

                {/* Task title */}
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); if (canEdit) scheduleSave('name', e.target.value); }}
                  disabled={!canEdit}
                  placeholder="Task name"
                  className="flex-1 min-w-0 bg-transparent text-[17px] font-semibold leading-snug outline-none border-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] disabled:cursor-default"
                />
              </div>

              {/* Status pill */}
              <div className="ml-8">
                <Popover>
                  <PopoverTrigger asChild disabled={!canEdit}>
                    <button className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer disabled:cursor-default transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: currentStatus?.color || '#94a3b8',
                        color: getContrastColor(currentStatus?.color || '#94a3b8'),
                      }}
                    >
                      {currentStatus?.label || status}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-44 p-1">
                    {statuses.map(s => (
                      <button key={s.key} onClick={() => handleStatusChange(s.key)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        {s.label}
                        {status === s.key && <Check className="ml-auto h-3.5 w-3.5 text-[#0066CC]" />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* Properties */}
              <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
                {/* Assignees */}
                <PropRow label="Assignees">
                  <div className="flex flex-wrap items-center gap-1 py-1">
                    {task?.assignments?.map(a => {
                      const color = getPersonColor(a.username);
                      return (
                        <span key={a.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: color }}>
                          {a.username[0].toUpperCase()}&nbsp;{a.username}
                          {isAdmin && (
                            <button onClick={() => handleRemoveAssignee(a.id)} className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                    {!task?.assignments?.length && <span className="text-sm text-[hsl(var(--muted-foreground))] italic">Unassigned</span>}
                    {isAdmin && (
                      <Popover open={addAssigneeOpen} onOpenChange={v => { setAddAssigneeOpen(v); if (!v) { setMemberSearch(''); setNewPermission('view'); } }}>
                        <PopoverTrigger asChild>
                          <button className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[#0066CC] hover:text-[#0066CC] transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-60 p-3 space-y-2">
                          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Add Assignee</p>
                          <input
                            placeholder="Search members…"
                            value={memberSearch}
                            onChange={e => setMemberSearch(e.target.value)}
                            className="w-full h-8 px-2 text-sm border border-[hsl(var(--border))] rounded-md bg-transparent outline-none focus:border-[#0066CC]"
                            autoFocus
                          />
                          <Select value={newPermission} onValueChange={setNewPermission}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="view">View</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="max-h-40 overflow-y-auto space-y-0.5">
                            {projectMembers
                              .filter(m => !task?.assignments?.some(a => a.id === m.id))
                              .filter(m => m.username.toLowerCase().includes(memberSearch.toLowerCase()))
                              .map(m => (
                                <button key={m.id} disabled={assigneeBusy} onClick={() => handleAddAssignee(m.id)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50">
                                  <User className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                                  <span className="flex-1 truncate text-left">{m.username}</span>
                                </button>
                              ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </PropRow>

                {/* Due date */}
                <PropRow label="Due date">
                  <div className="flex items-center gap-1.5 w-full py-1">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => handleDueDateChange(e.target.value)}
                      disabled={!canEdit}
                      className={[
                        'text-sm bg-transparent outline-none disabled:cursor-default',
                        !dueDate ? 'italic text-[hsl(var(--muted-foreground))]' :
                        dueDateStatus === 'overdue' ? 'text-red-500' : 'text-[hsl(var(--foreground))]',
                      ].join(' ')}
                    />
                    {dueDate && canEdit && (
                      <button onClick={() => handleDueDateChange('')} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </PropRow>

                {/* Priority */}
                <PropRow label="Priority">
                  <Popover>
                    <PopoverTrigger asChild disabled={!canEdit}>
                      <button className="flex items-center gap-1.5 text-sm py-1 px-1 rounded hover:bg-[hsl(var(--muted))] transition-colors disabled:cursor-default">
                        <PriorityIcon className="h-3.5 w-3.5" style={{ color: PriorityMeta.color }} />
                        <span style={{ color: PriorityMeta.color }}>{PriorityMeta.label}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-36 p-1">
                      {Object.entries(PRIORITY_MAP).map(([key, meta]) => {
                        const PIco = meta.icon;
                        return (
                          <button key={key} onClick={() => handlePriorityChange(key)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors">
                            <PIco className="h-3.5 w-3.5" style={{ color: meta.color }} />
                            {meta.label}
                            {priority === key && <Check className="ml-auto h-3 w-3 text-[#0066CC]" />}
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                </PropRow>

                {/* Created by */}
                <PropRow label="Created by">
                  <span className="text-sm text-[hsl(var(--foreground))] py-1">{task?.created_by_username || '—'}</span>
                </PropRow>

                {/* Created at */}
                <PropRow label="Created on">
                  <span className="text-sm text-[hsl(var(--muted-foreground))] py-1">
                    {task?.created_at ? new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                </PropRow>

                {/* Custom columns */}
                {listColumns.length > 0 && (
                  <div className="mt-1 pt-2 border-t border-[hsl(var(--border))]">
                    {listColumns.map(col => (
                      <div key={col.id} className="flex items-start min-h-[36px] rounded-md px-2 hover:bg-[hsl(var(--muted))]/60 transition-colors">
                        <div className="w-[140px] shrink-0 min-h-[36px] flex items-center gap-1.5">
                          <ColumnTypeIcon type={col.type} className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium truncate">{col.name}</span>
                        </div>
                        <div className="flex-1 min-h-[36px] flex items-center">
                          <ColumnField column={col} value={colValues[col.id] ?? null} onChange={val => handleColValueChange(col.id, val)} members={projectMembers} canEdit={canEdit} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
                <textarea
                  value={description}
                  onChange={e => { setDescription(e.target.value); if (canEdit) scheduleSave('description', e.target.value, 800); }}
                  disabled={!canEdit}
                  placeholder="Add a description…"
                  rows={3}
                  className="w-full bg-transparent text-sm leading-relaxed text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none border border-transparent rounded-md p-2 focus:border-[hsl(var(--border))] transition-colors resize-none min-h-[80px] disabled:cursor-default"
                />
              </div>

              {/* Subtasks */}
              <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
                <button
                  onClick={() => setSubtasksOpen(p => !p)}
                  className="flex items-center gap-2 w-full text-sm font-semibold text-[hsl(var(--foreground))] mb-2 hover:text-[#0066CC] transition-colors"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${subtasksOpen ? '' : '-rotate-90'}`} />
                  Subtasks
                  <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
                    {subtasksDone}/{subtasks.length}
                  </span>
                </button>

                {subtasksOpen && (
                  <div className="space-y-1">
                    {subtasks.map(st => (
                      <div key={st.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-[hsl(var(--muted))]/60 transition-colors">
                        <button
                          onClick={() => handleToggleSubtask(st.id, !st.checked)}
                          className={[
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                            st.checked ? 'border-green-500 bg-green-500 text-white' : 'border-[hsl(var(--border))] hover:border-green-400',
                          ].join(' ')}
                        >
                          {st.checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                        </button>
                        <span className={`flex-1 text-sm ${st.checked ? 'line-through text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>
                          {st.name}
                        </span>
                        <button
                          onClick={() => handleDeleteSubtask(st.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(var(--muted-foreground))] hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add subtask input */}
                    {addingSubtask ? (
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-[hsl(var(--border))]" />
                        <input
                          ref={newSubtaskRef}
                          value={newSubtaskText}
                          onChange={e => setNewSubtaskText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddSubtask();
                            if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskText(''); }
                          }}
                          placeholder="Subtask name…"
                          autoFocus
                          className="flex-1 text-sm bg-transparent outline-none border-b border-[hsl(var(--border))] focus:border-[#0066CC] py-1 transition-colors"
                        />
                        <button onClick={handleAddSubtask} className="text-[#0066CC] hover:text-[#0052A3] transition-colors">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setAddingSubtask(false); setNewSubtaskText(''); }} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingSubtask(true)}
                        className="flex items-center gap-2 px-1 py-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[#0066CC] transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add subtask
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Fixed Bottom: Comments / Activity ── */}
            <div className="shrink-0 border-t border-[hsl(var(--border))] flex flex-col" style={{ maxHeight: '42%' }}>
              {/* Tab bar */}
              <div className="flex border-b border-[hsl(var(--border))] shrink-0">
                {[
                  { key: 'comments', icon: MessageSquare, label: 'Comments', count: comments.length },
                  { key: 'activity', icon: Activity, label: 'Activity' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                      activeTab === tab.key
                        ? 'border-[#0066CC] text-[#0066CC]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                    ].join(' ')}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">({tab.count})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {activeTab === 'comments' && (
                  <div className="space-y-2">
                    {comments.length === 0 && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] py-1">No comments yet.</p>
                    )}
                    {comments.map(c => {
                      const isDeleted = !!c.deleted_at;
                      const canDeleteComment = c.user_id === user?.id || isAdmin;
                      const color = getPersonColor(c.username || '');
                      return (
                        <div key={c.id} className="group rounded-lg bg-[hsl(var(--muted))]/60 p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: color }}>
                              {(c.username || '?')[0].toUpperCase()}
                            </span>
                            <span className="text-xs font-semibold" style={{ color }}>{c.username}</span>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              {new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isDeleted && c.type === 'voice' && <span className="text-[10px] bg-[#0066CC]/10 text-[#0066CC] rounded-full px-1.5 py-0.5">Voice</span>}
                            {!isDeleted && canDeleteComment && (
                              <div className="ml-auto">
                                <Popover open={openMenuId === c.id} onOpenChange={v => setOpenMenuId(v ? c.id : null)}>
                                  <PopoverTrigger asChild>
                                    <button className="flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-32 p-1">
                                    <button onClick={() => { setDeleteCommentTarget(c.id); setOpenMenuId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                          </div>
                          {isDeleted ? (
                            <p className="text-sm italic text-[hsl(var(--muted-foreground))]">This comment was deleted.</p>
                          ) : c.type === 'voice' ? (
                            <AudioPlayer src={`/uploads/${c.file_path}`} duration={c.duration || 0} />
                          ) : c.type === 'file' ? (
                            <a href={`/uploads/${c.file_path}`} download={c.file_name} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 hover:bg-[hsl(var(--background))] transition-colors group/dl">
                              {(() => { const FileIcon = getFileIcon(c.file_name); return <FileIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />; })()}
                              <span className="text-sm truncate flex-1">{c.file_name}</span>
                              <Download className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover/dl:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <p className="text-sm leading-relaxed">{c.content}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-1">
                    {activity.length === 0 && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] py-1">No activity yet.</p>
                    )}
                    {activity.map(a => {
                      const color = getPersonColor(a.username || '');
                      const fieldLabels = { status: 'status', priority: 'priority', due_date: 'due date', name: 'title' };
                      return (
                        <div key={a.id} className="flex items-start gap-2 py-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: color }}>
                            {(a.username || '?')[0].toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[hsl(var(--foreground))]">
                              <span className="font-medium" style={{ color }}>{a.username}</span>
                              {' '}changed {fieldLabels[a.action] || a.action}
                              {a.old_value && <> from <span className="font-medium text-[hsl(var(--muted-foreground))]">{a.old_value}</span></>}
                              {a.new_value && <> to <span className="font-medium text-[hsl(var(--foreground))]">{a.new_value}</span></>}
                            </p>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                              {new Date(a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Comment input */}
              {canEdit && activeTab === 'comments' && (
                <form onSubmit={handleSend} className="shrink-0 border-t border-[hsl(var(--border))] px-3 py-2 space-y-2">
                  {voiceUrl && !recording && (
                    <div className="rounded-lg border border-[hsl(var(--border))] p-2 space-y-1">
                      <AudioPlayer src={voiceUrl} duration={voiceDuration} />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Voice · {formatDuration(voiceDuration)}</span>
                        <button type="button" onClick={clearVoice} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      </div>
                    </div>
                  )}
                  {attachedFile && (
                    <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5">
                      {(() => { const FileIcon = getFileIcon(attachedFile.name); return <FileIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />; })()}
                      <span className="text-sm truncate flex-1">{attachedFile.name}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{formatFileSize(attachedFile.size)}</span>
                      <button type="button" onClick={() => setAttachedFile(null)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {recording && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm text-red-600 dark:text-red-400 font-mono">{formatDuration(recordingSeconds)}</span>
                      <span className="text-xs text-red-500">Recording…</span>
                    </div>
                  )}
                  {!voiceBlob && !attachedFile && !recording && (
                    <textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e); }}
                      placeholder="Add a comment…"
                      rows={2}
                      className="w-full bg-transparent text-sm leading-relaxed outline-none border border-[hsl(var(--border))] rounded-md p-2 focus:border-[#0066CC] transition-colors resize-none placeholder:text-[hsl(var(--muted-foreground))]"
                    />
                  )}
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={recording ? stopRecording : startRecording}
                      disabled={!!voiceBlob || !!attachedFile}
                      className={[
                        'flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40',
                        recording ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-950/30' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                      ].join(' ')}
                      title={recording ? 'Stop' : 'Record voice'}
                    >
                      {recording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <label className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors ${(recording || !!voiceBlob) ? 'opacity-40 pointer-events-none' : ''}`} title="Attach file">
                      <Paperclip className="h-4 w-4" />
                      <input ref={fileInputRef} type="file" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = ''; }} disabled={recording || !!voiceBlob} />
                    </label>
                    <button
                      type="submit"
                      disabled={(!commentText.trim() && !voiceBlob && !attachedFile) || sendingComment || recording}
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-[#0066CC] text-white hover:bg-[#0052A3] transition-colors disabled:opacity-40"
                      title="Send"
                    >
                      {sendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete comment dialog */}
      <AlertDialog open={Boolean(deleteCommentTarget)} onOpenChange={v => !v && setDeleteCommentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>The comment will be marked as deleted and its content hidden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment} disabled={deletingComment}>
              {deletingComment ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete task dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the task and all its data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        type="task"
        referenceId={taskId}
        isAdmin={isAdmin}
      />
    </>
  );
}
