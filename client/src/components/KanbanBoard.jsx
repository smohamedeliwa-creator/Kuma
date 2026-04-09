import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, MoreHorizontal, Calendar, MessageSquare, User, Loader2, Pencil, Trash2,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDate, getDueDateStatus } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';

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

const PRIORITY_COLORS = {
  urgent: '#EF4444',
  high: '#F97316',
  normal: '#3B82F6',
  low: '#94A3B8',
};

function StatusBadge({ statusKey, statuses = [] }) {
  const s = statuses.find(x => x.key === statusKey);
  if (!s) return <span className="text-xs text-[hsl(var(--muted-foreground))]">{statusKey}</span>;
  const textColor = getContrastColor(s.color);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
      style={{ backgroundColor: s.color, color: textColor }}
    >
      {s.label}
    </span>
  );
}

// ─── Task Card (pure display) ─────────────────────────────────────────────────

function KanbanCard({ task, statuses, onOpen, isDragging = false, isOverlay = false }) {
  const dueDateStatus = getDueDateStatus(task.due_date);
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal;

  return (
    <div
      onClick={onOpen}
      className={[
        'group relative rounded-lg border bg-[hsl(var(--card))] p-3 shadow-sm',
        'hover:shadow-md transition-all duration-150',
        isDragging ? 'opacity-40' : 'opacity-100',
        isOverlay ? 'shadow-2xl rotate-[1.5deg] cursor-grabbing' : 'cursor-grab',
        'border-[hsl(var(--border))]',
      ].join(' ')}
      style={{
        borderLeft: `3px solid ${priorityColor}`,
        boxShadow: isOverlay ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
      }}
    >
      <p className="text-[13px] font-semibold leading-snug text-[hsl(var(--foreground))] mb-2 pr-1">
        {task.name}
      </p>
      <div className="mb-2">
        <StatusBadge statusKey={task.status} statuses={statuses} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))]">
        {task.due_date && (
          <span className={`flex items-center gap-1 ${dueDateStatus === 'overdue' ? 'text-red-500' : ''}`}>
            <Calendar className="h-3 w-3 shrink-0" />
            {formatDate(task.due_date)}
          </span>
        )}
        {task.assignee_names && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 shrink-0" />
            <span className="max-w-[100px] truncate">{task.assignee_names}</span>
          </span>
        )}
        {task.comment_count > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3 shrink-0" />
            {task.comment_count}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Sortable Card wrapper ────────────────────────────────────────────────────

function SortableCard({ task, listId, statuses, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: { type: 'task', task, listId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {isDragging ? (
        // Ghost placeholder — dashed empty card at original position
        <div
          className="rounded-lg border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40"
          style={{ height: 88 }}
        />
      ) : (
        <KanbanCard task={task} statuses={statuses} onOpen={onOpen} />
      )}
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

function KanbanColumn({
  list, tasks, statuses, isAdmin,
  onOpenTask, onAddTask, onRenameList, onDeleteList,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Register this column as a droppable zone
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `col-${list.id}`,
    data: { type: 'column', listId: list.id },
  });

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const taskIds = tasks.map(t => `task-${t.id}`);

  return (
    <div
      className={[
        'flex flex-col rounded-xl border transition-all duration-150',
        'w-[280px] shrink-0',
        isOver
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)]/60 dark:bg-[var(--brand-primary-light)]/60 ring-2 ring-[var(--brand-primary)]/20'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50',
      ].join(' ')}
      style={{ minHeight: 120 }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{list.name}</span>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[hsl(var(--muted-foreground))]/20 px-1.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <button
              onClick={onAddTask}
              className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
              title="Add task"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {isAdmin && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                title="Column options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 w-36 rounded-lg border bg-[hsl(var(--card))] shadow-lg py-1">
                  <button
                    onClick={() => { setMenuOpen(false); onRenameList(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDeleteList(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tasks — ref applied here so the whole area is droppable */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setDropRef}
          className="flex-1 overflow-y-auto p-3 space-y-2"
          style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 60 }}
        >
          {tasks.length === 0 ? (
            <div className={[
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 text-center transition-colors duration-150',
              isOver
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                : 'border-[hsl(var(--border))]',
            ].join(' ')}>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {isOver ? 'Drop here' : 'No tasks yet'}
              </p>
              {isAdmin && !isOver && (
                <button
                  onClick={onAddTask}
                  className="mt-2 text-xs text-[var(--brand-primary)] hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Task
                </button>
              )}
            </div>
          ) : (
            tasks.map(task => (
              <SortableCard
                key={task.id}
                task={task}
                listId={list.id}
                statuses={statuses}
                onOpen={() => onOpenTask(task.id)}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Add task footer */}
      {isAdmin && tasks.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={onAddTask}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Add Task
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Quick Add Task Inline ────────────────────────────────────────────────────

function QuickAddTaskInline({ listId, statuses, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/api/task-lists/${listId}/tasks`, { name: name.trim() });
      onCreated(listId, res.data);
      toast({ title: 'Task created', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to create task', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border bg-[hsl(var(--card))] p-3 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onCancel()}
          placeholder="Task name…"
          className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
        />
        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onCancel} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            Cancel
          </button>
          <Button type="submit" size="sm" disabled={saving || !name.trim()} className="h-7 text-xs">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Rename List Inline ───────────────────────────────────────────────────────

function RenameListInline({ list, onRenamed, onCancel }) {
  const [value, setValue] = useState(list.name);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || value.trim() === list.name) { onCancel(); return; }
    setSaving(true);
    try {
      const res = await api.put(`/api/task-lists/${list.id}`, { name: value.trim() });
      onRenamed(res.data);
      toast({ title: 'List renamed', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to rename', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        disabled={saving}
        className="h-7 flex-1 min-w-0 rounded border bg-[hsl(var(--background))] px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
      />
    </form>
  );
}

// ─── KanbanBoard ──────────────────────────────────────────────────────────────

export function KanbanBoard({ taskLists, statuses, isAdmin, projectId, onOpenTask, onListRenamed, onListDeleted, onListCreated }) {
  const { toast } = useToast();
  const [listData, setListData] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [addingToList, setAddingToList] = useState(null);
  const [renamingList, setRenamingList] = useState(null);
  const [deletingList, setDeletingList] = useState(null);

  // Snapshot of listData before drag starts (for revert on error)
  const preDataRef = useRef(null);

  // Load all tasks
  useEffect(() => {
    if (!taskLists.length) { setLoading(false); return; }
    Promise.all(taskLists.map(l => api.get(`/api/task-lists/${l.id}/tasks`)))
      .then(results => {
        const data = {};
        taskLists.forEach((l, i) => { data[l.id] = results[i].data; });
        setListData(data);
      })
      .catch(() => toast({ title: 'Failed to load tasks', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [taskLists.map(l => l.id).join(',')]); // eslint-disable-line

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 8 },
    }),
  );

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function handleDragStart(event) {
    const { active } = event;
    if (active.data.current?.type === 'task') {
      setActiveTask(active.data.current.task);
      // Snapshot state before drag for potential revert
      preDataRef.current = listData;
    }
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== 'task') return;

    const draggedTask = active.data.current.task;
    const sourceListId = active.data.current.listId;

    // Determine the column we're hovering over
    let targetListId;
    if (over.data.current?.type === 'column') {
      targetListId = over.data.current.listId;
    } else if (over.data.current?.type === 'task') {
      targetListId = over.data.current.listId;
    }

    if (!targetListId || sourceListId === targetListId) return;

    // Move task optimistically between columns during drag
    setListData(prev => {
      const src = (prev[sourceListId] || []).filter(t => t.id !== draggedTask.id);
      const dst = [...(prev[targetListId] || [])];

      // Insert at position of hovered task, or end of column
      const overTaskId = over.data.current?.type === 'task' ? over.data.current.task.id : null;
      const insertIdx = overTaskId !== null ? dst.findIndex(t => t.id === overTaskId) : -1;
      dst.splice(insertIdx >= 0 ? insertIdx : dst.length, 0, {
        ...draggedTask,
        task_list_id: targetListId,
      });

      return { ...prev, [sourceListId]: src, [targetListId]: dst };
    });

    // Update the listId in active.data so subsequent events reflect the new column
    active.data.current.listId = targetListId;
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    const draggedTask = activeTask;
    setActiveTask(null);

    if (!over || !draggedTask) return;

    // Determine where the drag actually ended
    let targetListId;
    if (over.data.current?.type === 'column') {
      targetListId = over.data.current.listId;
    } else if (over.data.current?.type === 'task') {
      targetListId = over.data.current.listId;
    }

    if (!targetListId) return;

    // Find where task currently lives in our (already optimistically moved) state
    let currentListId = null;
    for (const [lid, tasks] of Object.entries(listData)) {
      if (tasks.some(t => t.id === draggedTask.id)) { currentListId = Number(lid); break; }
    }

    // Handle same-column reorder (handleDragOver doesn't run for same-column)
    const originalListId = preDataRef.current
      ? Object.entries(preDataRef.current).find(([, tasks]) => tasks.some(t => t.id === draggedTask.id))?.[0]
      : null;

    if (originalListId && Number(originalListId) === targetListId) {
      // Same-column: arrayMove
      if (over.data.current?.type === 'task' && over.data.current.task.id !== draggedTask.id) {
        setListData(prev => {
          const tasks = prev[targetListId] || [];
          const oldIdx = tasks.findIndex(t => t.id === draggedTask.id);
          const newIdx = tasks.findIndex(t => t.id === over.data.current.task.id);
          if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return prev;
          return { ...prev, [targetListId]: arrayMove(tasks, oldIdx, newIdx) };
        });
      }
      preDataRef.current = null;
      return;
    }

    // Cross-column: persist to server
    try {
      await api.put(`/api/tasks/${draggedTask.id}`, { task_list_id: targetListId });
      preDataRef.current = null;
    } catch {
      // Revert to pre-drag snapshot
      if (preDataRef.current) setListData(preDataRef.current);
      preDataRef.current = null;
      toast({ title: 'Failed to move task. Please try again.', variant: 'destructive' });
    }
  }

  function handleDragCancel() {
    setActiveTask(null);
    if (preDataRef.current) setListData(preDataRef.current);
    preDataRef.current = null;
  }

  // ── List management ──────────────────────────────────────────────────────────

  function handleTaskCreated(listId, task) {
    setListData(prev => ({
      ...prev,
      [listId]: [...(prev[listId] || []), { ...task, assignee_names: null }],
    }));
    setAddingToList(null);
  }

  async function handleDeleteList(list) {
    setDeletingList(list.id);
    try {
      await api.delete(`/api/task-lists/${list.id}`);
      onListDeleted(list.id);
      setListData(prev => { const n = { ...prev }; delete n[list.id]; return n; });
      toast({ title: `"${list.name}" deleted`, variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete list', variant: 'destructive' });
    } finally {
      setDeletingList(null);
    }
  }

  async function handleCreateList() {
    const name = window.prompt('New column name:');
    if (!name?.trim()) return;
    try {
      const res = await api.post(`/api/projects/${projectId}/task-lists`, { name: name.trim() });
      onListCreated(res.data);
      setListData(prev => ({ ...prev, [res.data.id]: [] }));
      toast({ title: `"${res.data.name}" created`, variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to create list', variant: 'destructive' });
    }
  }

  // ── Loading / empty states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-[280px] shrink-0 rounded-xl border bg-[hsl(var(--muted))]/50 p-3 space-y-2">
            <div className="h-5 w-32 rounded bg-[hsl(var(--muted))] animate-pulse" />
            {[1, 2, 3].map(j => (
              <div key={j} className="h-20 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (taskLists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold">No lists yet</p>
        {isAdmin && (
          <button onClick={handleCreateList} className="mt-3 text-sm text-[var(--brand-primary)] hover:underline">
            + Add a column
          </button>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2" style={{ minHeight: 400 }}>
        {taskLists.map(list => {
          const tasks = listData[list.id] || [];
          const isRenaming = renamingList === list.id;

          return (
            <div key={list.id} className="shrink-0">
              {isRenaming ? (
                <div className="w-[280px] rounded-xl border bg-[hsl(var(--muted))]/50 border-[hsl(var(--border))] p-3">
                  <RenameListInline
                    list={list}
                    onRenamed={updated => { onListRenamed(updated); setRenamingList(null); }}
                    onCancel={() => setRenamingList(null)}
                  />
                </div>
              ) : (
                <KanbanColumn
                  list={list}
                  tasks={tasks}
                  statuses={statuses}
                  isAdmin={isAdmin}
                  onOpenTask={onOpenTask}
                  onAddTask={() => setAddingToList(list.id)}
                  onRenameList={() => setRenamingList(list.id)}
                  onDeleteList={() => handleDeleteList(list)}
                />
              )}
              {addingToList === list.id && (
                <div className="w-[280px]">
                  <QuickAddTaskInline
                    listId={list.id}
                    statuses={statuses}
                    onCreated={handleTaskCreated}
                    onCancel={() => setAddingToList(null)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add Column */}
        {isAdmin && (
          <div className="shrink-0 flex items-start">
            <button
              onClick={handleCreateList}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[hsl(var(--border))] px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
              style={{ minHeight: 64 }}
            >
              <Plus className="h-4 w-4" />
              Add Column
            </button>
          </div>
        )}
      </div>

      {/* Drag overlay — floating preview card */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div style={{ width: 280 }}>
            <KanbanCard task={activeTask} statuses={statuses} onOpen={() => {}} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
