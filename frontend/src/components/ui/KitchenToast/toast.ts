export type ToastType = 'success' | 'warning' | 'error' | 'info';
const DEFAULT_TOAST_DURATION_MS = 10000;

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

type Listener = (toast: ToastMessage) => void;
let listeners: Listener[] = [];

export const toast = {
    subscribe: (fn: Listener) => {
        listeners.push(fn);
        return () => {
            listeners = listeners.filter((l) => l !== fn);
        };
    },
    emit: (msg: Omit<ToastMessage, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const fullMsg = { ...msg, id, duration: msg.duration !== undefined ? msg.duration : DEFAULT_TOAST_DURATION_MS };
        listeners.forEach((l) => l(fullMsg));
    },
    success: (title: string, message?: string, duration?: number) =>
        toast.emit({ type: 'success', title, message, duration }),
    warning: (title: string, message?: string, duration?: number) =>
        toast.emit({ type: 'warning', title, message, duration }),
    error: (title: string, message?: string, duration?: number) =>
        toast.emit({ type: 'error', title, message, duration }),
    alert: (title: string, message?: string, duration?: number) =>
        toast.emit({ type: 'error', title, message, duration }),
    info: (title: string, message?: string, duration?: number) =>
        toast.emit({ type: 'info', title, message, duration }),
};
