import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('rounded-md bg-[var(--surface-secondary)] [background-size:200%_100%] [background-image:linear-gradient(90deg,var(--surface-secondary)_25%,var(--surface-hover)_50%,var(--surface-secondary)_75%)] [animation:shimmer_1.5s_infinite]', className)}
      {...props}
    />
  );
}
