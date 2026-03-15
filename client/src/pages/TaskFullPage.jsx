import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, Plus, X, Trash2, MoreHorizontal,
  AlertCircle, ArrowUp, Minus, ArrowDown, Calendar, User,
  MessageSquare, Activity, Loader2, Mic, Paperclip, StopCircle,
  Download, FileText, Image as ImageIcon, Music2, Video, Play, Pause, ArrowUpRight,
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
import { ColumnTypeIcon, ColumnField } from '@/components/CustomColumns';
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

function formatDuration(s) {
  s = Math.floor(s || 0);
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
        <div className="h-full bg-[#0066CC] rounded-full" style={{ width: total > 0 ? `${(current / total) * 100}%` : '0%' }} />
      </div>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{formatDuration(playing ? current : total)}</span>
    </div>
  );
}

function PropRow({ label, children }) {
  return (
    <div className="flex items-start min-h-[36px] rounded-md px-2 hover:bg-[hsl(var(--muted))]/60 transition-colors">
      <div className="w-[140px] shrink-0 min-h-[36px] flex items-center">
        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</span>
      </div>
      <div className="flex-1 min-h-[36px] flex items-center min-w-0">{children}</div>
    </div>
  );
}

// ─── TaskFullPage ──────────────────────────────────────────────────────────────

