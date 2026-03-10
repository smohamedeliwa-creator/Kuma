import { createContext, useContext, useState, useCallback } from 'react';
import { ToastProvider, ToastViewport, Toast } from '@/components/ui/toast';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProviderWrapper({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ title, description, variant = 'default', duration = 4000 }) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, title, description, variant, open: true }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration + 300);
    return id;
  }, []);

  function handleOpenChange(id, open) {
    if (!open) setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <Toast
            key={t.id}
            open={t.open}
            onOpenChange={(open) => handleOpenChange(t.id, open)}
            title={t.title}
            description={t.description}
            variant={t.variant}
            duration={4000}
          />
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
