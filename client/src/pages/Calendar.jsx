import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, Plus, X, Check, XCircle,
  Calendar as CalendarIcon, Clock, Users, Edit2, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const PRESET_COLORS = ['#0066CC', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2'];
const TYPE_LABELS = { event: 'Event', meeting: 'Meeting', deadline: 'Deadline' };
const TYPE_BADGE_COLORS = {
  event: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  meeting: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  deadline: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isToday(year, month, day) {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
}

function formatTime(datetimeStr) {
  if (!datetimeStr) return '';
  const d = new Date(datetimeStr);
  if (isNaN(d)) {
    // Try parsing as date-only or date+time string directly
    const parts = datetimeStr.split('T');
    if (parts.length === 2) {
      const [h, min] = parts[1].split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      return `${hour % 12 || 12}:${min} ${ampm}`;
    }
    return '';
  }
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = isSameDay(startDate, endDate);
  const dateStr = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (sameDay) {
    return `${dateStr} · ${formatTime(start)} – ${formatTime(end)}`;
  }
  return `${dateStr} ${formatTime(start)} – ${endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${formatTime(end)}`;
}

function toLocalDatetimeValue(datetimeStr) {
  if (!datetimeStr) return '';
  // Accept YYYY-MM-DDTHH:mm or YYYY-MM-DD
  const t = datetimeStr.substring(0, 16);
  return t;
}

function getEventsForDay(events, year, month, day) {
  const target = new Date(year, month, day);
  return events.filter(ev => {
    const startDate = new Date(ev.start_datetime);
    const endDate = new Date(ev.end_datetime);
    // normalize to date only for comparison
    const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    return target >= s && target <= e;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AttendeeStatus({ status }) {
  if (status === 'accepted') return <Check className="h-3 w-3 text-green-500" />;
  if (status === 'declined') return <XCircle className="h-3 w-3 text-red-500" />;
  return <Clock className="h-3 w-3 text-yellow-500" />;
}

function EventChip({ event, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      className="w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-white leading-tight"
      style={{ backgroundColor: event.color }}
      title={event.title}
    >
      {event.title}
    </button>
  );
}

// ─── Event Detail Popup ───────────────────────────────────────────────────────

function EventDetailPopup({ event, currentUser, onClose, onEdit, onDelete, onRsvp }) {
  const myAttendee = event.attendees?.find(a => a.user_id === currentUser?.id);
  const isCreator = event.created_by === currentUser?.id;
  const canEdit = !event.readonly && (isCreator || currentUser?.role === 'admin');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:w-[420px] rounded-t-2xl sm:rounded-xl bg-[hsl(var(--card))] shadow-2xl border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Color strip */}
        <div className="h-2 w-full" style={{ backgroundColor: event.color }} />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 ${TYPE_BADGE_COLORS[event.type] || TYPE_BADGE_COLORS.event}`}>
                {TYPE_LABELS[event.type] || event.type}
              </span>
              <h2 className="text-base font-semibold leading-snug">{event.title}</h2>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-full p-1 hover:bg-[hsl(var(--muted))] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{formatDateRange(event.start_datetime, event.end_datetime)}</span>
          </div>

          {/* Description */}
          {event.description && (
            <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">{event.description}</p>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                <Users className="h-3.5 w-3.5" />
                Attendees
              </div>
              <div className="space-y-1.5">
                {event.attendees.map(a => (
                  <div key={a.user_id} className="flex items-center justify-between text-sm">
                    <span>{a.full_name || a.username}</span>
                    <div className="flex items-center gap-1">
                      <AttendeeStatus status={a.status} />
                      <span className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RSVP buttons (for invited attendees who are not the creator) */}
          {myAttendee && !isCreator && myAttendee.status === 'invited' && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" onClick={() => onRsvp(event.id, 'accepted')}>
                <Check className="h-4 w-4 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onRsvp(event.id, 'declined')}>
                <XCircle className="h-4 w-4 mr-1" /> Decline
              </Button>
            </div>
          )}

          {myAttendee && !isCreator && myAttendee.status !== 'invited' && (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              You have <span className="font-medium capitalize">{myAttendee.status}</span> this event.
            </div>
          )}

          {/* Edit / Delete */}
          {canEdit && (
            <div className="flex gap-2 pt-1 border-t">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(event)}>
                <Edit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(event.id)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function EventFormModal({ open, onClose, onSave, editingEvent, allUsers, projects }) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const defaultDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const defaultStart = `${defaultDate}T09:00`;
  const defaultEnd = `${defaultDate}T10:00`;

  const [form, setForm] = useState({
    title: '',
    type: 'event',
    start_datetime: defaultStart,
    end_datetime: defaultEnd,
    description: '',
    color: PRESET_COLORS[0],
    project_id: '',
    attendee_ids: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingEvent) {
      setForm({
        title: editingEvent.title || '',
        type: editingEvent.type || 'event',
        start_datetime: toLocalDatetimeValue(editingEvent.start_datetime),
        end_datetime: toLocalDatetimeValue(editingEvent.end_datetime),
        description: editingEvent.description || '',
        color: editingEvent.color || PRESET_COLORS[0],
        project_id: editingEvent.project_id ? String(editingEvent.project_id) : '',
        attendee_ids: editingEvent.attendees?.map(a => a.user_id) || [],
      });
    } else {
      setForm({
        title: '', type: 'event', start_datetime: defaultStart, end_datetime: defaultEnd,
        description: '', color: PRESET_COLORS[0], project_id: '', attendee_ids: [],
      });
    }
  }, [editingEvent, open]);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleAttendee(uid) {
    setForm(f => ({
      ...f,
      attendee_ids: f.attendee_ids.includes(uid)
        ? f.attendee_ids.filter(id => id !== uid)
        : [...f.attendee_ids, uid],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        project_id: form.project_id ? parseInt(form.project_id, 10) : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="ev-title">Title *</label>
            <input
              id="ev-title"
              required
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Event title"
              maxLength={200}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <div className="flex gap-2">
              {['event', 'meeting', 'deadline'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium capitalize transition-colors ${
                    form.type === t
                      ? 'border-[#0066CC] bg-[#0066CC]/10 text-[#0066CC]'
                      : 'hover:bg-[hsl(var(--muted))]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Date / Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="ev-start">Start *</label>
              <input
                id="ev-start"
                type="datetime-local"
                required
                className="w-full rounded-md border bg-[hsl(var(--background))] px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                value={form.start_datetime}
                onChange={e => set('start_datetime', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="ev-end">End *</label>
              <input
                id="ev-end"
                type="datetime-local"
                required
                className="w-full rounded-md border bg-[hsl(var(--background))] px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                value={form.end_datetime}
                onChange={e => set('end_datetime', e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="ev-desc">Description</label>
            <textarea
              id="ev-desc"
              rows={3}
              className="w-full rounded-md border bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {/* Project (optional) */}
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="ev-project">Link to project</label>
              <select
                id="ev-project"
                className="w-full rounded-md border bg-[hsl(var(--background))] px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                value={form.project_id}
                onChange={e => set('project_id', e.target.value)}
              >
                <option value="">None</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Attendees */}
          {allUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                <Users className="inline h-4 w-4 mr-1" />
                Invite attendees
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
                {allUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-[hsl(var(--muted))]">
                    <input
                      type="checkbox"
                      checked={form.attendee_ids.includes(u.id)}
                      onChange={() => toggleAttendee(u.id)}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-sm">{u.full_name || u.username}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ year, month, events, selectedDate, onSelectDate, onEventClick }) {
  const firstDay = firstDayOfMonth(year, month);
  const totalDays = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex-1 overflow-auto">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-[hsl(var(--muted-foreground))]">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[80px] sm:min-h-[110px] border-b border-r bg-[hsl(var(--muted))]/20" />;
          }
          const dayEvents = getEventsForDay(events, year, month, day);
          const today = isToday(year, month, day);
          const selected = selectedDate && selectedDate.getDate() === day &&
            selectedDate.getMonth() === month && selectedDate.getFullYear() === year;

          return (
            <div
              key={day}
              className={`min-h-[80px] sm:min-h-[110px] border-b border-r p-1 cursor-pointer transition-colors
                ${today ? 'bg-[#0066CC]/5' : ''}
                ${selected ? 'bg-[#0066CC]/10 ring-1 ring-inset ring-[#0066CC]/30' : ''}
                hover:bg-[hsl(var(--muted))]/40`}
              onClick={() => onSelectDate(new Date(year, month, day))}
            >
              {/* Day number */}
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1
                ${today ? 'bg-[#0066CC] text-white' : ''}`}>
                {day}
              </div>

              {/* Desktop: event chips */}
              <div className="hidden sm:flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={onEventClick} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] px-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>

              {/* Mobile: dots */}
              {dayEvents.length > 0 && (
                <div className="flex sm:hidden flex-wrap gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map(ev => (
                    <span
                      key={ev.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ev.color }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ year, month, day, events, onEventClick }) {
  const startOfWeek = new Date(year, month, day);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b">
        {days.map(d => (
          <div key={d.toISOString()} className="py-2 text-center">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{WEEK_DAYS[d.getDay()]}</div>
            <div className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold
              ${isToday(d.getFullYear(), d.getMonth(), d.getDate()) ? 'bg-[#0066CC] text-white' : ''}`}>
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map(d => {
          const dayEvts = getEventsForDay(events, d.getFullYear(), d.getMonth(), d.getDate());
          return (
            <div key={d.toISOString()} className="border-r p-1 space-y-1">
              {dayEvts.length === 0 ? (
                <div className="h-full" />
              ) : (
                dayEvts.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="w-full rounded p-1.5 text-left text-xs text-white"
                    style={{ backgroundColor: ev.color }}
                  >
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="opacity-80">{formatTime(ev.start_datetime)}</div>
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ date, events, onEventClick }) {
  const dayEvts = getEventsForDay(events, date.getFullYear(), date.getMonth(), date.getDate());
  const dateLabel = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex-1 overflow-auto p-4">
      <h3 className="text-base font-semibold mb-4">{dateLabel}</h3>
      {dayEvts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarIcon className="h-10 w-10 text-[hsl(var(--muted-foreground))] mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No events today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvts.map(ev => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="w-full rounded-lg border-l-4 bg-[hsl(var(--card))] p-4 text-left shadow-sm hover:shadow-md transition-shadow"
              style={{ borderLeftColor: ev.color }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${TYPE_BADGE_COLORS[ev.type] || TYPE_BADGE_COLORS.event}`}>
                    {TYPE_LABELS[ev.type] || ev.type}
                  </span>
                  <p className="font-semibold text-sm">{ev.title}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    {formatTime(ev.start_datetime)} – {formatTime(ev.end_datetime)}
                  </p>
                </div>
                {ev.attendees?.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <Users className="h-3.5 w-3.5" />
                    {ev.attendees.length}
                  </div>
                )}
              </div>
              {ev.description && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 line-clamp-2">{ev.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Day Event List ────────────────────────────────────────────────────

function MobileDayEvents({ date, events, onEventClick }) {
  if (!date) return null;
  const dayEvts = getEventsForDay(events, date.getFullYear(), date.getMonth(), date.getDate());
  const label = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="border-t mt-2 pt-3">
      <h3 className="text-sm font-semibold mb-2 px-1">{label}</h3>
      {dayEvts.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] px-1">No events</p>
      ) : (
        <div className="space-y-2">
          {dayEvts.map(ev => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="w-full flex items-center gap-3 rounded-lg border-l-4 p-3 text-left bg-[hsl(var(--card))] shadow-sm"
              style={{ borderLeftColor: ev.color }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ev.title}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatTime(ev.start_datetime)} – {formatTime(ev.end_datetime)}
                </p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_BADGE_COLORS[ev.type] || TYPE_BADGE_COLORS.event}`}>
                {TYPE_LABELS[ev.type]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────

export function Calendar() {
  const { user } = useAuth();
  const { toast } = useToast();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [detailEvent, setDetailEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Fetch events for current month
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await axios.get(`/api/events?year=${viewYear}&month=${viewMonth + 1}`);
      setEvents(res.data.data || []);
    } catch {
      toast({ title: 'Failed to load events', variant: 'destructive' });
    } finally {
      setLoadingEvents(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Fetch users and projects once
  useEffect(() => {
    axios.get('/api/users').then(r => setAllUsers(r.data.filter(u => u.id !== user?.id))).catch(() => {});
    axios.get('/api/projects').then(r => setProjects(r.data || [])).catch(() => {});
  }, [user?.id]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  }

  async function handleSaveEvent(formData) {
    try {
      if (editingEvent) {
        const res = await axios.put(`/api/events/${editingEvent.id}`, formData);
        setEvents(evs => evs.map(e => e.id === editingEvent.id ? { ...res.data.data } : e));
        toast({ title: 'Event updated' });
      } else {
        const res = await axios.post('/api/events', formData);
        setEvents(evs => [...evs, res.data.data]);
        toast({ title: 'Event created' });
      }
      setEditingEvent(null);
    } catch {
      toast({ title: 'Failed to save event', variant: 'destructive' });
      throw new Error('save failed');
    }
  }

  async function handleDeleteEvent(eventId) {
    try {
      await axios.delete(`/api/events/${eventId}`);
      setEvents(evs => evs.filter(e => e.id !== eventId));
      setDetailEvent(null);
      toast({ title: 'Event deleted' });
    } catch {
      toast({ title: 'Failed to delete event', variant: 'destructive' });
    }
  }

  async function handleRsvp(eventId, status) {
    try {
      await axios.put(`/api/events/${eventId}/attendees`, { status });
      setEvents(evs => evs.map(e => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          attendees: e.attendees.map(a => a.user_id === user?.id ? { ...a, status } : a),
        };
      }));
      if (detailEvent?.id === eventId) {
        setDetailEvent(ev => ({
          ...ev,
          attendees: ev.attendees.map(a => a.user_id === user?.id ? { ...a, status } : a),
        }));
      }
      toast({ title: `You ${status} the event` });
    } catch {
      toast({ title: 'Failed to update RSVP', variant: 'destructive' });
    }
  }

  function handleEventClick(ev) {
    setDetailEvent(ev);
  }

  function handleEdit(ev) {
    setDetailEvent(null);
    setEditingEvent(ev);
    setShowCreateModal(true);
  }

  function handleOpenCreate() {
    setEditingEvent(null);
    setShowCreateModal(true);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Calendar</h1>
        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Event</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Calendar card */}
      <div className="flex flex-col flex-1 rounded-xl border bg-[hsl(var(--card))] shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-semibold w-40 text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday} className="ml-1">
              Today
            </Button>
          </div>

          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden">
            {['month', 'week', 'day'].map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors
                  ${viewMode === v ? 'bg-[#0066CC] text-white' : 'hover:bg-[hsl(var(--muted))]'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Loading skeleton */}
        {loadingEvents ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0066CC] border-t-transparent" />
          </div>
        ) : (
          <>
            {viewMode === 'month' && (
              <>
                <MonthView
                  year={viewYear}
                  month={viewMonth}
                  events={events}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onEventClick={handleEventClick}
                />
                {/* Mobile: selected date events below grid */}
                <div className="sm:hidden px-4 pb-4">
                  <MobileDayEvents
                    date={selectedDate}
                    events={events}
                    onEventClick={handleEventClick}
                  />
                </div>
              </>
            )}
            {viewMode === 'week' && (
              <WeekView
                year={selectedDate.getFullYear()}
                month={selectedDate.getMonth()}
                day={selectedDate.getDate()}
                events={events}
                onEventClick={handleEventClick}
              />
            )}
            {viewMode === 'day' && (
              <DayView
                date={selectedDate}
                events={events}
                onEventClick={handleEventClick}
              />
            )}
          </>
        )}
      </div>

      {/* Event detail popup */}
      {detailEvent && (
        <EventDetailPopup
          event={detailEvent}
          currentUser={user}
          onClose={() => setDetailEvent(null)}
          onEdit={handleEdit}
          onDelete={handleDeleteEvent}
          onRsvp={handleRsvp}
        />
      )}

      {/* Create / Edit modal */}
      <EventFormModal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        editingEvent={editingEvent}
        allUsers={allUsers}
        projects={projects}
      />
    </div>
  );
}