export function TaskFullPage() {
  const { id: taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [listColumns, setListColumns] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');

  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const newSubtaskRef = useRef(null);

  const [activeTab, setActiveTab] = useState('comments');
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);

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

  const [colValues, setColValues] = useState({});
  const colSaveTimeouts = useRef({});
  const saveTimeoutsRef = useRef({});
  const [savingField, setSavingField] = useState(null);

  const [addAssigneeOpen, setAddAssigneeOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [newPermission, setNewPermission] = useState('view');
  const [assigneeBusy, setAssigneeBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/tasks/${taskId}`),
      api.get(`/api/tasks/${taskId}/comments`),
      api.get(`/api/tasks/${taskId}/subtasks`),
      api.get(`/api/tasks/${taskId}/activity`),
      api.get(`/api/tasks/${taskId}/column-values`),
    ]).then(async ([taskRes, commentsRes, subtasksRes, activityRes, colValsRes]) => {
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

      // Load project-specific data
      const listRes = await api.get(`/api/task-lists/${t.task_list_id}`).catch(() => null);
      if (listRes) {
        const projId = listRes.data.project_id;
        const [projRes, colsRes] = await Promise.all([
          api.get(`/api/projects/${projId}`),
          api.get(`/api/task-lists/${t.task_list_id}/columns`).catch(() => ({ data: [] })),
        ]);
        setStatuses(projRes.data.statuses || []);
        setProjectMembers(projRes.data.members || []);
        setListColumns(colsRes.data);
      }
    }).finally(() => setLoading(false));
  }, [taskId]);

  const canEdit = isAdmin || task?.assignments?.some(a => a.id === user?.id && a.permission === 'edit');

  async function saveTaskField(field, value) {
    setSavingField(field);
    try {
      const res = await api.put(`/api/tasks/${taskId}`, { [field]: value });
      setTask(prev => ({ ...prev, ...res.data }));
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

  const currentStatus = statuses.find(s => s.key === status);
  const doneStatus = statuses.find(s => s.key === 'done' || s.label?.toLowerCase() === 'done');
  const isComplete = status === doneStatus?.key;
  const dueDateStatus = getDueDateStatus(dueDate);
  const PriorityMeta = PRIORITY_MAP[priority] || PRIORITY_MAP.normal;
  const PriorityIcon = PriorityMeta.icon;
  const subtasksDone = subtasks.filter(s => s.checked).length;

  async function handleToggleComplete() {
    const todoStatus = statuses.find(s => s.key === 'todo' || s.label?.toLowerCase() === 'to do');
    const next = isComplete ? (todoStatus?.key || statuses[0]?.key) : doneStatus?.key;
    if (!next) return;
    setStatus(next);
    await saveTaskField('status', next);
  }

  async function handleAddSubtask() {
    if (!newSubtaskText.trim()) return;
    try {
      const res = await api.post(`/api/tasks/${taskId}/subtasks`, { name: newSubtaskText.trim() });
      setSubtasks(prev => [...prev, res.data]);
      setNewSubtaskText('');
      newSubtaskRef.current?.focus();
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed', variant: 'destructive' });
    }
  }

  async function handleToggleSubtask(subtaskId, checked) {
    setSubtasks(prev => prev.map(s => s.id === subtaskId ? { ...s, checked: checked ? 1 : 0 } : s));
    try { await api.put(`/api/subtasks/${subtaskId}`, { checked }); } catch { /* silent */ }
  }

  async function handleDeleteSubtask(subtaskId) {
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    try { await api.delete(`/api/subtasks/${subtaskId}`); } catch { /* silent */ }
  }

  async function handleColValueChange(colId, value) {
    setColValues(prev => ({ ...prev, [colId]: value }));
    clearTimeout(colSaveTimeouts.current[colId]);
    colSaveTimeouts.current[colId] = setTimeout(async () => {
      try { await api.put(`/api/tasks/${taskId}/column-values`, { values: [{ column_id: colId, value }] }); }
      catch { toast({ title: 'Failed to save', variant: 'destructive' }); }
    }, 300);
  }

  async function handleAddAssignee(memberId) {
    setAssigneeBusy(true);
    try {
      await api.post(`/api/tasks/${taskId}/assignments`, { userId: memberId, permission: newPermission });
      const member = projectMembers.find(m => m.id === memberId);
      setTask(prev => ({ ...prev, assignments: [...(prev.assignments || []), { id: memberId, username: member.username, permission: newPermission }] }));
      setAddAssigneeOpen(false);
      setMemberSearch('');
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally { setAssigneeBusy(false); }
  }

  async function handleRemoveAssignee(memberId) {
    try {
      await api.delete(`/api/tasks/${taskId}/assignments/${memberId}`);
      setTask(prev => ({ ...prev, assignments: prev.assignments.filter(a => a.id !== memberId) }));
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed', variant: 'destructive' });
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      toast({ title: 'Task deleted', variant: 'success' });
      navigate(-1);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed', variant: 'destructive' });
    }
  }

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
    setVoiceBlob(null); setVoiceUrl(null); setVoiceDuration(0); setRecordingSeconds(0);
  }

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
        newComment = res.data; clearVoice();
      } else if (attachedFile) {
        const form = new FormData();
        form.append('file', attachedFile);
        form.append('type', 'file');
        const res = await api.post(`/api/tasks/${taskId}/comments/upload`, form);
        newComment = res.data; setAttachedFile(null);
      } else {
        const res = await api.post(`/api/tasks/${taskId}/comments`, { content: commentText });
        newComment = res.data; setCommentText('');
      }
      setComments(prev => [...prev, newComment]);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally { setSendingComment(false); }
  }

  async function handleDeleteComment() {
    if (!deleteCommentTarget) return;
    setDeletingComment(true);
    try {
      await api.delete(`/api/comments/${deleteCommentTarget}`);
      setComments(prev => prev.map(c => c.id === deleteCommentTarget ? { ...c, deleted_at: new Date().toISOString() } : c));
      setDeleteCommentTarget(null);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally { setDeletingComment(false); }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0066CC]" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[hsl(var(--muted-foreground))]">
        <p className="text-lg font-semibold">Task not found</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[#0066CC] hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))]">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-[hsl(var(--border))]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {task.project_id && (
          <span className="text-[hsl(var(--muted-foreground))] text-sm">
            / <Link to={`/projects/${task.project_id}`} className="hover:text-[#0066CC] transition-colors">{task.project_name || 'Project'}</Link>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Main content: two columns on desktop */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* ── Left column: title, description, subtasks, comments ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-w-0">

          {/* Complete + Title */}
          <div className="flex items-start gap-3 mb-4">
            <button
              onClick={handleToggleComplete}
              disabled={!canEdit || !doneStatus}
              className={[
                'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
                isComplete ? 'border-green-500 bg-green-500 text-white' : 'border-[hsl(var(--border))] hover:border-green-400',
                !canEdit || !doneStatus ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {isComplete && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (canEdit) scheduleSave('name', e.target.value); }}
              disabled={!canEdit}
              placeholder="Task name"
              className="flex-1 min-w-0 bg-transparent text-2xl font-bold leading-tight outline-none border-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] disabled:cursor-default"
            />
          </div>

          {/* Status */}
          <div className="mb-6 ml-9">
            <Popover>
              <PopoverTrigger asChild disabled={!canEdit}>
                <button className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium cursor-pointer disabled:cursor-default hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: currentStatus?.color || '#94a3b8', color: getContrastColor(currentStatus?.color || '#94a3b8') }}>
                  {currentStatus?.label || status}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1">
                {statuses.map(s => (
                  <button key={s.key} onClick={() => { setStatus(s.key); saveTaskField('status', s.key); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    {s.label}
                    {status === s.key && <Check className="ml-auto h-3.5 w-3.5 text-[#0066CC]" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Description</h3>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); if (canEdit) scheduleSave('description', e.target.value, 800); }}
              disabled={!canEdit}
              placeholder="Add a description…"
              rows={4}
              className="w-full bg-transparent text-sm leading-relaxed text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none border border-transparent rounded-md p-2 focus:border-[hsl(var(--border))] transition-colors resize-none min-h-[100px] disabled:cursor-default"
            />
          </div>

          {/* Subtasks */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                Subtasks <span className="text-[hsl(var(--muted-foreground))] font-normal">({subtasksDone}/{subtasks.length})</span>
              </h3>
            </div>
            <div className="space-y-1">
              {subtasks.map(st => (
                <div key={st.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[hsl(var(--muted))]/60 transition-colors">
                  <button
                    onClick={() => handleToggleSubtask(st.id, !st.checked)}
                    className={[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                      st.checked ? 'border-green-500 bg-green-500 text-white' : 'border-[hsl(var(--border))] hover:border-green-400',
                    ].join(' ')}
                  >
                    {st.checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </button>
                  <span className={`flex-1 text-sm ${st.checked ? 'line-through text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'}`}>{st.name}</span>
                  <button onClick={() => handleDeleteSubtask(st.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(var(--muted-foreground))] hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {addingSubtask ? (
                <div className="flex items-center gap-2 px-2">
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
                  <button onClick={handleAddSubtask} className="text-[#0066CC] hover:text-[#0052A3]"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setAddingSubtask(false); setNewSubtaskText(''); }} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <button onClick={() => setAddingSubtask(true)} className="flex items-center gap-2 px-2 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[#0066CC] transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Add subtask
                </button>
              )}
            </div>
          </div>

          {/* Comments / Activity */}
          <div>
            <div className="flex border-b border-[hsl(var(--border))] mb-4">
              {[
                { key: 'comments', icon: MessageSquare, label: 'Comments', count: comments.length },
                { key: 'activity', icon: Activity, label: 'Activity' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={[
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    activeTab === tab.key ? 'border-[#0066CC] text-[#0066CC]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                  ].join(' ')}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && <span className="text-xs text-[hsl(var(--muted-foreground))]">({tab.count})</span>}
                </button>
              ))}
            </div>

            {activeTab === 'comments' && (
              <div className="space-y-3">
                {comments.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No comments yet.</p>}
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
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
                                  <Trash2 className="h-3.5 w-3.5" />Delete
                                </button>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>
                      {isDeleted ? <p className="text-sm italic text-[hsl(var(--muted-foreground))]">This comment was deleted.</p>
                        : c.type === 'voice' ? <AudioPlayer src={`/uploads/${c.file_path}`} duration={c.duration || 0} />
                        : c.type === 'file' ? (
                          <a href={`/uploads/${c.file_path}`} download={c.file_name} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 hover:bg-[hsl(var(--background))] transition-colors group/dl">
                            {(() => { const FileIcon = getFileIcon(c.file_name); return <FileIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />; })()}
                            <span className="text-sm truncate flex-1">{c.file_name}</span>
                            <Download className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover/dl:opacity-100 transition-opacity" />
                          </a>
                        ) : <p className="text-sm leading-relaxed">{c.content}</p>}
                    </div>
                  );
                })}

                {canEdit && (
                  <form onSubmit={handleSend} className="mt-4 space-y-2">
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
                        <button type="button" onClick={() => setAttachedFile(null)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                    {recording && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-red-600 font-mono">{formatDuration(recordingSeconds)}</span>
                        <span className="text-xs text-red-500">Recording…</span>
                      </div>
                    )}
                    {!voiceBlob && !attachedFile && !recording && (
                      <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e); }}
                        placeholder="Add a comment…" rows={3}
                        className="w-full bg-transparent text-sm leading-relaxed outline-none border border-[hsl(var(--border))] rounded-md p-3 focus:border-[#0066CC] transition-colors resize-none placeholder:text-[hsl(var(--muted-foreground))]"
                      />
                    )}
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={recording ? stopRecording : startRecording} disabled={!!voiceBlob || !!attachedFile}
                        className={['flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-40', recording ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'].join(' ')}>
                        {recording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>
                      <label className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors ${(recording || !!voiceBlob) ? 'opacity-40 pointer-events-none' : ''}`}>
                        <Paperclip className="h-4 w-4" />
                        <input ref={fileInputRef} type="file" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = ''; }} disabled={recording || !!voiceBlob} />
                      </label>
                      <button type="submit" disabled={(!commentText.trim() && !voiceBlob && !attachedFile) || sendingComment || recording}
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#0066CC] text-white hover:bg-[#0052A3] transition-colors disabled:opacity-40">
                        {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-2">
                {activity.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No activity yet.</p>}
                {activity.map(a => {
                  const color = getPersonColor(a.username || '');
                  const fieldLabels = { status: 'status', priority: 'priority', due_date: 'due date', name: 'title' };
                  return (
                    <div key={a.id} className="flex items-start gap-2 py-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: color }}>
                        {(a.username || '?')[0].toUpperCase()}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-[hsl(var(--foreground))]">
                          <span className="font-medium" style={{ color }}>{a.username}</span> changed {fieldLabels[a.action] || a.action}
                          {a.old_value && <> from <span className="font-medium text-[hsl(var(--muted-foreground))]">{a.old_value}</span></>}
                          {a.new_value && <> to <span className="font-medium">{a.new_value}</span></>}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{new Date(a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Properties (300px) ── */}
        <div className="lg:w-[300px] lg:border-l border-[hsl(var(--border))] overflow-y-auto shrink-0 px-4 py-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3">Properties</h3>

          <PropRow label="Assignees">
            <div className="flex flex-wrap items-center gap-1 py-1">
              {task?.assignments?.map(a => {
                const color = getPersonColor(a.username);
                return (
                  <span key={a.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: color }}>
                    {a.username[0].toUpperCase()}&nbsp;{a.username}
                    {isAdmin && <button onClick={() => handleRemoveAssignee(a.id)} className="ml-0.5 opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button>}
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
                    <input placeholder="Search…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                      className="w-full h-8 px-2 text-sm border border-[hsl(var(--border))] rounded-md bg-transparent outline-none focus:border-[#0066CC]" autoFocus />
                    <Select value={newPermission} onValueChange={setNewPermission}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="edit">Edit</SelectItem>
                        <SelectItem value="view">View</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {projectMembers.filter(m => !task?.assignments?.some(a => a.id === m.id) && m.username.toLowerCase().includes(memberSearch.toLowerCase())).map(m => (
                        <button key={m.id} disabled={assigneeBusy} onClick={() => handleAddAssignee(m.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50">
                          <User className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                          <span className="flex-1 truncate text-left">{m.username}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </PropRow>

          <PropRow label="Due date">
            <div className="flex items-center gap-1.5 py-1">
              <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); saveTaskField('due_date', e.target.value || null); }} disabled={!canEdit}
                className={['text-sm bg-transparent outline-none disabled:cursor-default', !dueDate ? 'italic text-[hsl(var(--muted-foreground))]' : dueDateStatus === 'overdue' ? 'text-red-500' : 'text-[hsl(var(--foreground))]'].join(' ')} />
              {dueDate && canEdit && <button onClick={() => { setDueDate(''); saveTaskField('due_date', null); }} className="text-[hsl(var(--muted-foreground))] hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </PropRow>

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
                    <button key={key} onClick={() => { setPriority(key); saveTaskField('priority', key); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors">
                      <PIco className="h-3.5 w-3.5" style={{ color: meta.color }} />
                      {meta.label}
                      {priority === key && <Check className="ml-auto h-3 w-3 text-[#0066CC]" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </PropRow>

          <PropRow label="Created by">
            <span className="text-sm text-[hsl(var(--foreground))] py-1">{task?.created_by_username || '—'}</span>
          </PropRow>

          <PropRow label="Created on">
            <span className="text-sm text-[hsl(var(--muted-foreground))] py-1">
              {task?.created_at ? new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </span>
          </PropRow>

          {listColumns.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[hsl(var(--border))]">
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
      </div>

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

      {/* Delete comment dialog */}
      <AlertDialog open={Boolean(deleteCommentTarget)} onOpenChange={v => !v && setDeleteCommentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>The comment will be marked as deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment} disabled={deletingComment}>
              {deletingComment ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
