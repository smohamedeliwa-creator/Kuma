import { cn } from '@/lib/utils';

const badgeVariants = {
  default: 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)]',
  secondary: 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]',
  destructive: 'bg-[#FEE2E2] text-[#EF4444] dark:bg-red-900/40 dark:text-red-300',
  outline: 'border border-[var(--border-color)] text-[var(--text-secondary)]',
  success: 'bg-[#E0F7F5] text-[#1A9E96] dark:bg-teal-900/40 dark:text-teal-300',
  warning: 'bg-[#FEF3C7] text-[#B07D00] dark:bg-yellow-900/40 dark:text-yellow-300',
  info: 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)] dark:bg-purple-900/40 dark:text-purple-300',
};

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    />
  );
}
