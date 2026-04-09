import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/useToast';

// ─── Date helpers ──────────────────────────────────────────────────────────────

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function diffDays(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

function fmtShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMonthYear(d) {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Status → bar color
const STATUS_COLORS = {
  todo: '#94A3B8',
  in_progress: '#3B82F6',
  done: '#22C55E',
};

function getBarColor(status, statuses) {
  // check custom statuses first
  const s = statuses.find(x => x.key === status);
  if (s) return s.color;
  return STATUS_COLORS[status] || '#94A3B8';
}

// ─── Zoom config ───────────────────────────────────────────────────────────────

const ZOOM_CONFIGS = {
  day:     { colWidth: 40,  totalDays: 30,  labelEvery: 1,  labelFmt: d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), subLabel: d => `${d.getHours()}:00` },
  week:    { colWidth: 28,  totalDays: 84,  labelEvery: 7,  labelFmt: d => fmtShort(d), subLabel: null },
  month:   { colWidth: 24,  totalDays: 180, labelEvery: 30, labelFmt: d => fmtMonthYear(d), subLabel: null },
  quarter: { colWidth: 20,  totalDays: 365, labelEvery: 91, labelFmt: d => fmtMonthYear(d), subLabel: null },
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ task, statuses, x, y }) {
  const color = getBarColor(task.status, statuses);
  return (
    <div
      className="pointer-events-none absolute z-50 rounded-lg border bg-[hsl(var(--card))] shadow-xl p-3 text-xs"
      style={{ left: x + 12, top: y - 8, minWidth: 180, maxWidth: 240 }}
    >
      <p className="font-semibold text-sm mb-1 text-[hsl(var(--foreground))]">{task.name}</p>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[hsl(var(--muted-foreground))]">{task.status}</span>
      </div>
      {task.start_display && (
        <p className="text-[hsl(var(--muted-foreground))]">
          Start: {new Date(task.start_display + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      )}
      {task.due_date && (
        <p className="text-[hsl(var(--muted-foreground))]">
          Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      )}
      {task.assignee_names && (
        <p className="text-[hsl(var(--muted-foreground))] mt-0.5">Assignee: {task.assignee_names}</p>
      )}
    </div>
  );
}

// ─── Task Bar ─────────────────────────────────────────────────────────────────

function GanttBar({ task, ganttStart, colWidth, statuses, onOpen, onDateChange }) {
  const barRef = useRef(null);
  const dragState = useRef(null); // { type: 'move'|'left'|'right', startX, origStart, origEnd }
  const [localTask, setLocalTask] = useState(task);
  const [tooltip, setTooltip] = useState(null);
  const { toast } = useToast();

  useEffect(() => { setLocalTask(task); }, [task]);

  const startDate = localTask.start_display
    ? startOfDay(new Date(localTask.start_display + 'T00:00:00'))
    : startOfDay(new Date());
  const endDate = localTask.due_date
    ? startOfDay(new Date(localTask.due_date + 'T00:00:00'))
    : null;

  const leftPx = diffDays(ganttStart, startDate) * colWidth;
  const durationDays = endDate ? Math.max(1, diffDays(startDate, endDate) + 1) : 0;
  const widthPx = endDate ? durationDays * colWidth : 16;
  const hasNoDueDate = !endDate;

  const color = getBarColor(localTask.status, statuses);

  function handleMouseDown(e, type) {
    e.stopPropagation();
    e.preventDefault();
    dragState.current = {
      type,
      startX: e.clientX,
      origStart: localTask.start_display,
      origEnd: localTask.due_date,
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  const handleMouseMove = useCallback((e) => {
    if (!dragState.current) return;
    const { type, startX, origStart, origEnd } = dragState.current;
    const deltaDays = Math.round((e.clientX - startX) / colWidth);
    if (deltaDays === 0) return;

    const origStartDate = origStart ? new Date(origStart + 'T00:00:00') : new Date();
    const origEndDate = origEnd ? new Date(origEnd + 'T00:00:00') : null;

    let newStart = origStart;
    let newEnd = origEnd;

    if (type === 'move') {
      const ns = addDays(origStartDate, deltaDays);
      newStart = ns.toISOString().slice(0, 10);
      if (origEndDate) {
        const ne = addDays(origEndDate, deltaDays);
        newEnd = ne.toISOString().slice(0, 10);
      }
    } else if (type === 'left') {
      const ns = addDays(origStartDate, deltaDays);
      if (!origEndDate || ns < new Date(origEnd + 'T00:00:00')) {
        newStart = ns.toISOString().slice(0, 10);
      }
    } else if (type === 'right') {
      if (origEndDate) {
        const ne = addDays(origEndDate, deltaDays);
        if (ne >= new Date(origStart + 'T00:00:00')) {
          newEnd = ne.toISOString().slice(0, 10);
        }
      } else {
        const ne = addDays(origStartDate, Math.max(0, deltaDays));
        newEnd = ne.toISOString().slice(0, 10);
      }
    }
    setLocalTask(prev => ({ ...prev, start_display: newStart, due_date: newEnd }));
  }, [colWidth]);

  const handleMouseUp = useCallback(async () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    if (!dragState.current) return;
    const { origStart, origEnd } = dragState.current;
    dragState.current = null;

    const newStart = localTask.start_display;
    const newEnd = localTask.due_date;

    if (newStart === origStart && newEnd === origEnd) return;

    try {
      await api.put(`/api/tasks/${localTask.id}`, {
        due_date: newEnd || null,
      });
      onDateChange?.(localTask.id, newStart, newEnd);
    } catch {
      // revert
      setLocalTask(task);
      toast({ title: 'Failed to save dates', variant: 'destructive' });
    }
  }, [localTask, task, handleMouseMove, onDateChange, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (leftPx < 0 && (leftPx + widthPx) < 0) return null; // off screen left

  return (
    <div
      ref={barRef}
      className="absolute top-1/2 -translate-y-1/2 rounded"
      style={{
        left: Math.max(0, leftPx),
        width: Math.max(hasNoDueDate ? 16 : 8, widthPx - Math.max(0, -leftPx)),
        height: 28,
        backgroundColor: hasNoDueDate ? 'transparent' : color,
        border: hasNoDueDate ? `2px dashed ${color}` : 'none',
        cursor: 'grab',
        userSelect: 'none',
        zIndex: 2,
        opacity: 0.9,
      }}
      onMouseDown={e => handleMouseDown(e, 'move')}
      onClick={e => { e.stopPropagation(); onOpen(); }}
      onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTooltip(null)}
      onMouseMove={e => setTooltip({ x: e.clientX, y: e.clientY })}
    >
      {/* Left drag handle */}
      {!hasNoDueDate && (
        <div
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          onMouseDown={e => handleMouseDown(e, 'left')}
        />
      )}

      {/* Task name inside bar */}
      {!hasNoDueDate && widthPx > 40 && (
        <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white truncate pointer-events-none">
          {localTask.name}
        </span>
      )}

      {/* Right drag handle */}
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r"
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        onMouseDown={e => handleMouseDown(e, 'right')}
      />

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed" style={{ left: 0, top: 0, pointerEvents: 'none', zIndex: 9999 }}>
          <Tooltip task={localTask} statuses={statuses} x={tooltip.x} y={tooltip.y} />
        </div>
      )}
    </div>
  );
}

// ─── GanttChart ───────────────────────────────────────────────────────────────

export function GanttChart({ taskLists, statuses, projectId, onOpenTask }) {
  const { toast } = useToast();
  const [listData, setListData] = useState({});
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState('week');
  const [collapsed, setCollapsed] = useState({});
  const [leftPanelHidden, setLeftPanelHidden] = useState(window.innerWidth < 768);
  const timelineRef = useRef(null);

  const cfg = ZOOM_CONFIGS[zoom];

  // Gantt starts a few days before today
  const today = startOfDay(new Date());
  const ganttStart = addDays(today, -7);
  const ganttEnd = addDays(ganttStart, cfg.totalDays);

  // Load tasks
  useEffect(() => {
    if (!taskLists.length) { setLoading(false); return; }
    Promise.all(taskLists.map(l => api.get(`/api/task-lists/${l.id}/tasks`)))
      .then(results => {
        const data = {};
        taskLists.forEach((l, i) => {
          data[l.id] = results[i].data.map(t => ({
            ...t,
            start_display: t.start_date || t.created_at?.slice(0, 10) || today.toISOString().slice(0, 10),
          }));
        });
        setListData(data);
      })
      .catch(() => toast({ title: 'Failed to load tasks', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [taskLists.map(l => l.id).join(',')]); // eslint-disable-line

  // Responsive
  useEffect(() => {
    function onResize() { setLeftPanelHidden(window.innerWidth < 768); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Scroll today into view on mount
  useEffect(() => {
    if (timelineRef.current) {
      const todayOffset = diffDays(ganttStart, today) * cfg.colWidth - 100;
      timelineRef.current.scrollLeft = Math.max(0, todayOffset);
    }
  }, [loading, zoom]); // eslint-disable-line

  // Build date columns
  const dateColumns = [];
  for (let d = new Date(ganttStart); d <= ganttEnd; d = addDays(d, 1)) {
    dateColumns.push(new Date(d));
  }

  const totalWidth = dateColumns.length * cfg.colWidth;
  const todayOffset = diffDays(ganttStart, today) * cfg.colWidth;

  function handleDateChange(taskId, newStart, newEnd) {
    setListData(prev => {
      const next = { ...prev };
      for (const listId of Object.keys(next)) {
        next[listId] = next[listId].map(t =>
          t.id === taskId ? { ...t, start_display: newStart, due_date: newEnd } : t
        );
      }
      return next;
    });
  }

  // Separate tasks with and without dates
  function getTasksForList(listId) {
    const tasks = listData[listId] || [];
    const withDates = tasks.filter(t => t.due_date || t.start_display);
    const noDates = tasks.filter(t => !t.due_date && !t.start_display);
    return { withDates, noDates };
  }

  const allNoDates = taskLists.flatMap(l => {
    const tasks = listData[l.id] || [];
    return tasks.filter(t => !t.due_date && !t.start_display);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  const ROW_HEIGHT = 40;

  return (
    <div className="flex flex-col border rounded-xl overflow-hidden bg-[hsl(var(--card))]" style={{ minHeight: 400 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-[hsl(var(--muted))]/30 gap-4">
        <div className="flex items-center gap-1 text-xs">
          {!leftPanelHidden && (
            <button
              onClick={() => setLeftPanelHidden(true)}
              className="rounded px-2 py-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              title="Hide task list"
            >
              ←
            </button>
          )}
          {leftPanelHidden && (
            <button
              onClick={() => setLeftPanelHidden(false)}
              className="rounded px-2 py-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              title="Show task list"
            >
              →
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {Object.keys(ZOOM_CONFIGS).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={[
                'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                zoom === z
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
              ].join(' ')}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Body: left panel + timeline */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 300 }}>

        {/* Left panel */}
        {!leftPanelHidden && (
          <div className="w-[240px] shrink-0 border-r overflow-y-auto" style={{ minWidth: 180 }}>
            {/* Header spacer */}
            <div className="h-[40px] border-b bg-[hsl(var(--muted))]/30" />

            {/* Sections */}
            {taskLists.map(list => {
              const tasks = listData[list.id] || [];
              const isCollapsed = collapsed[list.id];
              return (
                <React.Fragment key={list.id}>
                  {/* Group header */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(var(--muted))]/50 border-b cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => setCollapsed(prev => ({ ...prev, [list.id]: !prev[list.id] }))}
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    }
                    <span className="text-xs font-semibold truncate">{list.name}</span>
                    <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">{tasks.length}</span>
                  </div>
                  {/* Task rows */}
                  {!isCollapsed && tasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-1.5 px-4 border-b cursor-pointer hover:bg-[hsl(var(--muted))]/40 transition-colors group"
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => onOpenTask(task.id)}
                    >
                      <span className="text-xs truncate text-[hsl(var(--foreground))] group-hover:text-[var(--brand-primary)]">
                        {task.name}
                      </span>
                      <Calendar className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 ml-auto" />
                    </div>
                  ))}
                </React.Fragment>
              );
            })}

            {/* No dates section */}
            {allNoDates.length > 0 && (
              <>
                <div
                  className="flex items-center gap-1.5 px-3 py-2 bg-[hsl(var(--muted))]/50 border-b cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => setCollapsed(prev => ({ ...prev, __nodates__: !prev.__nodates__ }))}
                >
                  {collapsed.__nodates__
                    ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                  }
                  <span className="text-xs font-semibold truncate text-[hsl(var(--muted-foreground))]">No dates</span>
                  <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">{allNoDates.length}</span>
                </div>
                {!collapsed.__nodates__ && allNoDates.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-1.5 px-4 border-b cursor-pointer hover:bg-[hsl(var(--muted))]/40 transition-colors group"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span className="text-xs truncate text-[hsl(var(--muted-foreground))] group-hover:text-[var(--brand-primary)]">
                      {task.name}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Timeline */}
        <div ref={timelineRef} className="flex-1 overflow-x-auto overflow-y-auto relative">
          <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>

            {/* Date header */}
            <div
              className="flex sticky top-0 z-10 border-b bg-[hsl(var(--card))]"
              style={{ height: 40, width: totalWidth }}
            >
              {dateColumns.map((d, i) => {
                const isLabelDay = i % cfg.labelEvery === 0;
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <div
                    key={i}
                    className={[
                      'shrink-0 border-r flex items-end pb-1 px-1',
                      isToday ? 'bg-red-50 dark:bg-red-950/20' : '',
                    ].join(' ')}
                    style={{ width: cfg.colWidth }}
                  >
                    {isLabelDay && (
                      <span className={`text-[9px] font-medium truncate ${isToday ? 'text-red-500' : 'text-[hsl(var(--muted-foreground))]'}`}>
                        {cfg.labelFmt(d)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid + bars */}
            <div style={{ width: totalWidth, position: 'relative' }}>

              {/* Today line */}
              {todayOffset >= 0 && todayOffset <= totalWidth && (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{
                    left: todayOffset + cfg.colWidth / 2,
                    width: 2,
                    background: 'repeating-linear-gradient(to bottom, #EF4444 0px, #EF4444 6px, transparent 6px, transparent 10px)',
                  }}
                />
              )}

              {/* Rows */}
              {taskLists.map(list => {
                const tasks = listData[list.id] || [];
                const isCollapsed = collapsed[list.id];
                return (
                  <React.Fragment key={list.id}>
                    {/* Group row */}
                    <div
                      className="relative border-b bg-[hsl(var(--muted))]/30 flex items-center"
                      style={{ height: ROW_HEIGHT, width: totalWidth }}
                    >
                      {/* Day grid lines */}
                      {dateColumns.map((d, i) => (
                        <div
                          key={i}
                          className={[
                            'absolute top-0 bottom-0 border-r',
                            d.toDateString() === today.toDateString() ? 'bg-red-50/40 dark:bg-red-950/10 border-red-200' : 'border-[hsl(var(--border))]/40',
                          ].join(' ')}
                          style={{ left: i * cfg.colWidth, width: cfg.colWidth }}
                        />
                      ))}
                      <span className="relative z-10 px-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] truncate">
                        {list.name}
                      </span>
                    </div>

                    {/* Task rows */}
                    {!isCollapsed && tasks.map(task => (
                      <div
                        key={task.id}
                        className="relative border-b"
                        style={{ height: ROW_HEIGHT, width: totalWidth }}
                        onClick={() => onOpenTask(task.id)}
                      >
                        {/* Day grid lines */}
                        {dateColumns.map((d, i) => (
                          <div
                            key={i}
                            className={[
                              'absolute top-0 bottom-0 border-r',
                              d.toDateString() === today.toDateString() ? 'bg-red-50/20 dark:bg-red-950/5 border-red-200' : 'border-[hsl(var(--border))]/30',
                            ].join(' ')}
                            style={{ left: i * cfg.colWidth, width: cfg.colWidth }}
                          />
                        ))}

                        {/* Task bar */}
                        <GanttBar
                          task={task}
                          ganttStart={ganttStart}
                          colWidth={cfg.colWidth}
                          statuses={statuses}
                          onOpen={() => onOpenTask(task.id)}
                          onDateChange={handleDateChange}
                        />
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* No dates section */}
              {allNoDates.length > 0 && !collapsed.__nodates__ && (
                <>
                  <div
                    className="relative border-b bg-[hsl(var(--muted))]/30 flex items-center"
                    style={{ height: ROW_HEIGHT, width: totalWidth }}
                  >
                    {dateColumns.map((_, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-r border-[hsl(var(--border))]/40" style={{ left: i * cfg.colWidth, width: cfg.colWidth }} />
                    ))}
                    <span className="relative z-10 px-3 text-xs font-semibold text-[hsl(var(--muted-foreground))]">No dates</span>
                  </div>
                  {allNoDates.map(task => (
                    <div
                      key={task.id}
                      className="relative border-b flex items-center"
                      style={{ height: ROW_HEIGHT, width: totalWidth }}
                      onClick={() => onOpenTask(task.id)}
                    >
                      {dateColumns.map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-r border-[hsl(var(--border))]/30" style={{ left: i * cfg.colWidth, width: cfg.colWidth }} />
                      ))}
                      {/* Dashed empty bar */}
                      <div
                        className="absolute rounded"
                        style={{
                          left: todayOffset,
                          width: 80,
                          height: 28,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: '2px dashed #94A3B8',
                          cursor: 'pointer',
                        }}
                        onClick={e => { e.stopPropagation(); onOpenTask(task.id); }}
                        title={task.name}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
