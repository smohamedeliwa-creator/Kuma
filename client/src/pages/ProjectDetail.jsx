import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Plus, ArrowLeft, Trash2, Pencil,
  Send, Calendar, User, MessageSquare, Loader2, Mail, Copy, Check,
  UserPlus, X, SlidersHorizontal, Mic, Paperclip, Play, Pause,
  Download, FileText, Image as ImageIcon, Music2, Video, StopCircle, MoreHorizontal, Share2,
  CircleDot, Columns3, ListPlus,
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  ColumnTypeIcon, ColumnCellValue, ColumnField, AddColumnButton, ColumnSettingsDialog,
} from '@/components/CustomColumns';
import { ShareDialog } from '@/components/ShareDialog';

function getContrastColor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.179 ? '#1a1a2e' : '#ffffff';
  } catch {
    return '#ffffff';
  }
}

function StatusBadge({ statusKey, statuses = [] }) {
  const s = statuses.find(x => x.key === statusKey);
  if (!s) return <span className="text-xs text-[hsl(var(--muted-foreground))]">{statusKey}</span>;
  const textColor = getContrastColor(s.color);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.color, color: textColor }}
    >
      {s.label}
    </span>
  );
}

// ─── Comment Helpers ──────────────────────────────────────────────────────────

function formatDuration(seconds) {
  const s = Math.floor(seconds || 0);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return ImageIcon;
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) return Music2;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return Video;
  return FileText;
}

function isImageFile(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

function AudioPlayer({ src, duration }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const BAR_COUNT = 28;
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => Math.random() * 0.65 + 0.35)
  ).current;

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  }

  const progress = duration > 0 ? Math.min((currentTime || 0) / duration, 1) : 0;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--background))] px-3 py-2">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0066CC] text-white hover:bg-[#0055aa] transition-colors"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing
          ? <Pause className="h-3.5 w-3.5" />
          : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex flex-1 items-end gap-px h-6" aria-hidden>
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 max-w-[4px] rounded-full transition-colors duration-100"
            style={{
              height: `${h * 100}%`,
              backgroundColor: i / BAR_COUNT <= progress ? '#0066CC' : 'hsl(var(--muted-foreground))',
              opacity: i / BAR_COUNT <= progress ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 font-mono w-10 text-right">
        {formatDuration(playing ? currentTime : (duration || 0))}
      </span>
    </div>
  );
}

function FileAttachment({ fileName, filePath, fileSize }) {
  const FileIcon = getFileIcon(fileName);
  const isImage = isImageFile(fileName);
  const href = `/uploads/${filePath}`;

  return (
    <div className="space-y-1.5">
      {isImage && (
        <img
          src={href}
          alt={fileName}
          className="max-h-48 w-full rounded-md object-cover"
          width={400}
          height={192}
        />
      )}
      <a
        href={href}
        download={fileName}
        className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors group"
      >
        <FileIcon className="h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {fileSize && <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatFileSize(fileSize)}</p>}
        </div>
        <Download className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
    </div>
  );
}

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

