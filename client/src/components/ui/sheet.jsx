import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export function SheetOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-black/50', className)}
      {...props}
    />
  );
}

export function SheetContent({ side = 'right', className, children, noClose = false, ...props }) {
  const sideClasses = {
    right: 'inset-x-0 bottom-0 w-full border-t rounded-t-xl max-h-[90vh] sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-full sm:w-full sm:border-t-0 sm:rounded-none sm:max-h-none',
    left: 'inset-y-0 left-0 h-full w-full max-w-[480px] border-r',
    top: 'inset-x-0 top-0 w-full border-b',
    bottom: 'inset-x-0 bottom-0 w-full border-t',
  };

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-[hsl(var(--card))] shadow-xl flex flex-col',
          sideClasses[side],
          className
        )}
        {...props}
      >
        {children}
        {!noClose && (
          <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </SheetClose>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1 px-6 pt-6 pb-4 border-b', className)} {...props} />;
}

export function SheetTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  );
}

export function SheetDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 px-6 py-4 border-t mt-auto', className)} {...props} />
  );
}
