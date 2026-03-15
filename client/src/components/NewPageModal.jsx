import { useState } from 'react';
import { X, FileText, LayoutTemplate, Loader2 } from 'lucide-react';
import { PAGE_TEMPLATES } from '@/data/pageTemplates';
import api from '@/lib/api';

// ─── New Page Modal ───────────────────────────────────────────────────────────
// Shows "Start blank" vs "Use template" when creating a new page.

export function NewPageModal({ open, onClose, onCreated, parentId = null, projectId = null }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'templates'
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  if (!open) return null;

  async function createBlank() {
    setCreating(true);
    try {
      const res = await api.post('/api/pages', {
        title: 'Untitled',
        parent_id: parentId,
        project_id: projectId,
      });
      onCreated(res.data);
    } catch {
      setCreating(false);
    }
  }

  async function applyTemplate(template) {
    if (creating) return;
    setCreating(true);
    setSelectedTemplate(template.id);
    try {
      // Create the page
      const pageRes = await api.post('/api/pages', {
        title: template.defaultTitle,
        icon: template.icon,
        parent_id: parentId,
        project_id: projectId,
      });
      const page = pageRes.data;

      // Create all blocks in sequence
      for (let i = 0; i < template.blocks.length; i++) {
        const b = template.blocks[i];
        await api.post(`/api/pages/${page.id}/blocks`, {
          type: b.type,
          content: b.content,
          position: i + 1,
        });
      }

      onCreated(page);
    } catch {
      setCreating(false);
      setSelectedTemplate(null);
    }
  }

  function handleClose() {
    if (creating) return;
    setStep('choose');
    setSelectedTemplate(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            {step === 'choose' ? 'Create a new page' : 'Choose a template'}
          </h2>
          <button
            onClick={handleClose}
            disabled={creating}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: Choose blank or template */}
        {step === 'choose' && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Start blank */}
              <button
                onClick={createBlank}
                disabled={creating}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-[hsl(var(--border))] p-6 text-center transition-all hover:border-[#0066CC] hover:bg-[#E6F0FF]/30 dark:hover:bg-[#0A1628]/30 group disabled:opacity-50"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(var(--muted))] group-hover:bg-[#0066CC]/10 transition-colors">
                  {creating ? (
                    <Loader2 className="h-7 w-7 animate-spin text-[#0066CC]" />
                  ) : (
                    <FileText className="h-7 w-7 text-[hsl(var(--muted-foreground))] group-hover:text-[#0066CC] transition-colors" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">Start blank</p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Start from scratch</p>
                </div>
              </button>

              {/* Use template */}
              <button
                onClick={() => setStep('templates')}
                disabled={creating}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-[hsl(var(--border))] p-6 text-center transition-all hover:border-[#0066CC] hover:bg-[#E6F0FF]/30 dark:hover:bg-[#0A1628]/30 group disabled:opacity-50"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(var(--muted))] group-hover:bg-[#0066CC]/10 transition-colors">
                  <LayoutTemplate className="h-7 w-7 text-[hsl(var(--muted-foreground))] group-hover:text-[#0066CC] transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-[hsl(var(--foreground))]">Use template</p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Start from a template</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Template picker */}
        {step === 'templates' && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3">
              {PAGE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  disabled={creating}
                  className={[
                    'flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all hover:border-[#0066CC] hover:shadow-sm disabled:opacity-50',
                    selectedTemplate === tpl.id
                      ? 'border-[#0066CC] bg-[#E6F0FF]/30 dark:bg-[#0A1628]/30'
                      : 'border-[hsl(var(--border))]',
                  ].join(' ')}
                >
                  {/* Template preview thumbnail */}
                  <div className="flex h-24 w-full items-start justify-between overflow-hidden rounded-lg bg-[hsl(var(--muted))] p-3">
                    <div className="flex-1 space-y-1.5">
                      {tpl.blocks.slice(0, 4).map((b, i) => (
                        <div key={i} className={[
                          'rounded',
                          b.type === 'heading_1' ? 'h-3 w-3/4 bg-[hsl(var(--foreground))]/20' :
                          b.type === 'heading_2' ? 'h-2.5 w-1/2 bg-[hsl(var(--foreground))]/15' :
                          b.type === 'table'     ? 'h-8 w-full bg-[hsl(var(--foreground))]/10 border border-[hsl(var(--border))]' :
                          'h-2 w-full bg-[hsl(var(--foreground))]/10',
                        ].join(' ')} />
                      ))}
                    </div>
                    <span className="ml-2 text-2xl shrink-0">{tpl.icon}</span>
                  </div>

                  {/* Template info */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      {selectedTemplate === tpl.id && creating && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066CC]" />
                      )}
                      <p className="font-semibold text-sm text-[hsl(var(--foreground))]">{tpl.name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{tpl.description}</p>
                    <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">{tpl.blocks.length} blocks</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep('choose')}
              disabled={creating}
              className="mt-4 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-50"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
