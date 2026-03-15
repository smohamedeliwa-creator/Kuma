import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, GripVertical, Trash2, FileText, Check, Link as LinkIcon,
  User, Loader2, MoreHorizontal, X, ArrowLeft, Copy, ExternalLink,
  Type, Table2, Paperclip, Tag, AlignLeft, CheckSquare, Hash,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
];

const BADGE_PRESET_COLORS = [
  { label: 'Gray',   value: '#94A3B8' },
  { label: 'Blue',   value: '#3B82F6' },
  { label: 'Green',  value: '#22C55E' },
  { label: 'Red',    value: '#EF4444' },
  { label: 'Yellow', value: '#EAB308' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Pink',   value: '#EC4899' },
  { label: 'Orange', value: '#F97316' },
];

// ─── Block type registry ──────────────────────────────────────────────────────

const BLOCK_DEFS = [
  // Text section
  { type: 'heading_1',     label: 'Heading 1',    icon: 'H1',  hint: 'Large section heading',   keywords: ['h1', 'heading', 'title'],         section: 'Text' },
  { type: 'heading_2',     label: 'Heading 2',    icon: 'H2',  hint: 'Medium section heading',  keywords: ['h2', 'heading'],                  section: 'Text' },
  { type: 'heading_3',     label: 'Heading 3',    icon: 'H3',  hint: 'Small section heading',   keywords: ['h3', 'heading'],                  section: 'Text' },
  { type: 'paragraph',     label: 'Body text',    icon: 'P',   hint: 'Plain text paragraph',    keywords: ['text', 'paragraph', 'p', 'body'], section: 'Text' },
  // Data section
  { type: 'table',         label: 'Table',        icon: '⊞',   hint: 'Editable table with rows and columns', keywords: ['table', 'grid'],    section: 'Data' },
  { type: 'file',          label: 'Attach Files', icon: '📎',  hint: 'Attach one or more files',             keywords: ['file', 'attach', 'upload'],       section: 'Data' },
  { type: 'url_link',      label: 'Add Link',     icon: '🔗',  hint: 'Clickable link with preview',          keywords: ['url', 'link', 'href'],            section: 'Data' },
  { type: 'status_badge',  label: 'Badge/Status', icon: '🔵',  hint: 'Colored status badge',                 keywords: ['status', 'badge', 'label'],       section: 'Data' },
  { type: 'multi_select',  label: 'Multi Select', icon: '▿▿',  hint: 'Multiple colored tags',               keywords: ['multi', 'select', 'tags'],         section: 'Data' },
  { type: 'person_tag',    label: 'Person',       icon: '👤',  hint: 'Person name tags',                     keywords: ['person', 'user', 'people', 'name'], section: 'Data' },
  { type: 'todo_checkbox', label: 'Checkbox',     icon: '☐',   hint: 'Checkbox list with progress',          keywords: ['todo', 'checkbox', 'check', 'task'], section: 'Data' },
];

function defaultContent(type) {
  switch (type) {
    case 'table':         return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };
    case 'file':          return { files: [] };
    case 'url_link':      return { url: '', label: '' };
    case 'status_badge':  return { label: 'Todo', color: '#94A3B8' };
    case 'multi_select':  return { tags: [] };
    case 'person_tag':    return { names: [] };
    case 'todo_checkbox': return { items: [{ text: '', checked: false }] };
    default:              return { text: '' };
  }
}

// ─── Save indicator ───────────────────────────────────────────────────────────

function SaveIndicator({ status }) {
  if (status === 'saved')  return <span className="text-xs text-green-500">Saved</span>;
  if (status === 'saving') return <span className="text-xs text-[hsl(var(--muted-foreground))]">Saving…</span>;
  return null;
}

// ─── Slash Command Menu ───────────────────────────────────────────────────────

