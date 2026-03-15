import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Mic, Paperclip, Play, Pause, Download, FileText,
  Image as ImageIcon, Music2, Video, StopCircle, ArrowLeft,
  Plus, Users, Search, MessageSquareText, Trash2, MoreHorizontal,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Avatar, getAvatarColor } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

// ─── Media Helpers ────────────────────────────────────────────────────────────

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
  const BAR_COUNT = 24;
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => Math.random() * 0.65 + 0.35)
  ).current;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  }

  const progress = duration > 0 ? Math.min((currentTime || 0) / duration, 1) : 0;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/10 dark:bg-white/10 px-3 py-2 min-w-[180px]">
      <audio ref={audioRef} src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      />
      <button type="button" onClick={toggle}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/30 hover:bg-white/50 transition-colors"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
      </button>
      <div className="flex flex-1 items-end gap-px h-5" aria-hidden>
        {bars.map((h, i) => (
          <div key={i} className="flex-1 max-w-[3px] rounded-full"
            style={{
              height: `${h * 100}%`,
              backgroundColor: i / BAR_COUNT <= progress ? 'currentColor' : 'currentColor',
              opacity: i / BAR_COUNT <= progress ? 0.9 : 0.3,
            }}
          />
        ))}
      </div>
      <span className="text-xs font-mono shrink-0 opacity-70">
        {formatDuration(playing ? currentTime : (duration || 0))}
      </span>
    </div>
  );
}

function FileAttachmentMsg({ fileName, filePath, fileSize }) {
  const FileIcon = getFileIcon(fileName);
  const isImage = isImageFile(fileName);
  const href = `/uploads/${filePath}`;
  return (
    <div className="space-y-1.5 max-w-[220px]">
      {isImage && (
        <img src={href} alt={fileName} className="rounded-md max-h-40 w-full object-cover" width={220} height={160} />
      )}
      <a href={href} download={fileName}
        className="flex items-center gap-2 rounded-lg bg-black/10 dark:bg-white/10 px-3 py-2 hover:bg-black/20 dark:hover:bg-white/20 transition-colors group"
      >
        <FileIcon className="h-4 w-4 shrink-0 opacity-70" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {fileSize && <p className="text-xs opacity-60">{formatFileSize(fileSize)}</p>}
        </div>
        <Download className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </a>
    </div>
  );
}

// ─── Conversation Helpers ─────────────────────────────────────────────────────

function getConvName(conv, currentUserId) {
  if (conv.type === 'direct') {
    const other = conv.members?.find((m) => m.id !== currentUserId);
    return other?.full_name || other?.username || 'Chat';
  }
  return conv.name || 'Group';
}

