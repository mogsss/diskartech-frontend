import Toast from '@/components/ui/Toast';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastOptions {
  message: string;
  title?: string;
  type?: ToastType;
  /** Milliseconds before dismissal; use 0 to keep it visible until dismissed. */
  duration?: number;
}
export interface ToastMessage {
  id: number;
  message: string;
  title?: string;
  type: ToastType;
  duration: number;
}
interface ToastContextValue {
  showToast: (options: ToastOptions | string) => number | null;
  hideToast: (id?: number) => void;
}
interface ToastPresentation {
  toast: ToastMessage | null;
  activeViewport: symbol | undefined;
  registerViewport: (id: symbol) => () => void;
}

const ToastContext = createContext<(ToastContextValue & ToastPresentation) | undefined>(undefined);

/** The latest toast replaces the previous one, so old notices do not pile up. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [viewports, setViewports] = useState<symbol[]>([]);
  const currentToast = useRef<ToastMessage | null>(null);
  const nextId = useRef(0);

  const hideToast = useCallback((id?: number) => {
    if (id !== undefined && currentToast.current?.id !== id) return;
    currentToast.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((input: ToastOptions | string) => {
    const options = typeof input === 'string' ? { message: input } : input;
    const message = options.message.trim();
    if (!message) return null;
    const type = options.type ?? 'info';
    const fallback = type === 'error' ? 5000 : 3500;
    const duration = options.duration === 0 ? 0 : Number.isFinite(options.duration)
      ? Math.min(60000, Math.max(1000, options.duration!)) : fallback;
    const next: ToastMessage = { id: ++nextId.current, message, title: options.title?.trim() || undefined, type, duration };
    currentToast.current = next;
    setToast(next);
    return next.id;
  }, []);

  useEffect(() => {
    if (!toast || toast.duration === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startTimer = async () => {
      let duration = toast.duration;
      if (Platform.OS === 'android') {
        try {
          const recommended = await AccessibilityInfo.getRecommendedTimeoutMillis(duration);
          if (Number.isFinite(recommended)) duration = Math.max(duration, recommended);
        } catch { /* Keep the chosen timeout when the accessibility API is unavailable. */ }
      }
      if (!cancelled) timer = setTimeout(() => hideToast(toast.id), duration);
    };
    void startTimer();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [toast, hideToast]);

  const registerViewport = useCallback((id: symbol) => {
    setViewports(previous => [...previous.filter(viewport => viewport !== id), id]);
    return () => setViewports(previous => previous.filter(viewport => viewport !== id));
  }, []);
  const activeViewport = viewports[viewports.length - 1];
  const value = useMemo(() => ({ showToast, hideToast, toast, activeViewport, registerViewport }), [showToast, hideToast, toast, activeViewport, registerViewport]);
  return <ToastContext.Provider value={value}>
    {children}
    {toast && !activeViewport && <Toast key={toast.id} toast={toast} onDismiss={hideToast} />}
  </ToastContext.Provider>;
}

/** Mount inside a native Modal so its toasts appear above the modal content. */
export function ToastViewport({ active }: { active: boolean }) {
  const context = useContext(ToastContext);
  if (!context) throw new Error('ToastViewport must be used inside ToastProvider.');
  const id = useRef(Symbol('toast-viewport')).current;
  const { registerViewport, activeViewport, toast, hideToast } = context;
  useEffect(() => {
    if (active) return registerViewport(id);
  }, [active, id, registerViewport]);
  return active && activeViewport === id && toast ? <Toast key={toast.id} toast={toast} onDismiss={hideToast} /> : null;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