function TaskSheet({ taskId, projectId, open, onOpenChange, isAdmin, onUpdated, onDeleted, statuses = [], listColumns = [], onColValuesSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

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

  // File attachment
  const [attachedFile, setAttachedFile] = useState(null);

  // Comment delete
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);

  // Share
  const [shareTaskOpen, setShareTaskOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('normal');
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Assignee management
  const [projectMembers, setProjectMembers] = useState([]);
  const [addAssigneeOpen, setAddAssigneeOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [newPermission, setNewPermission] = useState('view');
  const [assigneeBusy, setAssigneeBusy] = useState(false);

  // Custom column values
  const [colValues, setColValues] = useState({});
  const saveTimeouts = useRef({});

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    setTask(null);
    setColValues({});
    Promise.all([
      api.get(`/api/tasks/${taskId}`),
      api.get(`/api/tasks/${taskId}/comments`),
      api.get(`/api/tasks/${taskId}/column-values`),
    ]).then(([taskRes, commentsRes, colValsRes]) => {
      const t = taskRes.data;
      setTask(t);
      setName(t.name);
      setDueDate(t.due_date || '');
      setStatus(t.status);
      setPriority(t.priority || 'normal');
      setComments(commentsRes.data);
      const vals = {};
      for (const v of colValsRes.data) vals[v.column_id] = v.value;
      setColValues(vals);
    }).finally(() => setLoading(false));
  }, [open, taskId]);

  useEffect(() => {
    if (!open || !projectId) return;
    api.get(`/api/projects/${projectId}`).then(res => setProjectMembers(res.data.members || []));
  }, [open, projectId]);

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

  async function handleChangePermission(memberId, permission) {
    try {
      await api.put(`/api/tasks/${taskId}/assignments/${memberId}`, { permission });
      setTask(prev => ({
        ...prev,
        assignments: prev.assignments.map(a => a.id === memberId ? { ...a, permission } : a),
      }));
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to update permission', variant: 'destructive' });
    }
  }

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
        priority,
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

  async function handleColValueChange(colId, value) {
    setColValues(prev => ({ ...prev, [colId]: value }));
    clearTimeout(saveTimeouts.current[colId]);
    saveTimeouts.current[colId] = setTimeout(async () => {
      try {
        const res = await api.put(`/api/tasks/${taskId}/column-values`, {
          values: [{ column_id: colId, value }],
        });
        onColValuesSaved?.(taskId, res.data);
      } catch {
        // silent — values still in local state
      }
    }, 300);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setVoiceBlob(blob);
        setVoiceUrl(url);
        setVoiceDuration(recordingSeconds);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
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

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = '';
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
      setComments((prev) => [...prev, newComment]);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to post comment', variant: 'destructive' });
    } finally {
      setSendingComment(false);
    }
  }

  async function handleDeleteComment() {
    if (!deleteCommentTarget) return;
    setDeletingComment(true);
    try {
      await api.delete(`/api/comments/${deleteCommentTarget}`);
      setComments((prev) =>
        prev.map((c) => c.id === deleteCommentTarget ? { ...c, deleted_at: new Date().toISOString() } : c)
      );
      setDeleteCommentTarget(null);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete comment', variant: 'destructive' });
    } finally {
      setDeletingComment(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-[480px] overflow-y-auto">
          <SheetHeader className="flex-row items-center justify-between pr-6">
            <SheetTitle>Task Details</SheetTitle>
            <Button variant="ghost" size="icon" title="Share task" onClick={() => setShareTaskOpen(true)}>
              <Share2 className="h-4 w-4" />
            </Button>
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
                        {statuses.map(s => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="py-2">
                      <StatusBadge statusKey={status} statuses={statuses} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => canEdit && setPriority(opt.value)}
                      disabled={!canEdit}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: priority === opt.value ? opt.color + '22' : 'transparent',
                        borderColor: priority === opt.value ? opt.color : 'hsl(var(--border))',
                        color: priority === opt.value ? opt.color : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignees */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Assignees</Label>
                  {isAdmin && (
                    <Popover open={addAssigneeOpen} onOpenChange={open => { setAddAssigneeOpen(open); if (!open) { setMemberSearch(''); setNewPermission('view'); } }}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <UserPlus className="mr-1 h-3.5 w-3.5" />
                          Add
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 p-3 space-y-2">
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Add Assignee</p>
                        <Input
                          placeholder="Search members…"
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Select value={newPermission} onValueChange={setNewPermission}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="edit">Edit</SelectItem>
                            <SelectItem value="view">View</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {projectMembers
                            .filter(m => !task?.assignments?.some(a => a.id === m.id))
                            .filter(m => m.username.toLowerCase().includes(memberSearch.toLowerCase()))
                            .map(m => (
                              <button
                                key={m.id}
                                disabled={assigneeBusy}
                                onClick={() => handleAddAssignee(m.id)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                              >
                                <User className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                                <span className="flex-1 truncate text-left">{m.username}</span>
                                {m.role === 'admin' && <span className="text-[10px] text-[#0066CC]">admin</span>}
                              </button>
                            ))}
                          {projectMembers.filter(m => !task?.assignments?.some(a => a.id === m.id)).length === 0 && (
                            <p className="py-2 text-center text-xs text-[hsl(var(--muted-foreground))]">All members assigned</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {task?.assignments?.length === 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No assignees yet.</p>
                )}

                <div className="space-y-1.5">
                  {task?.assignments?.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                      <User className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      <span className="flex-1 truncate text-sm font-medium">{a.username}</span>
                      {isAdmin ? (
                        <>
                          <Select value={a.permission} onValueChange={perm => handleChangePermission(a.id, perm)}>
                            <SelectTrigger className="h-6 w-[72px] px-2 text-xs border-0 bg-[hsl(var(--muted))]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="edit">Edit</SelectItem>
                              <SelectItem value="view">View</SelectItem>
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() => handleRemoveAssignee(a.id)}
                            className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <Badge variant={a.permission === 'edit' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {a.permission}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom column properties */}
              {listColumns.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                    Properties
                  </h4>
                  {listColumns.map(col => (
                    <div key={col.id} className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <ColumnTypeIcon type={col.type} />
                        {col.name}
                      </Label>
                      <ColumnField
                        column={col}
                        value={colValues[col.id] ?? null}
                        onChange={val => handleColValueChange(col.id, val)}
                        members={projectMembers}
                        canEdit={canEdit}
                      />
                    </div>
                  ))}
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
                    comments.map((c) => {
                      const isDeleted = !!c.deleted_at;
                      const canDeleteComment = c.user_id === user?.id || isAdmin;
                      return (
                        <div key={c.id} className="group relative rounded-lg bg-[hsl(var(--muted))] p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-[#0066CC]">{c.username}</span>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              {new Date(c.created_at).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {!isDeleted && c.type === 'voice' && (
                              <span className="text-[10px] bg-[#0066CC]/10 text-[#0066CC] rounded-full px-1.5 py-0.5 font-medium">
                                Voice
                              </span>
                            )}
                            {!isDeleted && canDeleteComment && (
                              <div className="ml-auto">
                                <Popover open={openMenuId === c.id} onOpenChange={(v) => setOpenMenuId(v ? c.id : null)}>
                                  <PopoverTrigger asChild>
                                    <button
                                      className="flex h-6 w-6 items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]"
                                      aria-label="Comment actions"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-32 p-1">
                                    <button
                                      onClick={() => { setDeleteCommentTarget(c.id); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                    >
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
                            <FileAttachment fileName={c.file_name} filePath={c.file_path} fileSize={c.file_size} />
                          ) : (
                            <p className="text-sm leading-relaxed">{c.content}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {canEdit && (
                  <form onSubmit={handleSend} className="space-y-2">
                    {/* Voice preview */}
                    {voiceUrl && !recording && (
                      <div className="rounded-lg border border-[hsl(var(--border))] p-2 space-y-1.5">
                        <AudioPlayer src={voiceUrl} duration={voiceDuration} />
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">Voice note · {formatDuration(voiceDuration)}</span>
                          <button type="button" onClick={clearVoice} className="text-xs text-red-500 hover:text-red-700">
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* File preview */}
                    {attachedFile && (
                      <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                        {React.createElement(getFileIcon(attachedFile.name), { className: 'h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]' })}
                        <span className="text-sm truncate flex-1">{attachedFile.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{formatFileSize(attachedFile.size)}</span>
                        <button type="button" onClick={() => setAttachedFile(null)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Text input — hidden when voice/file selected */}
                    {!voiceBlob && !attachedFile && !recording && (
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment…"
                        rows={2}
                        className="resize-none"
                      />
                    )}

                    {/* Recording indicator */}
                    {recording && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-red-600 dark:text-red-400 font-mono">{formatDuration(recordingSeconds)}</span>
                        <span className="text-xs text-red-500">Recording…</span>
                      </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={recording ? stopRecording : startRecording}
                        disabled={!!voiceBlob || !!attachedFile}
                        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
                          recording
                            ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-950/30 dark:text-red-400'
                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                        }`}
                        aria-label={recording ? 'Stop recording' : 'Record voice note'}
                        title={recording ? 'Stop recording' : 'Record voice note'}
                      >
                        {recording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>

                      <label
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors ${(recording || !!voiceBlob) ? 'opacity-40 pointer-events-none' : ''}`}
                        title="Attach file"
                      >
                        <Paperclip className="h-4 w-4" />
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="sr-only"
                          onChange={handleFileSelect}
                          disabled={recording || !!voiceBlob}
                        />
                      </label>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={(!commentText.trim() && !voiceBlob && !attachedFile) || sendingComment || recording}
                        className="ml-auto"
                      >
                        {sendingComment
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Send className="h-4 w-4" />}
                        Send
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete comment confirmation */}
      <AlertDialog open={Boolean(deleteCommentTarget)} onOpenChange={(v) => !v && setDeleteCommentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              The comment will be marked as deleted and its content will no longer be visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment} disabled={deletingComment}>
              {deletingComment ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete task confirmation */}
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

      <ShareDialog
        open={shareTaskOpen}
        onClose={() => setShareTaskOpen(false)}
        type="task"
        referenceId={taskId}
        isAdmin={isAdmin}
      />
    </>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, columns, statuses = [], listColumns = [], colValues = {}, onClick }) {
  const dueDateStatus = getDueDateStatus(task.due_date);

  const cells = {
    name: <td className="py-2.5 pl-4 pr-3 text-sm font-medium">{task.name}</td>,
    due_date: (
      <td className="px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))]">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatDate(task.due_date)}
        </span>
      </td>
    ),
    status: (
      <td className="px-3 py-2.5">
        <StatusBadge statusKey={task.status} statuses={statuses} />
      </td>
    ),
    assignees: (
      <td className="px-3 py-2.5 pr-4 text-sm text-[hsl(var(--muted-foreground))]">
        {task.assignee_names || '—'}
      </td>
    ),
  };

  return (
    <tr
      className={[
        'cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors',
        dueDateStatus === 'overdue' ? 'border-l-2 border-l-red-500' : '',
        dueDateStatus === 'due-soon' ? 'border-l-2 border-l-yellow-500' : '',
      ].join(' ')}
      onClick={onClick}
    >
      {columns.filter(c => c.visible).map(c => (
        <React.Fragment key={c.column_key}>{cells[c.column_key]}</React.Fragment>
      ))}
      {listColumns.map(col => (
        <td key={col.id} className="px-3 py-2.5 text-sm">
          <ColumnCellValue column={col} value={colValues[col.id] ?? null} />
        </td>
      ))}
    </tr>
  );
}

// ─── Mobile Card View ─────────────────────────────────────────────────────────

// Plain-text summary of a custom column value for card tags
function ColValueText({ column, value }) {
  if (value === null || value === undefined || value === '') return null;
  if (column.type === 'checkbox' && Array.isArray(value)) {
    const done = value.filter(i => i.checked).length;
    return `${done}/${value.length}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.slice(0, 2).join(', ') + (value.length > 2 ? ` +${value.length - 2}` : '');
  }
  return String(value);
}

// Bottom-sheet quick actions on long press
function QuickActionsMenu({ task, statuses, isAdmin, onClose, onStatusChange, onDelete }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[hsl(var(--card))] p-4 pb-8 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="truncate text-sm font-semibold">{task.name}</p>
          <button onClick={onClose} className="ml-2 shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Change Status</p>
        <div className="space-y-0.5">
          {statuses.map(s => (
            <button
              key={s.key}
              onClick={() => { onStatusChange(s.key); onClose(); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-[hsl(var(--muted))] ${task.status === s.key ? 'font-semibold' : ''}`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
              {task.status === s.key && <Check className="ml-auto h-3.5 w-3.5 text-[#7C3AED]" />}
            </button>
          ))}
        </div>
        {isAdmin && (
          <>
            <div className="my-3 border-t border-[hsl(var(--border))]" />
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete Task
            </button>
          </>
        )}
      </div>
    </>
  );
}

function TaskCard({ task, statuses, listColumns, colValues, isAdmin, onOpen, onDelete, onStatusChange }) {
  const dueDateStatus = getDueDateStatus(task.due_date);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHoriz = useRef(false);
  const longPressTimer = useRef(null);

  // Custom column tags (non-empty values only)
  const filledCols = listColumns.filter(col => {
    const v = colValues[col.id];
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  const shownCols = filledCols.slice(0, 3);
  const moreCols = filledCols.length - shownCols.length;

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHoriz.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!revealed) setQuickOpen(true);
    }, 500);
  }

  function onTouchMove(e) {
    clearTimeout(longPressTimer.current);
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isHoriz.current && Math.abs(dx) > Math.abs(dy) + 5) {
      isHoriz.current = true;
    }
    if (isHoriz.current && dx < 0) {
      e.preventDefault();
      setSwipeOffset(Math.max(dx, -80));
    }
  }

  function onTouchEnd() {
    clearTimeout(longPressTimer.current);
    if (swipeOffset < -40) {
      setSwipeOffset(-76);
      setRevealed(true);
    } else {
      setSwipeOffset(0);
      setRevealed(false);
    }
  }

  function handleCardClick() {
    if (revealed) {
      setSwipeOffset(0);
      setRevealed(false);
      return;
    }
    onOpen();
  }

  const hasFooter = (task.comment_count > 0) || (task.attachment_count > 0);

  return (
    <div className="relative overflow-hidden rounded-[10px]">
      {/* Swipe-reveal delete button */}
      <div className="absolute right-0 top-0 flex h-full w-[76px] items-center justify-center rounded-r-[10px] bg-red-500">
        <button
          onClick={onDelete}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Delete task"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>

      {/* Card */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: (swipeOffset === 0 || swipeOffset === -76) ? 'transform 0.2s ease' : 'none',
        }}
        className={[
          'relative cursor-pointer select-none space-y-2 rounded-[10px] border p-[14px]',
          'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-[#1E1E1E] dark:shadow-none',
          'border-[#E5E5E5] dark:border-[#2E2E2E]',
          dueDateStatus === 'overdue'  ? 'border-l-[3px] border-l-red-500'    : '',
          dueDateStatus === 'due-soon' ? 'border-l-[3px] border-l-yellow-500' : '',
        ].join(' ')}
        onClick={handleCardClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Top: name + status */}
        <div className="flex items-start justify-between gap-2">
          <p className="flex-1 text-[15px] font-semibold leading-snug">{task.name}</p>
          <StatusBadge statusKey={task.status} statuses={statuses} />
        </div>

        {/* Middle: due date + assignees */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
          <span className={`flex items-center gap-1 ${dueDateStatus === 'overdue' ? 'text-red-500' : ''}`}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {task.due_date ? formatDate(task.due_date) : 'No due date'}
          </span>
          {task.assignee_names && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[140px] truncate">{task.assignee_names}</span>
            </span>
          )}
        </div>

        {/* Custom column tags */}
        {shownCols.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shownCols.map(col => {
              const text = ColValueText({ column: col, value: colValues[col.id] });
              if (!text) return null;
              return (
                <span
                  key={col.id}
                  className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]"
                >
                  <span className="shrink-0 font-medium">{col.name}:</span>
                  <span className="truncate">{text}</span>
                </span>
              );
            })}
            {moreCols > 0 && (
              <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] text-[#6B7280]">
                +{moreCols} more
              </span>
            )}
          </div>
        )}

        {/* Footer: comment + attachment counts */}
        {hasFooter && (
          <div className="flex items-center gap-3 border-t border-[#E5E5E5] pt-2 text-xs text-[#9CA3AF] dark:border-[#2E2E2E]">
            {task.comment_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {task.comment_count}
              </span>
            )}
            {task.attachment_count > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {task.attachment_count}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Long-press quick actions */}
      {quickOpen && (
        <QuickActionsMenu
          task={task}
          statuses={statuses}
          isAdmin={isAdmin}
          onClose={() => setQuickOpen(false)}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

// ─── Task List Section ────────────────────────────────────────────────────────

const DEFAULT_COLS = [
  { column_key: 'name', label: 'Task Name', visible: 1 },
  { column_key: 'due_date', label: 'Due Date', visible: 1 },
  { column_key: 'status', label: 'Status', visible: 1 },
  { column_key: 'assignees', label: 'Assigned To', visible: 1 },
];

function TaskListSection({ list: initialList, projectId, columns = DEFAULT_COLS, statuses = [], isAdmin, onDeleted }) {
  const { toast } = useToast();
  const [list, setList] = useState(initialList);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', due_date: '', status: 'todo' });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Rename
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Custom columns
  const [listColumns, setListColumns] = useState([]);
  const [colValues, setColValues] = useState({}); // { [taskId]: { [colId]: value } }
  const [dragColId, setDragColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);
  const [settingsCol, setSettingsCol] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleRenameSubmit(e) {
    e.preventDefault();
    if (!renameValue.trim() || renameValue.trim() === list.name) { setRenaming(false); return; }
    setRenameSaving(true);
    try {
      const res = await api.put(`/api/task-lists/${list.id}`, { name: renameValue.trim() });
      setList(res.data);
      setRenaming(false);
      toast({ title: 'List renamed', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to rename', variant: 'destructive' });
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/task-lists/${list.id}`);
      onDeleted(list.id);
      toast({ title: `"${list.name}" deleted`, variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete', variant: 'destructive' });
    }
  }

  useEffect(() => {
    Promise.all([
      api.get(`/api/task-lists/${list.id}/tasks`),
      api.get(`/api/task-lists/${list.id}/columns`),
      api.get(`/api/task-lists/${list.id}/column-values`),
    ]).then(([tasksRes, colsRes, valuesRes]) => {
      setTasks(tasksRes.data);
      setListColumns(colsRes.data);
      const vals = {};
      for (const v of valuesRes.data) {
        if (!vals[v.task_id]) vals[v.task_id] = {};
        vals[v.task_id][v.column_id] = v.value;
      }
      setColValues(vals);
    }).finally(() => setLoading(false));
  }, [list.id]);

  function handleTaskUpdated(updated) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
  }

  function handleTaskDeleted(taskId) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleColValuesSaved(taskId, updatedValues) {
    setColValues(prev => {
      const taskVals = { ...(prev[taskId] || {}) };
      for (const v of updatedValues) taskVals[v.column_id] = v.value;
      return { ...prev, [taskId]: taskVals };
    });
  }

  async function handleDeleteTask(taskId) {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      handleTaskDeleted(taskId);
      toast({ title: 'Task deleted', variant: 'success' });
    } catch {
      toast({ title: 'Failed to delete task', variant: 'destructive' });
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    try {
      const res = await api.put(`/api/tasks/${taskId}`, { status: newStatus });
      handleTaskUpdated(res.data);
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  }

  async function handleColumnDrop(draggedId, targetId) {
    if (draggedId === targetId) return;
    const ids = listColumns.map(c => c.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    const optimistic = ids.map((id, i) => ({ ...listColumns.find(c => c.id === id), position: i }));
    setListColumns(optimistic);
    try {
      const res = await api.put(`/api/task-lists/${list.id}/columns/reorder`, { ids });
      setListColumns(res.data);
    } catch {
      setListColumns(listColumns);
    }
    setDragColId(null);
    setDragOverColId(null);
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
      <div className="group flex items-center justify-between px-4 py-3 bg-[hsl(var(--card))]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="flex items-center gap-1.5 text-sm font-semibold hover:text-[#0066CC] transition-colors shrink-0"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {renaming ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-1.5">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={e => e.key === 'Escape' && setRenaming(false)}
                disabled={renameSaving}
                className="h-7 rounded border bg-[hsl(var(--background))] px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0066CC]/30 min-w-0 w-40"
              />
            </form>
          ) : (
            <button
              className="flex items-center gap-2 text-sm font-semibold hover:text-[#0066CC] transition-colors"
              onClick={() => setCollapsed((c) => !c)}
            >
              {list.name}
              <span className="font-normal text-[hsl(var(--muted-foreground))]">
                ({tasks.length})
              </span>
            </button>
          )}

          {isAdmin && !renaming && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setRenameValue(list.name); setRenaming(true); }}
                className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-foreground"
                title="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30"
                title="Delete list"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

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
            <>
              {/* Mobile skeleton */}
              <div className="border-t px-4 py-4 space-y-[10px] md:hidden">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-[10px]" />)}
              </div>
              {/* Desktop skeleton */}
              <div className="border-t px-4 py-4 space-y-2 hidden md:block">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            </>
          ) : tasks.length === 0 ? (
            <div className="border-t px-4 py-8 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No tasks yet.</p>
              {isAdmin && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-3 flex items-center gap-1.5 mx-auto rounded-md px-3 py-1.5 text-sm text-[#0066CC] hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ── Mobile card list (hidden on md+) ── */}
              <div className="border-t px-4 py-3 space-y-[10px] md:hidden">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    statuses={statuses}
                    listColumns={listColumns}
                    colValues={colValues[task.id] || {}}
                    isAdmin={isAdmin}
                    onOpen={() => { setSelectedTaskId(task.id); setSheetOpen(true); }}
                    onDelete={() => handleDeleteTask(task.id)}
                    onStatusChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                  />
                ))}
              </div>

              {/* ── Desktop table (hidden below md) ── */}
              <div className="hidden md:block overflow-x-auto border-t">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-[hsl(var(--muted))/50] text-xs uppercase text-[hsl(var(--muted-foreground))]">
                      {columns.filter(c => c.visible).map((c, i) => (
                        <th
                          key={c.column_key}
                          className={`py-2 font-medium ${i === 0 ? 'pl-4 pr-3' : 'px-3'}`}
                        >
                          {c.label}
                        </th>
                      ))}
                      {listColumns.map(col => (
                        <th
                          key={col.id}
                          className={`px-3 py-2 font-medium cursor-grab select-none transition-colors ${dragOverColId === col.id ? 'bg-[hsl(var(--muted))]' : ''}`}
                          draggable
                          onDragStart={() => setDragColId(col.id)}
                          onDragOver={e => { e.preventDefault(); setDragOverColId(col.id); }}
                          onDragLeave={() => setDragOverColId(null)}
                          onDrop={() => handleColumnDrop(dragColId, col.id)}
                          onDragEnd={() => { setDragColId(null); setDragOverColId(null); }}
                        >
                          <div className="flex items-center gap-1 group/col">
                            <ColumnTypeIcon type={col.type} />
                            <span>{col.name}</span>
                            {isAdmin && (
                              <button
                                onClick={e => { e.stopPropagation(); setSettingsCol(col); setSettingsOpen(true); }}
                                className="opacity-0 group-hover/col:opacity-100 transition-opacity ml-0.5 rounded p-0.5 hover:bg-[hsl(var(--background))]"
                                title="Column settings"
                              >
                                <SlidersHorizontal className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      {isAdmin && (
                        <th className="py-1 px-1">
                          <AddColumnButton listId={list.id} onAdded={col => setListColumns(prev => [...prev, col])} />
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        columns={columns}
                        statuses={statuses}
                        listColumns={listColumns}
                        colValues={colValues[task.id] || {}}
                        onClick={() => { setSelectedTaskId(task.id); setSheetOpen(true); }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
                    {statuses.map(s => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
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
        projectId={projectId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isAdmin={isAdmin}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
        statuses={statuses}
        listColumns={listColumns}
        onColValuesSaved={handleColValuesSaved}
      />

      {/* Column settings dialog */}
      {settingsCol && (
        <ColumnSettingsDialog
          column={settingsCol}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onUpdated={updated => setListColumns(prev => prev.map(c => c.id === updated.id ? updated : c))}
          onDeleted={colId => {
            setListColumns(prev => prev.filter(c => c.id !== colId));
            setColValues(prev => {
              const next = { ...prev };
              for (const taskId of Object.keys(next)) {
                const { [colId]: _, ...rest } = next[taskId];
                next[taskId] = rest;
              }
              return next;
            });
          }}
        />
      )}

      {/* Delete list confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{list.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this task list and all {tasks.length} task{tasks.length !== 1 ? 's' : ''} inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: '#EF4444' },
  { value: 'high',   label: 'High',   color: '#F97316' },
  { value: 'normal', label: 'Normal', color: '#3B82F6' },
  { value: 'low',    label: 'Low',    color: '#94A3B8' },
];

function PriorityDot({ value }) {
  const opt = PRIORITY_OPTIONS.find(o => o.value === value) || PRIORITY_OPTIONS[2];
  return <span title={opt.label} className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />;
}

// ─── Quick Create Dialog ──────────────────────────────────────────────────────

function QuickCreateDialog({ open, onOpenChange, taskLists, onCreated }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [listId, setListId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && taskLists.length > 0) setListId(String(taskLists[0].id));
  }, [open, taskLists]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !listId) return;
    setSaving(true);
    try {
      const res = await api.post(`/api/task-lists/${listId}/tasks`, { name: name.trim() });
      onCreated(Number(listId), res.data);
      setName('');
      onOpenChange(false);
      toast({ title: 'Task created', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to create task', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Create Task</DialogTitle>
          <DialogDescription>Press Q anywhere to open this dialog.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Task name…"
            autoFocus
            required
          />
          {taskLists.length > 1 && (
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select list" />
              </SelectTrigger>
              <SelectContent>
                {taskLists.map(l => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [columns, setColumns] = useState(DEFAULT_COLS);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [listError, setListError] = useState('');
  const [listCreating, setListCreating] = useState(false);

  // Customize Columns dialog state
  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [editCols, setEditCols] = useState([]);
  const [colSaving, setColSaving] = useState(false);

  // Manage Statuses dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#94a3b8');
  const [statusSaving, setStatusSaving] = useState(false);

  // Share state
  const [shareOpen, setShareOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

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
      api.get(`/api/projects/${id}/columns`),
      api.get(`/api/projects/${id}/statuses`),
    ]).then(([projectRes, listsRes, colsRes, statusesRes]) => {
      setProject(projectRes.data);
      setTaskLists(listsRes.data);
      setColumns(colsRes.data);
      setStatuses(statusesRes.data);
    }).catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'q' || e.key === 'Q') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        e.preventDefault();
        setQuickCreateOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleSaveColumns() {
    setColSaving(true);
    try {
      const res = await api.put(`/api/projects/${id}/columns`, { columns: editCols });
      setColumns(res.data);
      setColDialogOpen(false);
      toast({ title: 'Column settings saved', variant: 'success' });
    } catch {
      toast({ title: 'Failed to save columns', variant: 'destructive' });
    } finally {
      setColSaving(false);
    }
  }

  async function handleAddStatus(e) {
    e.preventDefault();
    if (!newStatusLabel.trim()) return;
    setStatusSaving(true);
    try {
      const res = await api.post(`/api/projects/${id}/statuses`, {
        label: newStatusLabel.trim(),
        color: newStatusColor,
      });
      setStatuses(prev => [...prev, res.data]);
      setNewStatusLabel('');
      setNewStatusColor('#94a3b8');
      toast({ title: 'Status added', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to add status', variant: 'destructive' });
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleUpdateStatus(statusId, label, color) {
    try {
      const res = await api.put(`/api/projects/${id}/statuses/${statusId}`, { label, color });
      setStatuses(prev => prev.map(s => s.id === statusId ? res.data : s));
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to update status', variant: 'destructive' });
    }
  }

  async function handleDeleteStatus(statusId) {
    try {
      await api.delete(`/api/projects/${id}/statuses/${statusId}`);
      setStatuses(prev => prev.filter(s => s.id !== statusId));
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete status', variant: 'destructive' });
    }
  }

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1a1a2e] dark:text-white truncate">
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
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" title="Share" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" />
              <span className="hidden lg:inline">Share</span>
            </Button>
            {isAdmin && (
              <>
                <Button size="sm" variant="outline" title="Customize Columns" onClick={() => { setEditCols(columns.map(c => ({ ...c }))); setColDialogOpen(true); }}>
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden lg:inline">Columns</span>
                </Button>
                <Button size="sm" variant="outline" title="Manage Statuses" onClick={() => setStatusDialogOpen(true)}>
                  <CircleDot className="h-4 w-4" />
                  <span className="hidden lg:inline">Statuses</span>
                </Button>
                <Button size="sm" variant="outline" title="Invite Member" onClick={() => { setInviteLink(''); setInviteOpen(true); }}>
                  <Mail className="h-4 w-4" />
                  <span className="hidden lg:inline">Invite</span>
                </Button>
                <Button size="sm" title="New List" onClick={() => setCreateListOpen(true)}>
                  <ListPlus className="h-4 w-4" />
                  <span className="hidden lg:inline">New List</span>
                </Button>
              </>
            )}
          </div>
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
            <TaskListSection
              key={list.id}
              list={list}
              projectId={parseInt(id)}
              columns={columns}
              statuses={statuses}
              isAdmin={isAdmin}
              onDeleted={(listId) => setTaskLists(prev => prev.filter(l => l.id !== listId))}
            />
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

      {/* Customize Columns Dialog */}
      <Dialog open={colDialogOpen} onOpenChange={setColDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Columns</DialogTitle>
            <DialogDescription>
              Rename columns or hide them from the task table. The task name column is always shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editCols.map((col) => (
              <div key={col.column_key} className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={col.column_key === 'name'}
                  onClick={() => setEditCols(prev => prev.map(c => c.column_key === col.column_key ? { ...c, visible: c.visible ? 0 : 1 } : c))}
                  className={`h-5 w-5 shrink-0 rounded border-2 transition-colors flex items-center justify-center
                    ${col.visible ? 'border-[#0066CC] bg-[#0066CC]' : 'border-[hsl(var(--muted-foreground))] bg-transparent'}
                    ${col.column_key === 'name' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {col.visible ? <Check className="h-3 w-3 text-white" /> : null}
                </button>
                <Input
                  value={col.label}
                  onChange={e => setEditCols(prev => prev.map(c => c.column_key === col.column_key ? { ...c, label: e.target.value } : c))}
                  className="h-8 text-sm"
                  placeholder={col.column_key}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveColumns} disabled={colSaving}>
              {colSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Statuses Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Statuses</DialogTitle>
            <DialogDescription>
              Customize the task statuses for this project. Changes apply to all tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
            {statuses.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={s.color}
                  onChange={e => handleUpdateStatus(s.id, s.label, e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                  title="Pick color"
                />
                <Input
                  value={s.label}
                  onChange={e => setStatuses(prev => prev.map(x => x.id === s.id ? { ...x, label: e.target.value } : x))}
                  onBlur={e => handleUpdateStatus(s.id, e.target.value, s.color)}
                  className="h-8 text-sm flex-1"
                />
                <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{s.key}</span>
                <button
                  onClick={() => handleDeleteStatus(s.id)}
                  className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/30"
                  title="Delete status"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Separator />
          <form onSubmit={handleAddStatus} className="flex items-center gap-2 pt-1">
            <input
              type="color"
              value={newStatusColor}
              onChange={e => setNewStatusColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0 shrink-0"
              title="Pick color"
            />
            <Input
              value={newStatusLabel}
              onChange={e => setNewStatusLabel(e.target.value)}
              placeholder="New status label…"
              className="h-8 text-sm flex-1"
            />
            <Button type="submit" size="sm" disabled={statusSaving || !newStatusLabel.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Close</Button>
          </DialogFooter>
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

      <QuickCreateDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        taskLists={taskLists}
        onCreated={(listId, newTask) => {
          setTaskLists(prev => prev.map(l =>
            l.id === listId ? { ...l, tasks: [...l.tasks, newTask] } : l
          ));
        }}
      />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        type="project"
        referenceId={parseInt(id)}
        isAdmin={isAdmin}
      />
    </>
  );
}
