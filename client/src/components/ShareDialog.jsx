import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Mail, Trash2, Link2 } from 'lucide-react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';

// WhatsApp, Telegram, X (Twitter), Slack (copy), share builders
const SOCIAL = [
  {
    label: 'WhatsApp',
    bg: 'bg-[#25D366]',
    icon: '💬',
    action: (url) => window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank'),
  },
  {
    label: 'Telegram',
    bg: 'bg-[#0088cc]',
    icon: '✈️',
    action: (url) => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}`, '_blank'),
  },
  {
    label: 'X',
    bg: 'bg-black',
    icon: '𝕏',
    action: (url) => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`, '_blank'),
  },
];

function ExpiryLabel({ expiresAt }) {
  if (!expiresAt) return <span className="text-xs text-[hsl(var(--muted-foreground))]">Never</span>;
  const d = new Date(expiresAt);
  const expired = d < new Date();
  return (
    <span className={`text-xs ${expired ? 'text-red-500' : 'text-[hsl(var(--muted-foreground))]'}`}>
      {expired ? 'Expired ' : 'Expires '}{d.toLocaleDateString()}
    </span>
  );
}

export function ShareDialog({ open, onClose, type, referenceId, isAdmin }) {
  const { toast } = useToast();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [updating, setUpdating] = useState(false);

  const shareUrl = shareData ? `${window.location.origin}/share/${shareData.token}` : '';

  const fetchLink = useCallback(async () => {
    if (!open || !type || !referenceId) return;
    setLoading(true);
    setShareData(null);
    try {
      const res = await api.post('/api/share', { type, referenceId });
      setShareData(res.data.data);
    } catch {
      toast({ title: 'Failed to generate share link', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [open, type, referenceId]);

  useEffect(() => { fetchLink(); }, [fetchLink]);

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleEmail() {
    const subject = encodeURIComponent('Check this out on Kuma');
    const body = encodeURIComponent(`Here's a read-only link:\n\n${shareUrl}`);
    window.open(`mailto:${emailInput}?subject=${subject}&body=${body}`);
  }

  function handleSlack() {
    navigator.clipboard.writeText(`Check this out on Kuma: ${shareUrl}`);
    toast({ title: 'Copied for Slack', description: 'Paste it into your Slack message.' });
  }

  async function toggleEnabled() {
    if (!shareData) return;
    setUpdating(true);
    try {
      const res = await api.put(`/api/share/${shareData.token}`, { enabled: shareData.enabled ? 0 : 1 });
      setShareData(res.data.data);
    } catch {
      toast({ title: 'Failed to update settings', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  }

  async function setExpiry(days) {
    if (!shareData) return;
    setUpdating(true);
    try {
      const expires_at = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
      const res = await api.put(`/api/share/${shareData.token}`, { expires_at });
      setShareData(res.data.data);
    } catch {
      toast({ title: 'Failed to update expiry', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  }

  async function revokeLink() {
    if (!shareData) return;
    try {
      await api.delete(`/api/share/${shareData.token}`);
      toast({ title: 'Link revoked' });
      setShareData(null);
      onClose();
    } catch {
      toast({ title: 'Failed to revoke link', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Share
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-[var(--brand-primary)] border-t-transparent" />
          </div>
        ) : !shareData ? (
          <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Could not generate link.{' '}
            <button className="text-[var(--brand-primary)] underline" onClick={fetchLink}>Try again</button>
          </div>
        ) : (
          <div className="space-y-5 pt-1">

            {/* Copy Link */}
            <div>
              <label className="block text-sm font-medium mb-2">Public link</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 min-w-0 rounded-md border bg-[hsl(var(--muted))] px-3 h-9 text-xs text-[hsl(var(--muted-foreground))] focus:outline-none"
                />
                <Button size="sm" onClick={copyLink} className="shrink-0 gap-1.5 w-[90px]">
                  {copied
                    ? <><Check className="h-3.5 w-3.5" /> Copied!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                </Button>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="share-email">
                Share via Email
              </label>
              <div className="flex gap-2">
                <input
                  id="share-email"
                  type="email"
                  placeholder="email@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="flex-1 rounded-md border bg-[hsl(var(--background))] px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
                <Button size="sm" variant="outline" onClick={handleEmail} disabled={!emailInput}>
                  <Mail className="h-3.5 w-3.5 mr-1" /> Send
                </Button>
              </div>
            </div>

            {/* Social */}
            <div>
              <p className="text-sm font-medium mb-2">Share on</p>
              <div className="flex flex-wrap gap-2">
                {SOCIAL.map(s => (
                  <button
                    key={s.label}
                    onClick={() => s.action(shareUrl)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 ${s.bg}`}
                  >
                    <span aria-hidden="true">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
                <button
                  onClick={handleSlack}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white bg-[#4A154B] hover:opacity-90 transition-opacity"
                >
                  <span aria-hidden="true">#</span> Slack
                </button>
              </div>
            </div>

            {/* Admin Settings */}
            {isAdmin && (
              <div className="rounded-lg border p-4 space-y-4">
                <h4 className="text-sm font-semibold">Link Settings</h4>

                {/* Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">Anyone with link can view</span>
                  <button
                    onClick={toggleEnabled}
                    disabled={updating}
                    aria-checked={!!shareData.enabled}
                    role="switch"
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      shareData.enabled ? 'bg-[var(--brand-primary)]' : 'bg-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      shareData.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Expiry */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">Expiry</span>
                    <ExpiryLabel expiresAt={shareData.expires_at} />
                  </div>
                  <div className="flex gap-2">
                    {[
                      { label: 'Never', days: null },
                      { label: '7 days', days: 7 },
                      { label: '30 days', days: 30 },
                    ].map(({ label, days }) => (
                      <button
                        key={label}
                        onClick={() => setExpiry(days)}
                        disabled={updating}
                        className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-[hsl(var(--muted))] transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Revoke */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={revokeLink}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Revoke Link
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
