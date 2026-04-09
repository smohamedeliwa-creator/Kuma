import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-10 w-full rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-color)] bg-[var(--surface)] px-3 py-1 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-muted)] placeholder:text-[13px] focus-visible:outline-none focus-visible:border-[var(--brand-primary)] focus-visible:shadow-[0_0_0_3px_rgba(108,71,255,0.12)] disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
