import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] rounded-full',
        destructive: 'bg-red-500 text-white hover:bg-red-600 rounded-full',
        outline: 'border-[1.5px] border-[var(--border-color)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-full',
        secondary: 'bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-full',
        ghost: 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] rounded-lg',
        link: 'text-[var(--brand-primary)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-5 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
