import { cn } from '@/lib/utils';

export function Progress({ value = 0, className }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--surface-secondary)]', className)}>
      <div
        className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
