import React, { useState, useRef } from 'react';
import {
  Type, Hash, ChevronDown, Tags, Circle, CalendarDays,
  User, Paperclip, Link2, CheckSquare, Plus, Trash2, Pencil, Check, X,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/useToast';

// ─── Contrast Helper ───────────────────────────────────────────────────────────

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

// ─── Person helpers ────────────────────────────────────────────────────────────

const PERSON_COLORS = ['#0066CC','#1A1A2E','#059669','#D97706','#DC2626','#0891B2','#3385D6','#EC4899'];

function getPersonColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PERSON_COLORS[Math.abs(hash) % PERSON_COLORS.length];
}

function PersonTag({ name, onRemove }) {
  const color = getPersonColor(name);
  return (
    <span className="inline-flex items-center gap-1 rounded-full pl-1 pr-1.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}>
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/30 text-[9px] font-bold uppercase">
        {name[0]}
      </span>
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-70 hover:opacity-100">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

function PersonField({ names, onChange }) {
  const [input, setInput] = useState('');

  function addName(raw) {
    const name = raw.trim();
    if (!name || names.includes(name)) return;
    const next = [...names, name];
    onChange(next.length > 0 ? next : null);
    setInput('');
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addName(input);
    } else if (e.key === 'Backspace' && !input && names.length > 0) {
      const next = names.slice(0, -1);
      onChange(next.length > 0 ? next : null);
    }
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-md border bg-[hsl(var(--background))] p-1.5 min-h-[36px] focus-within:ring-2 focus-within:ring-[#0066CC]/30">
      {names.map((name, i) => (
        <PersonTag key={i} name={name} onRemove={() => {
          const next = names.filter((_, j) => j !== i);
          onChange(next.length > 0 ? next : null);
        }} />
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) addName(input); }}
        placeholder={names.length === 0 ? 'Type name, press Enter…' : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
      />
    </div>
  );
}

// ─── Checklist helpers ─────────────────────────────────────────────────────────

function ChecklistField({ items, onChange }) {
  const [newText, setNewText] = useState('');
  const done = items.filter(i => i.checked).length;

  function toggleItem(idx) {
    const next = items.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it);
    onChange(next);
  }

  function updateText(idx, text) {
    const next = items.map((it, i) => i === idx ? { ...it, text } : it);
    onChange(next);
  }

  function removeItem(idx) {
    const next = items.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : null);
  }

  function addItem() {
    if (!newText.trim()) return;
    const next = [...items, { text: newText.trim(), checked: false }];
    onChange(next);
    setNewText('');
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{done} / {items.length} completed</p>
      )}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 group/item">
            <button
              type="button"
              onClick={() => toggleItem(idx)}
              className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                item.checked ? 'bg-[#0066CC] border-[#0066CC]' : 'border-[hsl(var(--muted-foreground))] bg-transparent'
              }`}
            >
              {item.checked && <Check className="h-2.5 w-2.5 text-white" />}
            </button>
            <input
              value={item.text}
              onChange={e => updateText(idx, e.target.value)}
              className={`flex-1 bg-transparent text-sm outline-none ${item.checked ? 'line-through text-[hsl(var(--muted-foreground))]' : ''}`}
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="opacity-0 group-hover/item:opacity-100 transition-opacity text-[hsl(var(--muted-foreground))] hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="+ Add item"
          className="flex-1 bg-transparent text-sm text-[hsl(var(--muted-foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
        />
        {newText.trim() && (
          <button type="button" onClick={addItem} className="text-[#0066CC] text-sm font-medium">Add</button>
        )}
      </div>
    </div>
  );
}

// ─── Type Registry ─────────────────────────────────────────────────────────────

export const COLUMN_TYPES = [
  { type: 'text',         label: 'Text',         Icon: Type },
  { type: 'number',       label: 'Number',        Icon: Hash },
  { type: 'select',       label: 'Select',        Icon: ChevronDown },
  { type: 'multi_select', label: 'Multi-select',  Icon: Tags },
  { type: 'status',       label: 'Status',        Icon: Circle },
  { type: 'date',         label: 'Date',          Icon: CalendarDays },
  { type: 'person',       label: 'Person',        Icon: User },
  { type: 'file',         label: 'File URL',      Icon: Paperclip },
  { type: 'url',          label: 'URL',           Icon: Link2 },
  { type: 'checkbox',     label: 'Checkbox',      Icon: CheckSquare },
];

export function ColumnTypeIcon({ type, className = 'h-3.5 w-3.5' }) {
  const def = COLUMN_TYPES.find(t => t.type === type);
  if (!def) return null;
  const { Icon } = def;
  return <Icon className={className} />;
}

// ─── Table Cell Display ────────────────────────────────────────────────────────

export function ColumnCellValue({ column, value, members = [] }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-[hsl(var(--muted-foreground))] text-xs">—</span>;
  }
  switch (column.type) {
    case 'checkbox': {
      // Handle old boolean format
      const items = Array.isArray(value) ? value : (value === true ? [{text: 'Done', checked: true}] : []);
      if (items.length === 0) return <span className="text-[hsl(var(--muted-foreground))] text-xs">—</span>;
      const done = items.filter(i => i.checked).length;
      const pct = items.length > 0 ? (done / items.length) * 100 : 0;
      return (
        <div className="flex items-center gap-1.5 min-w-[60px]">
          <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
            <div className="h-full rounded-full bg-[#0066CC] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">{done}/{items.length}</span>
        </div>
      );
    }
    case 'select':
    case 'status': {
      const opt = column.config?.options?.find(o => o.label === value);
      if (!opt) return <span className="text-sm">{value}</span>;
      return (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: opt.color, color: getContrastColor(opt.color) }}
        >
          {opt.label}
        </span>
      );
    }
    case 'multi_select': {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return <span className="text-[hsl(var(--muted-foreground))] text-xs">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map(v => {
            const opt = column.config?.options?.find(o => o.label === v);
            const bg = opt?.color || '#94a3b8';
            return (
              <span
                key={v}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: bg, color: getContrastColor(bg) }}
              >
                {v}
              </span>
            );
          })}
        </div>
      );
    }
    case 'person': {
      const names = Array.isArray(value) ? value.filter(n => typeof n === 'string') : [];
      if (names.length === 0) return <span className="text-[hsl(var(--muted-foreground))] text-xs">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {names.slice(0, 3).map((name, i) => (
            <PersonTag key={i} name={name} />
          ))}
          {names.length > 3 && <span className="text-xs text-[hsl(var(--muted-foreground))]">+{names.length - 3}</span>}
        </div>
      );
    }
    case 'url':
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0066CC] hover:underline text-xs truncate max-w-[100px] block"
          onClick={e => e.stopPropagation()}
        >
          {value}
        </a>
      );
    case 'number': {
      const fmt = column.config?.format;
      if (fmt === 'currency') return <span className="text-sm">${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
      if (fmt === 'decimal') return <span className="text-sm">{Number(value).toLocaleString()}</span>;
      return <span className="text-sm">{Math.round(Number(value))}</span>;
    }
    default:
      return <span className="text-sm truncate max-w-[100px] block">{String(value)}</span>;
  }
}

// ─── Drawer Field ──────────────────────────────────────────────────────────────

export function ColumnField({ column, value, onChange, members = [], canEdit }) {
  if (!canEdit) {
    return <div className="py-1"><ColumnCellValue column={column} value={value} members={members} /></div>;
  }
  switch (column.type) {
    case 'text':
      return (
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder={`${column.name}…`}
          className="h-8 text-sm"
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="0"
          className="h-8 text-sm"
        />
      );
    case 'url':
      return (
        <div className="space-y-1">
          <Input
            type="url"
            value={value ?? ''}
            onChange={e => onChange(e.target.value || null)}
            placeholder="https://…"
            className="h-8 text-sm"
          />
          {value && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0066CC] hover:underline flex items-center gap-1"
            >
              <Link2 className="h-3 w-3" /> Open link
            </a>
          )}
        </div>
      );
    case 'file':
      return (
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder="Paste file URL…"
          className="h-8 text-sm"
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="h-8 text-sm"
        />
      );
    case 'checkbox': {
      const items = Array.isArray(value) ? value : (value === true ? [{text: 'Done', checked: true}] : []);
      return <ChecklistField items={items} onChange={onChange} />;
    }
    case 'select':
    case 'status': {
      const options = column.config?.options || [];
      if (options.length === 0) return <p className="text-xs text-[hsl(var(--muted-foreground))]">No options — configure in column settings.</p>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(value === opt.label ? null : opt.label)}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                backgroundColor: value === opt.label ? opt.color : opt.color + '33',
                color: value === opt.label ? getContrastColor(opt.color) : opt.color,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }
    case 'multi_select': {
      const options = column.config?.options || [];
      const selected = Array.isArray(value) ? value : [];
      if (options.length === 0) return <p className="text-xs text-[hsl(var(--muted-foreground))]">No options — configure in column settings.</p>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map(opt => {
            const isSelected = selected.includes(opt.label);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? selected.filter(v => v !== opt.label)
                    : [...selected, opt.label];
                  onChange(next.length > 0 ? next : null);
                }}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                style={{
                  backgroundColor: isSelected ? opt.color : opt.color + '33',
                  color: isSelected ? getContrastColor(opt.color) : opt.color,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }
    case 'person': {
      const names = Array.isArray(value) ? value.filter(n => typeof n === 'string') : [];
      return <PersonField names={names} onChange={onChange} />;
    }
    default:
      return <Input value={value ?? ''} onChange={e => onChange(e.target.value || null)} className="h-8 text-sm" />;
  }
}

// ─── Add Column Button ─────────────────────────────────────────────────────────

export function AddColumnButton({ listId, onAdded }) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [adding, setAdding] = useState(false);

  function handleTypeSelect(type) {
    setSelectedType(type);
    setColumnName(COLUMN_TYPES.find(t => t.type === type)?.label || '');
    setPickerOpen(false);
    setNameOpen(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!columnName.trim() || !selectedType) return;
    setAdding(true);
    try {
      const res = await api.post(`/api/task-lists/${listId}/columns`, {
        name: columnName.trim(),
        type: selectedType,
        config: {},
      });
      onAdded(res.data);
      setNameOpen(false);
      setColumnName('');
      setSelectedType(null);
      toast({ title: 'Column added', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to add column', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors whitespace-nowrap"
            aria-label="Add column"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1">
          <p className="px-2 py-1.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Column Type
          </p>
          {COLUMN_TYPES.map(({ type, label, Icon }) => (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              {label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Dialog open={nameOpen} onOpenChange={v => { setNameOpen(v); if (!v) { setColumnName(''); setSelectedType(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Name Your Column</DialogTitle>
            <DialogDescription>
              {selectedType && `Type: ${COLUMN_TYPES.find(t => t.type === selectedType)?.label}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-col-name">Column Name</Label>
              <Input
                id="new-col-name"
                value={columnName}
                onChange={e => setColumnName(e.target.value)}
                placeholder="e.g. Priority, Notes…"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNameOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={adding || !columnName.trim()}>
                {adding ? 'Adding…' : 'Add Column'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Column Settings (rename + options + delete) ───────────────────────────────

export function ColumnSettingsDialog({ column, open, onOpenChange, onUpdated, onDeleted }) {
  const { toast } = useToast();
  const [name, setName] = useState(column?.name || '');
  const [options, setOptions] = useState(column?.config?.options || []);
  const [newOptLabel, setNewOptLabel] = useState('');
  const [newOptColor, setNewOptColor] = useState('#94a3b8');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  React.useEffect(() => {
    if (open && column) {
      setName(column.name);
      setOptions(column.config?.options || []);
    }
  }, [open, column]);

  const hasOptions = column && ['select', 'multi_select', 'status'].includes(column.type);

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const config = hasOptions ? { ...column.config, options } : column.config;
      const res = await api.put(`/api/columns/${column.id}`, { name: name.trim(), config });
      onUpdated(res.data);
      onOpenChange(false);
      toast({ title: 'Column updated', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to update', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/columns/${column.id}`);
      onDeleted(column.id);
      onOpenChange(false);
      setDeleteOpen(false);
      toast({ title: 'Column deleted', variant: 'success' });
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Failed to delete', variant: 'destructive' });
    }
  }

  function addOption() {
    if (!newOptLabel.trim()) return;
    if (options.some(o => o.label === newOptLabel.trim())) return;
    setOptions(prev => [...prev, { label: newOptLabel.trim(), color: newOptColor }]);
    setNewOptLabel('');
    setNewOptColor('#94a3b8');
  }

  if (!column) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Column Settings</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <ColumnTypeIcon type={column.type} />
              {COLUMN_TYPES.find(t => t.type === column.type)?.label}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="col-name-edit">Name</Label>
              <Input
                id="col-name-edit"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            {hasOptions && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={opt.color}
                        onChange={e => setOptions(prev => prev.map((o, j) => j === i ? { ...o, color: e.target.value } : o))}
                        className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0 shrink-0"
                      />
                      <input
                        className="flex-1 h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm outline-none focus:ring-2 focus:ring-[#0066CC]/30"
                        value={opt.label}
                        onChange={e => setOptions(prev => prev.map((o, j) => j === i ? { ...o, label: e.target.value } : o))}
                      />
                      <button
                        type="button"
                        onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}
                        className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newOptColor}
                    onChange={e => setNewOptColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0 shrink-0"
                  />
                  <input
                    className="flex-1 h-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm outline-none focus:ring-2 focus:ring-[#0066CC]/30"
                    value={newOptLabel}
                    onChange={e => setNewOptLabel(e.target.value)}
                    placeholder="New option…"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addOption} className="shrink-0 h-7 px-2">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-between !justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Column
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{column.name}"?</DialogTitle>
            <DialogDescription>
              This will permanently delete this column and all its values for every task. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Column</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