function SlashMenu({ query, onSelect, onClose, anchorRect }) {
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return BLOCK_DEFS.filter(d =>
      !q || d.label.toLowerCase().includes(q) || d.keywords.some(k => k.includes(q))
    );
  }, [query]);

  const sections = useMemo(() => {
    const map = {};
    filtered.forEach(d => {
      if (!map[d.section]) map[d.section] = [];
      map[d.section].push(d);
    });
    return map;
  }, [filtered]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); if (filtered[active]) onSelect(filtered[active].type); }
      if (e.key === 'Escape')    { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [filtered, active, onSelect, onClose]);

  if (filtered.length === 0) return null;

  const style = anchorRect ? {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: Math.min(anchorRect.left, window.innerWidth - 280),
    zIndex: 1000,
  } : { position: 'fixed', top: 100, left: 100, zIndex: 1000 };

  let globalIdx = 0;

  return (
    <div
      style={style}
      className="w-72 rounded-xl border bg-[hsl(var(--card))] shadow-xl overflow-hidden py-1"
    >
      <div className="max-h-80 overflow-y-auto">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {section}
            </p>
            {items.map(d => {
              const idx = globalIdx++;
              return (
                <button
                  key={d.type}
                  onMouseDown={e => { e.preventDefault(); onSelect(d.type); }}
                  className={[
                    'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
                    idx === active ? 'bg-[hsl(var(--muted))]' : 'hover:bg-[hsl(var(--muted))]',
                  ].join(' ')}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-sm shrink-0 font-mono">
                    {d.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{d.label}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{d.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Text Block ───────────────────────────────────────────────────────────────

function TextBlock({ block, onChange, onKeyDown, onFocus, placeholder, className }) {
  const ref = useRef(null);
  const isComposing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const newText = block.content.text || '';
    if (el.innerText !== newText) {
      el.innerText = newText;
      const sel = window.getSelection();
      const range = document.createRange();
      if (el.childNodes.length > 0) {
        const last = el.childNodes[el.childNodes.length - 1];
        range.setStartAfter(last);
      } else {
        range.setStart(el, 0);
      }
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [block.id]);

  function handleInput() {
    if (isComposing.current) return;
    onChange({ text: ref.current?.innerText || '' });
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={() => { isComposing.current = false; handleInput(); }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      data-placeholder={placeholder}
      className={[
        'outline-none w-full break-words',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-[hsl(var(--muted-foreground))]',
        className,
      ].join(' ')}
      spellCheck
    />
  );
}

// ─── Checkbox block (multi-item) ──────────────────────────────────────────────

function CheckboxBlock({ block, onChange, canEdit }) {
  const items = block.content.items || [{ text: '', checked: false }];
  const completed = items.filter(i => i.checked).length;

  function toggleItem(idx) {
    if (!canEdit) return;
    const next = items.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it);
    onChange({ items: next });
  }

  function updateText(idx, text) {
    const next = items.map((it, i) => i === idx ? { ...it, text } : it);
    onChange({ items: next });
  }

  function addItem() {
    onChange({ items: [...items, { text: '', checked: false }] });
  }

  function removeItem(idx) {
    if (items.length <= 1) return;
    onChange({ items: items.filter((_, i) => i !== idx) });
  }

  function handleItemKeyDown(e, idx) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
    if (e.key === 'Backspace' && !items[idx].text && items.length > 1) {
      e.preventDefault();
      removeItem(idx);
    }
  }

  return (
    <div className="space-y-1">
      {items.length > 1 && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
          {completed} / {items.length} completed
        </p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 group/item">
          <button
            type="button"
            onClick={() => toggleItem(idx)}
            className={[
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
              item.checked
                ? 'border-[#0066CC] bg-[#0066CC]'
                : 'border-[hsl(var(--muted-foreground))]',
            ].join(' ')}
          >
            {item.checked && <Check className="h-2.5 w-2.5 text-white" />}
          </button>
          <input
            value={item.text}
            onChange={e => updateText(idx, e.target.value)}
            onKeyDown={e => handleItemKeyDown(e, idx)}
            disabled={!canEdit}
            placeholder="To-do item…"
            className={[
              'flex-1 text-sm outline-none bg-transparent',
              item.checked ? 'line-through text-[hsl(var(--muted-foreground))]' : '',
            ].join(' ')}
          />
          {canEdit && items.length > 1 && (
            <button
              onClick={() => removeItem(idx)}
              className="opacity-0 group-hover/item:opacity-100 text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mt-1 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add item
        </button>
      )}
    </div>
  );
}

// ─── File block (multi-file) ──────────────────────────────────────────────────

function FileBlock({ block, onChange, pageId, canEdit }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();
  const files = block.content.files || [];

  function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function getFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '🎵';
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return '🎬';
    if (['pdf'].includes(ext)) return '📄';
    if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return '🗜';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    return '📎';
  }

  async function handleFiles(e) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    const newFiles = [...files];
    for (const file of selected) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await api.post(`/api/pages/${pageId}/blocks/upload`, form);
        newFiles.push({ url: res.data.url, name: res.data.name, size: res.data.size });
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: 'destructive' });
      }
    }
    onChange({ files: newFiles });
    setUploading(false);
    e.target.value = '';
  }

  function removeFile(idx) {
    onChange({ files: files.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5 hover:bg-[hsl(var(--muted))]/30 transition-colors group/file">
          <span className="text-xl shrink-0">{getFileIcon(f.name)}</span>
          <a
            href={f.url}
            download={f.name}
            className="flex-1 min-w-0"
          >
            <p className="text-sm font-medium truncate hover:text-[#0066CC] transition-colors">{f.name}</p>
            {f.size > 0 && <p className="text-xs text-[hsl(var(--muted-foreground))]">{fmtSize(f.size)}</p>}
          </a>
          {canEdit && (
            <button
              onClick={() => removeFile(i)}
              className="opacity-0 group-hover/file:opacity-100 text-[hsl(var(--muted-foreground))] hover:text-red-500 shrink-0 transition-all"
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-3 rounded-lg border-2 border-dashed border-[hsl(var(--border))] px-4 py-3 w-full text-left hover:border-[#0066CC] transition-colors"
          disabled={uploading}
        >
          {uploading
            ? <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            : <Paperclip className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          }
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {uploading ? 'Uploading…' : files.length > 0 ? 'Attach another file' : 'Click to attach files'}
          </span>
          <input ref={inputRef} type="file" multiple className="sr-only" onChange={handleFiles} />
        </button>
      )}
    </div>
  );
}

// ─── Table block (with right-click context menus) ─────────────────────────────

function TableBlock({ block, onChange, canEdit }) {
  const { headers = ['Column 1'], rows = [['']] } = block.content;
  const [colWidths, setColWidths] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null); // { type: 'col'|'row', index, x, y }
  const [editingHeader, setEditingHeader] = useState(null); // column index being renamed
  const resizingRef = useRef(null);

  function updateHeader(i, val) {
    const h = [...headers]; h[i] = val;
    onChange({ ...block.content, headers: h });
  }
  function updateCell(r, c, val) {
    const newRows = rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => ci === c ? val : cell) : [...row]
    );
    onChange({ ...block.content, rows: newRows });
  }
  function addCol() {
    const h = [...headers, `Column ${headers.length + 1}`];
    const r = rows.map(row => [...row, '']);
    onChange({ ...block.content, headers: h, rows: r });
  }
  function addRow() {
    onChange({ ...block.content, rows: [...rows, headers.map(() => '')] });
  }
  function deleteRow(i) {
    if (rows.length <= 1) return;
    onChange({ ...block.content, rows: rows.filter((_, ri) => ri !== i) });
  }
  function deleteCol(i) {
    if (headers.length <= 1) return;
    onChange({
      ...block.content,
      headers: headers.filter((_, hi) => hi !== i),
      rows: rows.map(r => r.filter((_, ci) => ci !== i)),
    });
  }
  function renameCol(i) {
    setCtxMenu(null);
    setEditingHeader(i);
  }

  // Column resize drag
  function startResize(e, colIdx) {
    if (!canEdit) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[colIdx] || 120;
    resizingRef.current = { colIdx, startX, startW };

    function onMove(ev) {
      const delta = ev.clientX - startX;
      setColWidths(prev => ({ ...prev, [colIdx]: Math.max(60, startW + delta) }));
    }
    function onUp() {
      resizingRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleHeaderRightClick(e, i) {
    if (!canEdit) return;
    e.preventDefault();
    setCtxMenu({ type: 'col', index: i, x: e.clientX, y: e.clientY });
  }
  function handleRowRightClick(e, i) {
    if (!canEdit) return;
    e.preventDefault();
    setCtxMenu({ type: 'row', index: i, x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    if (!ctxMenu) return;
    function handleClick() { setCtxMenu(null); }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [ctxMenu]);

  return (
    <div className="overflow-x-auto relative">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-left font-semibold relative group/col select-none"
                style={{ width: colWidths[i] ? `${colWidths[i]}px` : undefined, minWidth: 80 }}
                onContextMenu={e => handleHeaderRightClick(e, i)}
              >
                {editingHeader === i ? (
                  <input
                    autoFocus
                    value={h}
                    onChange={e => updateHeader(i, e.target.value)}
                    onBlur={() => setEditingHeader(null)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingHeader(null); }}
                    className="bg-transparent outline-none w-full font-semibold"
                  />
                ) : (
                  <span className="block truncate">{h}</span>
                )}
                {/* Resize handle */}
                {canEdit && (
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#0066CC]/40 transition-colors"
                    onMouseDown={e => startResize(e, i)}
                  />
                )}
              </th>
            ))}
            {canEdit && (
              <th className="border border-[hsl(var(--border))] px-2 py-1 bg-[hsl(var(--muted))]">
                <button
                  onClick={addCol}
                  className="flex items-center gap-0.5 text-[#0066CC] hover:underline text-xs whitespace-nowrap"
                >
                  <Plus className="h-3 w-3" /> Col
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="group/row hover:bg-[hsl(var(--muted))]/30 transition-colors"
              onContextMenu={e => handleRowRightClick(e, ri)}
            >
              {headers.map((_, ci) => (
                <td
                  key={ci}
                  className="border border-[hsl(var(--border))] px-3 py-1.5"
                  style={{ width: colWidths[ci] ? `${colWidths[ci]}px` : undefined }}
                >
                  <input
                    value={row[ci] || ''}
                    onChange={e => updateCell(ri, ci, e.target.value)}
                    disabled={!canEdit}
                    className="bg-transparent outline-none w-full text-sm"
                    onKeyDown={e => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const inputs = document.querySelectorAll('table input:not([disabled])');
                        const idx = Array.from(inputs).indexOf(e.target);
                        if (idx + 1 < inputs.length) inputs[idx + 1].focus();
                      }
                    }}
                  />
                </td>
              ))}
              {canEdit && <td className="border border-[hsl(var(--border))] w-6" />}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <button
          onClick={addRow}
          className="mt-1 flex items-center gap-1 text-xs text-[#0066CC] hover:underline"
        >
          <Plus className="h-3 w-3" /> Add row
        </button>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 1000 }}
          className="w-44 rounded-lg border bg-[hsl(var(--card))] shadow-xl py-1"
          onClick={e => e.stopPropagation()}
        >
          {ctxMenu.type === 'col' && (
            <>
              <button
                onClick={() => { renameCol(ctxMenu.index); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
              >
                Rename column
              </button>
              {headers.length > 1 && (
                <button
                  onClick={() => { deleteCol(ctxMenu.index); setCtxMenu(null); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  Delete column
                </button>
              )}
            </>
          )}
          {ctxMenu.type === 'row' && rows.length > 1 && (
            <button
              onClick={() => { deleteRow(ctxMenu.index); setCtxMenu(null); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              Delete row
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── URL link block ───────────────────────────────────────────────────────────

function UrlBlock({ block, onChange, canEdit }) {
  const [editing, setEditing] = useState(!block.content.url);

  if (!editing && block.content.url) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-4 py-3 hover:bg-[hsl(var(--muted))]/30 transition-colors group/link">
        <LinkIcon className="h-4 w-4 text-[#0066CC] shrink-0" />
        <div className="min-w-0 flex-1">
          <a
            href={block.content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#0066CC] hover:underline truncate block"
          >
            {block.content.label || block.content.url}
          </a>
          {block.content.label && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{block.content.url}</p>
          )}
        </div>
        <ExternalLink className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/link:opacity-100 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all"
          >
            Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[hsl(var(--border))] p-3">
      <input
        type="url"
        value={block.content.url || ''}
        onChange={e => onChange({ ...block.content, url: e.target.value })}
        placeholder="https://example.com"
        autoFocus
        onBlur={() => block.content.url && setEditing(false)}
        className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0066CC]/30"
      />
      <input
        value={block.content.label || ''}
        onChange={e => onChange({ ...block.content, label: e.target.value })}
        placeholder="Display text (optional)"
        className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#0066CC]/30"
        onKeyDown={e => { if (e.key === 'Enter' && block.content.url) setEditing(false); }}
      />
      {block.content.url && (
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-[#0066CC] hover:underline"
        >
          Save link
        </button>
      )}
    </div>
  );
}

// ─── Status badge block ───────────────────────────────────────────────────────

function StatusBadgeBlock({ block, onChange, canEdit }) {
  const [editing, setEditing] = useState(false);
  const { label = 'Todo', color = '#94A3B8' } = block.content;

  if (!canEdit) {
    return (
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white cursor-pointer hover:opacity-80 transition-opacity"
        style={{ backgroundColor: color }}
        onClick={() => setEditing(v => !v)}
      >
        {label}
      </span>
      {editing && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg flex-wrap">
          <input
            value={label}
            onChange={e => onChange({ ...block.content, label: e.target.value })}
            placeholder="Status label"
            className="w-28 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#0066CC]/30"
            autoFocus
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            {BADGE_PRESET_COLORS.map(p => (
              <button
                key={p.value}
                onClick={() => onChange({ ...block.content, color: p.value })}
                title={p.label}
                className={[
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                  color === p.value ? 'border-[hsl(var(--foreground))] scale-110' : 'border-transparent',
                ].join(' ')}
                style={{ backgroundColor: p.value }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => onChange({ ...block.content, color: e.target.value })}
              className="h-6 w-6 rounded cursor-pointer border border-[hsl(var(--border))]"
              title="Custom color"
            />
          </div>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Multi-select block ───────────────────────────────────────────────────────

function MultiSelectBlock({ block, onChange, canEdit }) {
  const [newTag, setNewTag] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const tags = block.content.tags || [];

  function getNextColor() {
    return TAG_COLORS[tags.length % TAG_COLORS.length];
  }

  function addTag() {
    const t = newTag.trim();
    if (!t) return;
    onChange({ tags: [...tags, { label: t, color: getNextColor() }] });
    setNewTag('');
  }

  function removeTag(idx) {
    onChange({ tags: tags.filter((_, i) => i !== idx) });
  }

  function updateTagLabel(idx, label) {
    onChange({ tags: tags.map((t, i) => i === idx ? { ...t, label } : t) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white group/tag"
          style={{ backgroundColor: tag.color }}
        >
          {editingIdx === i ? (
            <input
              autoFocus
              value={tag.label}
              onChange={e => updateTagLabel(i, e.target.value)}
              onBlur={() => setEditingIdx(null)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingIdx(null); }}
              className="bg-transparent outline-none w-16 text-white placeholder:text-white/70"
            />
          ) : (
            <span
              className="cursor-pointer"
              onClick={() => canEdit && setEditingIdx(i)}
            >
              {tag.label}
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => removeTag(i)}
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <div className="flex items-center gap-1">
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="+ Add option"
            className="text-xs outline-none bg-transparent border-b border-dashed border-[hsl(var(--muted-foreground))] min-w-[80px] py-0.5"
          />
        </div>
      )}
    </div>
  );
}

// ─── Person tag block ─────────────────────────────────────────────────────────

const PERSON_COLORS = ['#EF4444', '#F97316', '#3B82F6', '#22C55E', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308'];

function getPersonColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PERSON_COLORS[Math.abs(hash) % PERSON_COLORS.length];
}

function PersonTagBlock({ block, onChange, canEdit }) {
  const [input, setInput] = useState('');
  const names = block.content.names || [];

  function add() {
    const n = input.trim();
    if (!n) return;
    onChange({ names: [...names, n] });
    setInput('');
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {names.map((n, i) => {
        const color = getPersonColor(n);
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: color }}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              {n.charAt(0).toUpperCase()}
            </span>
            {n}
            {canEdit && (
              <button
                onClick={() => onChange({ names: names.filter((_, j) => j !== i) })}
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        );
      })}
      {canEdit && (
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
          }}
          placeholder="Type a name…"
          className="text-xs outline-none bg-transparent border-b border-dashed border-[hsl(var(--muted-foreground))] min-w-[100px] py-0.5"
        />
      )}
    </div>
  );
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function renderBlock({ block, onChange, onKeyDown, onFocus, canEdit, pageId }) {
  switch (block.type) {
    case 'heading_1':
      return <TextBlock block={block} onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus} placeholder="Heading 1" className="text-3xl font-bold" />;
    case 'heading_2':
      return <TextBlock block={block} onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus} placeholder="Heading 2" className="text-2xl font-bold" />;
    case 'heading_3':
      return <TextBlock block={block} onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus} placeholder="Heading 3" className="text-xl font-semibold" />;
    case 'paragraph':
      return <TextBlock block={block} onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus} placeholder="Type '/' for commands…" className="text-sm leading-relaxed" />;
    case 'todo_checkbox':
      return <CheckboxBlock block={block} onChange={onChange} canEdit={canEdit} />;
    case 'file':
      return <FileBlock block={block} onChange={onChange} pageId={pageId} canEdit={canEdit} />;
    case 'table':
      return <TableBlock block={block} onChange={onChange} canEdit={canEdit} />;
    case 'url_link':
      return <UrlBlock block={block} onChange={onChange} canEdit={canEdit} />;
    case 'status_badge':
      return <StatusBadgeBlock block={block} onChange={onChange} canEdit={canEdit} />;
    case 'multi_select':
      return <MultiSelectBlock block={block} onChange={onChange} canEdit={canEdit} />;
    case 'person_tag':
      return <PersonTagBlock block={block} onChange={onChange} canEdit={canEdit} />;
    default:
      return <TextBlock block={block} onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus} placeholder="…" className="text-sm leading-relaxed" />;
  }
}

// ─── Sortable block wrapper ───────────────────────────────────────────────────

function SortableBlock({
  block, canEdit, pageId,
  onContentChange, onKeyDown, onFocus, onDelete, onAddBelow,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [hovered, setHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const blockTopMargin = block.type === 'heading_1' ? 'mt-6'
    : block.type === 'heading_2' ? 'mt-5'
    : block.type === 'heading_3' ? 'mt-4'
    : 'mt-1';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/block relative flex items-start gap-1 ${blockTopMargin}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left controls */}
      <div
        className={`flex shrink-0 flex-col items-center gap-0.5 pt-0.5 transition-opacity ${hovered && canEdit ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: 40 }}
      >
        <button
          onClick={onAddBelow}
          className="flex h-5 w-5 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          title="Add block below"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          {...attributes}
          {...listeners}
          className="flex h-5 w-5 cursor-grab items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          title="Drag to reorder"
          aria-label="Drag to reorder block"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Block content */}
      <div className="flex-1 min-w-0">
        {renderBlock({ block, onChange: onContentChange, onKeyDown, onFocus, canEdit, pageId })}
      </div>

      {/* Delete */}
      {hovered && canEdit && (
        <button
          onClick={onDelete}
          className="ml-1 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover/block:opacity-100"
          title="Delete block"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ page, onUpdate, canEdit }) {
  const [title, setTitle] = useState(page.title || 'Untitled');
  const saveTimer = useRef(null);

  useEffect(() => { setTitle(page.title || 'Untitled'); }, [page.id]);

  function scheduleTitle(val) {
    setTitle(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate({ title: val }), 800);
  }

  function handleIconClick() {
    if (!canEdit) return;
    const icon = window.prompt('Enter emoji icon:', page.icon || '📄');
    if (icon !== null) onUpdate({ icon: icon.trim().slice(0, 2) || '📄' });
  }

  return (
    <div className="mb-8">
      {page.cover_url && (
        <div className="relative -mx-6 mb-6 h-48 md:h-64 overflow-hidden" style={{ marginTop: -24 }}>
          <img src={page.cover_url} alt="Cover" className="w-full h-full object-cover" width={1200} height={300} />
        </div>
      )}
      <div className="flex items-end gap-4 mb-3">
        <button
          onClick={handleIconClick}
          className="text-5xl leading-none hover:scale-110 transition-transform shrink-0"
          aria-label="Page icon"
        >
          {page.icon || '📄'}
        </button>
        {canEdit && !page.cover_url && (
          <label className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded px-2 py-1 cursor-pointer transition-colors">
            Add cover
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const form = new FormData(); form.append('file', file);
              try { const res = await api.post(`/api/pages/${page.id}/blocks/upload`, form); onUpdate({ cover_url: res.data.url }); } catch {}
              e.target.value = '';
            }} />
          </label>
        )}
      </div>
      <input
        value={title}
        onChange={e => scheduleTitle(e.target.value)}
        placeholder="Untitled"
        disabled={!canEdit}
        className="w-full bg-transparent text-[36px] font-bold leading-tight outline-none border-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] disabled:cursor-default"
      />
    </div>
  );
}

// ─── Page menu ────────────────────────────────────────────────────────────────

function Pencil({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function PageMenu({ page, canEdit, onUpdate, onDelete, onDuplicate, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border bg-[hsl(var(--card))] shadow-xl py-1">
        {canEdit && (
          <button
            onClick={() => {
              const t = window.prompt('Rename page:', page.title);
              if (t?.trim()) onUpdate({ title: t.trim() });
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
        )}
        <button
          onClick={() => { onDuplicate(); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        {canEdit && (
          <>
            <div className="my-1 border-t border-[hsl(var(--border))]" />
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete page
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── Main PageEditor ──────────────────────────────────────────────────────────

export function PageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slashState, setSlashState] = useState(null);

  const saveTimers = useRef({});
  const blockRefs = useRef({});
  const pendingContent = useRef({});

  const canEdit = page ? (isAdmin || page.created_by === user?.id) : false;

  // Load page
  useEffect(() => {
    setLoading(true);
    api.get(`/api/pages/${id}`)
      .then(res => {
        setPage(res.data);
        setBlocks(res.data.blocks.map(b => ({
          ...b,
          content: typeof b.content === 'string' ? JSON.parse(b.content) : b.content,
        })));
      })
      .catch(() => { toast({ title: 'Page not found', variant: 'destructive' }); navigate('/dashboard'); })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  // Auto-save block content (800ms debounce)
  function scheduleSave(blockId, content) {
    pendingContent.current[blockId] = content;
    clearTimeout(saveTimers.current[blockId]);
    setSaveStatus('saving');
    saveTimers.current[blockId] = setTimeout(async () => {
      const c = pendingContent.current[blockId];
      if (c === undefined) return;
      try {
        await api.put(`/api/pages/${id}/blocks/${blockId}`, { content: c });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch { setSaveStatus(null); }
    }, 800);
  }

  function handleContentChange(blockId, content) {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    scheduleSave(blockId, content);
  }

  // Update page meta
  const pageUpdateTimer = useRef(null);
  function handlePageUpdate(fields) {
    setPage(prev => ({ ...prev, ...fields }));
    clearTimeout(pageUpdateTimer.current);
    setSaveStatus('saving');
    pageUpdateTimer.current = setTimeout(async () => {
      try {
        await api.put(`/api/pages/${id}`, fields);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch { setSaveStatus(null); }
    }, 800);
  }

  // Create block
  async function createBlock(type = 'paragraph', afterBlockId = null) {
    const content = defaultContent(type);
    let position;
    if (afterBlockId) {
      const idx = blocks.findIndex(b => b.id === afterBlockId);
      const after = blocks[idx];
      const before = blocks[idx + 1];
      position = before ? (after.position + before.position) / 2 : after.position + 1;
    } else {
      position = blocks.length > 0 ? blocks[blocks.length - 1].position + 1 : 1;
    }
    try {
      const res = await api.post(`/api/pages/${id}/blocks`, { type, content, position });
      const newBlock = { ...res.data, content: typeof res.data.content === 'string' ? JSON.parse(res.data.content) : res.data.content };
      setBlocks(prev => {
        if (!afterBlockId) return [...prev, newBlock];
        const idx = prev.findIndex(b => b.id === afterBlockId);
        const next = [...prev];
        next.splice(idx + 1, 0, newBlock);
        return next;
      });
      setTimeout(() => blockRefs.current[newBlock.id]?.focus(), 50);
      return newBlock;
    } catch {
      toast({ title: 'Failed to add block', variant: 'destructive' });
      return null;
    }
  }

  // Delete block
  async function deleteBlock(blockId) {
    const idx = blocks.findIndex(b => b.id === blockId);
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    try {
      await api.delete(`/api/pages/${id}/blocks/${blockId}`);
      const prevBlock = blocks[idx - 1];
      if (prevBlock) setTimeout(() => blockRefs.current[prevBlock.id]?.focus(), 30);
    } catch {
      toast({ title: 'Failed to delete block', variant: 'destructive' });
    }
  }

  // Keyboard handler
  function handleBlockKeyDown(e, block) {
    const text = block.content?.text || '';

    if (e.key === '/' && !slashState && !text) {
      e.preventDefault();
      const sel = window.getSelection();
      const range = sel?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      setSlashState({ blockId: block.id, query: '', anchorRect: rect });
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && block.type === 'paragraph') {
      e.preventDefault();
      setSlashState(null);
      createBlock('paragraph', block.id);
    }

    if (e.key === 'Backspace' && !text && !slashState) {
      if (blocks.length > 1) {
        e.preventDefault();
        deleteBlock(block.id);
      }
    }

    if (e.key === 'Escape' && slashState) {
      setSlashState(null);
    }
  }

  function handleBlockContentChange(blockId, content) {
    const text = content.text || '';
    const slashIdx = text.lastIndexOf('/');
    if (slashIdx >= 0) {
      const query = text.slice(slashIdx + 1);
      if (!query.includes(' ') && query.length <= 30) {
        const sel = window.getSelection();
        const range = sel?.rangeCount > 0 ? sel.getRangeAt(0) : null;
        const rect = range?.getBoundingClientRect();
        setSlashState({ blockId, query, anchorRect: rect, slashIdx });
        handleContentChange(blockId, content);
        return;
      }
    }
    if (slashState?.blockId === blockId && !text.includes('/')) {
      setSlashState(null);
    }
    handleContentChange(blockId, content);
  }

  async function insertBlockFromSlash(type) {
    if (!slashState) return;
    const { blockId, slashIdx } = slashState;

    const block = blocks.find(b => b.id === blockId);
    if (block?.content?.text !== undefined && slashIdx !== undefined) {
      const newText = (block.content.text || '').slice(0, slashIdx);
      handleContentChange(blockId, { ...block.content, text: newText });
    }

    setSlashState(null);

    const currentBlock = blocks.find(b => b.id === blockId);
    if (currentBlock && currentBlock.type === 'paragraph' && !(currentBlock.content?.text || '').trim()) {
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, type, content: defaultContent(type) } : b));
      try {
        await api.put(`/api/pages/${id}/blocks/${blockId}`, { type, content: defaultContent(type) });
      } catch {
        toast({ title: 'Failed to change block type', variant: 'destructive' });
      }
    } else {
      await createBlock(type, blockId);
    }
  }

  // Drag and drop
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);
    const reordered = arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({ ...b, position: i + 1 }));
    setBlocks(reordered);
    try {
      await api.put(`/api/pages/${id}/blocks/reorder`, {
        blocks: reordered.map(b => ({ id: b.id, position: b.position })),
      });
    } catch {
      toast({ title: 'Failed to reorder', variant: 'destructive' });
    }
  }

  // Delete page
  async function handleDeletePage() {
    if (!window.confirm('Delete this page? This cannot be undone.')) return;
    try {
      await api.delete(`/api/pages/${id}`);
      toast({ title: 'Page deleted' });
      navigate('/dashboard');
    } catch {
      toast({ title: 'Failed to delete page', variant: 'destructive' });
    }
  }

  // Duplicate page
  async function handleDuplicatePage() {
    try {
      const res = await api.post(`/api/pages/${id}/duplicate`);
      toast({ title: 'Page duplicated' });
      navigate(`/pages/${res.data.id}`);
    } catch {
      toast({ title: 'Failed to duplicate', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        <div className="h-10 w-64 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
        <div className="h-12 w-96 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
        <div className="h-4 w-full rounded bg-[hsl(var(--muted))] animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-[hsl(var(--muted))] animate-pulse" />
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pb-24" onClick={() => setSlashState(null)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between py-3 mb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <SaveIndicator status={saveStatus} />
          <span className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:inline">
            Edited {new Date(page.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <PageMenu
                page={page}
                canEdit={canEdit}
                onUpdate={handlePageUpdate}
                onDelete={handleDeletePage}
                onDuplicate={handleDuplicatePage}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Page header */}
      <PageHeader page={page} onUpdate={handlePageUpdate} canEdit={canEdit} />

      {/* Blocks */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {blocks.map(block => (
              <SortableBlock
                key={block.id}
                block={block}
                canEdit={canEdit}
                pageId={id}
                focusedId={focusedBlockId}
                onFocus={() => setFocusedBlockId(block.id)}
                onContentChange={content => handleBlockContentChange(block.id, content)}
                onKeyDown={e => handleBlockKeyDown(e, block)}
                onDelete={() => deleteBlock(block.id)}
                onAddBelow={() => createBlock('paragraph', block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add block button */}
      {canEdit && (
        <button
          onClick={e => { e.stopPropagation(); createBlock('paragraph'); }}
          className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors w-full"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Click to add a block
        </button>
      )}

      {canEdit && blocks.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Start typing, or press "/" to choose a block type</p>
        </div>
      )}

      {/* Slash menu */}
      {slashState && (
        <div onClick={e => e.stopPropagation()}>
          <SlashMenu
            query={slashState.query}
            anchorRect={slashState.anchorRect}
            onSelect={insertBlockFromSlash}
            onClose={() => setSlashState(null)}
          />
        </div>
      )}
    </div>
  );
}