function getConvAvatar(conv, currentUserId) {
  if (conv.type === 'direct') {
    return conv.members?.find((m) => m.id !== currentUserId) || null;
  }
  return null;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function groupMessagesByDate(msgs) {
  const result = [];
  let lastDate = null;
  for (const msg of msgs) {
    const d = new Date(msg.created_at).toLocaleDateString(undefined, {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    if (d !== lastDate) { result.push({ kind: 'sep', date: d }); lastDate = d; }
    result.push({ kind: 'msg', msg });
  }
  return result;
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

export function ChatPanel({ open, onClose, onUnreadChange }) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Conversations
  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [convSearch, setConvSearch] = useState('');
  const [selectedConvId, setSelectedConvId] = useState(null);

  // Messages
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);

  // New conversation dialogs
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Message input
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  // File attachment
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Message menu
  const [openMsgMenuId, setOpenMsgMenuId] = useState(null);

  // Derived
  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;
  const filteredConvs = conversations.filter((c) =>
    getConvName(c, user?.id).toLowerCase().includes(convSearch.toLowerCase())
  );
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  useEffect(() => {
    onUnreadChange?.(totalUnread);
  }, [totalUnread, onUnreadChange]);

  // ── Fetch conversations ──────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/api/conversations');
      setConversations(res.data);
    } catch {
      // silent
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchConversations();
    const id = setInterval(fetchConversations, 3000);
    return () => clearInterval(id);
  }, [open, fetchConversations]);

  // ── Fetch messages ───────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (convId) => {
    setLoadingMsgs(true);
    try {
      const res = await api.get(`/api/conversations/${convId}/messages`);
      setMessages(res.data);
      setHasMore(res.data.length === 30);
    } catch {
      // silent
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedConvId) { setMessages([]); return; }
    fetchMessages(selectedConvId);
    api.post(`/api/conversations/${selectedConvId}/read`).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => c.id === selectedConvId ? { ...c, unread_count: 0 } : c)
    );
    const id = setInterval(async () => {
      try {
        const res = await api.get(`/api/conversations/${selectedConvId}/messages`);
        setMessages(res.data);
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [selectedConvId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Load more ────────────────────────────────────────────────────────────────

  async function loadMore() {
    if (!selectedConvId || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0].id;
      const res = await api.get(`/api/conversations/${selectedConvId}/messages?before=${oldest}`);
      setMessages((prev) => [...res.data, ...prev]);
      setHasMore(res.data.length === 30);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Select conversation ──────────────────────────────────────────────────────

  function selectConv(conv) {
    setSelectedConvId(conv.id);
    setMessageText('');
    clearVoice();
    setAttachedFile(null);
  }

  // ── Load users ───────────────────────────────────────────────────────────────

  async function loadUsers() {
    if (allUsers.length > 0) return;
    try {
      const res = await api.get('/api/users');
      setAllUsers(res.data.filter((u) => u.id !== user?.id));
    } catch {}
  }

  // ── New direct chat ──────────────────────────────────────────────────────────

  async function openNewChat() {
    await loadUsers();
    setUserSearch('');
    setNewChatOpen(true);
  }

  async function startDirectChat(userId) {
    setCreating(true);
    try {
      const res = await api.post('/api/conversations', { type: 'direct', memberIds: [userId] });
      await fetchConversations();
      setSelectedConvId(res.data.id);
      setNewChatOpen(false);
    } catch {
      toast({ title: 'Failed to start chat', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  // ── New group ────────────────────────────────────────────────────────────────

  async function openNewGroup() {
    await loadUsers();
    setGroupName('');
    setSelectedUserIds(new Set());
    setUserSearch('');
    setNewGroupOpen(true);
  }

  function toggleUserInGroup(uid) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function createGroup() {
    if (!groupName.trim() || selectedUserIds.size === 0) return;
    setCreating(true);
    try {
      const res = await api.post('/api/conversations', {
        type: 'group',
        name: groupName.trim(),
        memberIds: [...selectedUserIds],
      });
      await fetchConversations();
      setSelectedConvId(res.data.id);
      setNewGroupOpen(false);
    } catch {
      toast({ title: 'Failed to create group', variant: 'destructive' });
    } finally {
      setCreating(false);
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

  // ── Send message ─────────────────────────────────────────────────────────────

  async function handleSend(e) {
    e.preventDefault();
    if (!selectedConvId) return;
    if (!messageText.trim() && !voiceBlob && !attachedFile) return;
    setSending(true);
    try {
      let newMsg;
      if (voiceBlob) {
        const form = new FormData();
        form.append('file', voiceBlob, 'voice.webm');
        form.append('type', 'voice');
        form.append('duration', String(voiceDuration));
        const res = await api.post(`/api/conversations/${selectedConvId}/messages/upload`, form);
        newMsg = res.data;
        clearVoice();
      } else if (attachedFile) {
        const form = new FormData();
        form.append('file', attachedFile);
        form.append('type', 'file');
        const res = await api.post(`/api/conversations/${selectedConvId}/messages/upload`, form);
        newMsg = res.data;
        setAttachedFile(null);
      } else {
        const res = await api.post(`/api/conversations/${selectedConvId}/messages`, { content: messageText });
        newMsg = res.data;
        setMessageText('');
      }
      setMessages((prev) => [...prev, newMsg]);
      fetchConversations();
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to send', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  // ── Delete message ───────────────────────────────────────────────────────────

  async function deleteMessage(msgId) {
    try {
      await api.delete(`/api/messages/${msgId}`);
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m)
      );
      setOpenMsgMenuId(null);
    } catch {
      toast({ title: 'Failed to delete message', variant: 'destructive' });
    }
  }

  // ── Grouped messages ─────────────────────────────────────────────────────────

  const grouped = groupMessagesByDate(messages);

  // ── Conversation list preview text ───────────────────────────────────────────

  function lastMsgPreview(conv) {
    if (!conv.last_message && !conv.last_message_type) return 'No messages yet';
    if (conv.last_message_type === 'voice') return '🎤 Voice note';
    if (conv.last_message_type === 'file') return '📎 File';
    return conv.last_message || '';
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-[100dvh] z-50 flex flex-col bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] transition-transform duration-200 ease-out w-full sm:w-[720px] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Chat panel"
      >
        {/* ── Panel Header ──────────────────────────────────────────────── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-[#0066CC]" />
            <h2 className="font-semibold">Messages</h2>
            {totalUnread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0066CC] text-[10px] font-bold text-white px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Two-column body ───────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* ── LEFT: Conversation list ──────────────────────────────── */}
          <div className={`flex flex-col border-r w-full sm:w-[260px] shrink-0 ${selectedConvId ? 'hidden sm:flex' : 'flex'}`}>
            {/* Search + new buttons */}
            <div className="space-y-2 p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={openNewChat}>
                  <Plus className="h-3.5 w-3.5" />
                  New Chat
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={openNewGroup}>
                  <Users className="h-3.5 w-3.5" />
                  New Group
                </Button>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="space-y-1 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageSquareText className="h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2 opacity-40" />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {convSearch ? 'No conversations found' : 'No conversations yet'}
                  </p>
                </div>
              ) : (
                filteredConvs.map((conv) => {
                  const name = getConvName(conv, user?.id);
                  const avatarUser = getConvAvatar(conv, user?.id);
                  const isSelected = conv.id === selectedConvId;
                  const hasUnread = conv.unread_count > 0;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectConv(conv)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--muted))] ${isSelected ? 'bg-[hsl(var(--muted))]' : ''}`}
                    >
                      {conv.type === 'direct' ? (
                        <Avatar
                          name={avatarUser?.full_name || avatarUser?.username || name}
                          color={avatarUser?.avatar_color || getAvatarColor(name)}
                          size="sm"
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0066CC]/10 text-[#0066CC]">
                          <Users className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-sm truncate ${hasUnread ? 'font-semibold' : 'font-medium'}`}>
                            {name}
                          </span>
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                            {timeAgo(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${hasUnread ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                            {lastMsgPreview(conv)}
                          </p>
                          {hasUnread && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#0066CC] text-[10px] font-bold text-white px-1">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT: Message thread ────────────────────────────────── */}
          <div className={`flex flex-col flex-1 min-w-0 ${selectedConvId ? 'flex' : 'hidden sm:flex'}`}>
            {!selectedConvId ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
                <MessageSquareText className="h-16 w-16 text-[hsl(var(--muted-foreground))] opacity-20 mb-4" />
                <h3 className="font-semibold text-[hsl(var(--muted-foreground))]">Select a conversation</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Choose a chat from the list or start a new one.
                </p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="sm:hidden flex h-8 w-8 items-center justify-center rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  {selectedConv && (() => {
                    const name = getConvName(selectedConv, user?.id);
                    const avatarUser = getConvAvatar(selectedConv, user?.id);
                    return (
                      <>
                        {selectedConv.type === 'direct' ? (
                          <Avatar
                            name={avatarUser?.full_name || avatarUser?.username || name}
                            color={avatarUser?.avatar_color || getAvatarColor(name)}
                            size="sm"
                          />
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0066CC]/10 text-[#0066CC]">
                            <Users className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{name}</p>
                          {selectedConv.type === 'group' && selectedConv.members && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                              {selectedConv.members.map((m) => m.username).join(', ')}
                            </p>
                          )}
                        </div>
                        {/* Member avatars (direct: show 1, group: show up to 3) */}
                        {selectedConv.type === 'group' && (
                          <div className="ml-auto flex -space-x-1.5">
                            {(selectedConv.members || []).slice(0, 3).map((m) => (
                              <Avatar
                                key={m.id}
                                name={m.full_name || m.username}
                                color={m.avatar_color || getAvatarColor(m.username)}
                                size="sm"
                                className="ring-2 ring-[hsl(var(--card))]"
                              />
                            ))}
                            {(selectedConv.members || []).length > 3 && (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs ring-2 ring-[hsl(var(--card))]">
                                +{selectedConv.members.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                  {loadingMsgs ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                          <Skeleton className={`h-10 rounded-xl ${i % 2 === 0 ? 'w-40' : 'w-52'}`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {hasMore && (
                        <div className="flex justify-center pb-2">
                          <Button size="sm" variant="ghost" onClick={loadMore} disabled={loadingMore} className="text-xs">
                            {loadingMore ? 'Loading…' : 'Load older messages'}
                          </Button>
                        </div>
                      )}
                      {grouped.map((item, idx) => {
                        if (item.kind === 'sep') {
                          return (
                            <div key={`sep-${idx}`} className="flex items-center gap-3 py-2">
                              <div className="flex-1 border-t border-[hsl(var(--border))]" />
                              <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{item.date}</span>
                              <div className="flex-1 border-t border-[hsl(var(--border))]" />
                            </div>
                          );
                        }

                        const { msg } = item;
                        const isOwn = msg.sender_id === user?.id;
                        const isDeleted = !!msg.deleted_at;
                        const canDelete = isOwn;

                        return (
                          <div
                            key={msg.id}
                            className={`group flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                          >
                            {/* Avatar (other user) */}
                            {!isOwn && (
                              <Avatar
                                name={msg.full_name || msg.username}
                                color={msg.avatar_color || getAvatarColor(msg.username)}
                                size="sm"
                                className="shrink-0 mb-1"
                              />
                            )}

                            {/* Bubble */}
                            <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                              {!isOwn && (
                                <span className="text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5 px-1">
                                  {msg.full_name || msg.username}
                                </span>
                              )}
                              <div
                                className={`relative rounded-2xl px-3 py-2 text-sm ${
                                  isOwn
                                    ? 'bg-[#0066CC] text-white rounded-br-sm'
                                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-bl-sm'
                                } ${isDeleted ? 'opacity-60' : ''}`}
                              >
                                {isDeleted ? (
                                  <span className="italic opacity-70">This message was deleted.</span>
                                ) : msg.type === 'voice' ? (
                                  <AudioPlayer src={`/uploads/${msg.file_path}`} duration={msg.duration || 0} />
                                ) : msg.type === 'file' ? (
                                  <FileAttachmentMsg fileName={msg.file_name} filePath={msg.file_path} fileSize={msg.file_size} />
                                ) : (
                                  <span className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</span>
                                )}

                                {/* Timestamp on hover */}
                                <span className={`absolute -bottom-4 text-[10px] text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${isOwn ? 'right-1' : 'left-1'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            {/* Delete menu */}
                            {canDelete && !isDeleted && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1 shrink-0">
                                <Popover open={openMsgMenuId === msg.id} onOpenChange={(v) => setOpenMsgMenuId(v ? msg.id : null)}>
                                  <PopoverTrigger asChild>
                                    <button className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Message actions">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align={isOwn ? 'end' : 'start'} className="w-32 p-1">
                                    <button
                                      onClick={() => deleteMessage(msg.id)}
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
                        );
                      })}
                      <div ref={messagesEndRef} className="h-4" />
                    </>
                  )}
                </div>

                {/* Message input */}
                <div className="border-t p-3 shrink-0">
                  <form onSubmit={handleSend} className="space-y-2">
                    {/* Voice preview */}
                    {voiceUrl && !recording && (
                      <div className="rounded-lg border border-[hsl(var(--border))] p-2 space-y-1.5">
                        <AudioPlayer src={voiceUrl} duration={voiceDuration} />
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">Voice · {formatDuration(voiceDuration)}</span>
                          <button type="button" onClick={clearVoice} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </div>
                      </div>
                    )}

                    {/* File preview */}
                    {attachedFile && (
                      <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                        {(() => { const Icon = getFileIcon(attachedFile.name); return <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />; })()}
                        <span className="text-sm truncate flex-1">{attachedFile.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{formatFileSize(attachedFile.size)}</span>
                        <button type="button" onClick={() => setAttachedFile(null)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Recording indicator */}
                    {recording && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-red-600 dark:text-red-400 font-mono">{formatDuration(recordingSeconds)}</span>
                        <span className="text-xs text-red-500">Recording…</span>
                      </div>
                    )}

                    {/* Text input */}
                    {!voiceBlob && !attachedFile && !recording && (
                      <Textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                        }}
                        placeholder="Message… (Enter to send)"
                        rows={2}
                        className="resize-none text-sm"
                      />
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
                        aria-label={recording ? 'Stop recording' : 'Record voice'}
                        title={recording ? 'Stop recording' : 'Record voice note'}
                      >
                        {recording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>

                      <label
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors ${(recording || !!voiceBlob) ? 'opacity-40 pointer-events-none' : ''}`}
                        title="Attach file"
                      >
                        <Paperclip className="h-4 w-4" />
                        <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileSelect} disabled={recording || !!voiceBlob} />
                      </label>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={(!messageText.trim() && !voiceBlob && !attachedFile) || sending || recording}
                        className="ml-auto"
                      >
                        {sending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="h-4 w-4" />}
                        Send
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── New Chat Dialog ──────────────────────────────────────────────── */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <Input
              placeholder="Search users…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {allUsers
                .filter((u) => {
                  const q = userSearch.toLowerCase();
                  return (u.full_name || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
                })
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startDirectChat(u.id)}
                    disabled={creating}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
                  >
                    <Avatar name={u.full_name || u.username} color={u.avatar_color || getAvatarColor(u.username)} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{u.full_name || u.username}</p>
                      {u.full_name && <p className="text-xs text-[hsl(var(--muted-foreground))]">@{u.username}</p>}
                    </div>
                  </button>
                ))}
              {allUsers.length === 0 && (
                <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No users found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── New Group Dialog ─────────────────────────────────────────────── */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Group Name</Label>
              <Input
                placeholder="e.g. Mastering Team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Add Members</Label>
              <Input
                placeholder="Search users…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto space-y-1 mt-1">
                {allUsers
                  .filter((u) => {
                    const q = userSearch.toLowerCase();
                    return (u.full_name || '').toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
                  })
                  .map((u) => {
                    const checked = selectedUserIds.has(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUserInGroup(u.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${checked ? 'bg-[#0066CC]/10' : 'hover:bg-[hsl(var(--muted))]'}`}
                      >
                        <Avatar name={u.full_name || u.username} color={u.avatar_color || getAvatarColor(u.username)} size="sm" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{u.full_name || u.username}</p>
                        </div>
                        {checked && <div className="h-4 w-4 rounded-full bg-[#0066CC] flex items-center justify-center shrink-0"><div className="h-1.5 w-1.5 rounded-full bg-white" /></div>}
                      </button>
                    );
                  })}
              </div>
              {selectedUserIds.size > 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{selectedUserIds.size} member{selectedUserIds.size !== 1 ? 's' : ''} selected</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewGroupOpen(false)}>Cancel</Button>
              <Button
                onClick={createGroup}
                disabled={!groupName.trim() || selectedUserIds.size === 0 || creating}
              >
                {creating ? 'Creating…' : 'Create Group'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
