import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = ({ className, ...props }) => (
  <ToastPrimitive.Viewport
    className={cn(
      'fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[380px] max-w-[calc(100vw-2rem)]',
      className
    )}
    {...props}
  />
);

const variantClasses = {
  default: 'bg-[hsl(var(--card))] border text-[hsl(var(--foreground))]',
  success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300',
  destructive: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300',
};

const variantIcons = {
  default: <Info className="h-4 w-4 shrink-0" />,
  success: <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />,
  destructive: <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />,
};

export function Toast({ className, variant = 'default', title, description, ...props }) {
  return (
    <ToastPrimitive.Root
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
        variantClasses[variant] || variantClasses.default,
        className
      )}
      {...props}
    >
      {variantIcons[variant]}
      <div className="flex-1 min-w-0">
        {title && (
          <ToastPrimitive.Title className="text-sm font-semibold">{title}</ToastPrimitive.Title>
        )}
        {description && (
          <ToastPrimitive.Description className="text-sm opacity-90 mt-0.5">
            {description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close className="shrink-0 opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}
