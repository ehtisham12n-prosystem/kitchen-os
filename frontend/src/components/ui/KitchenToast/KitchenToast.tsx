import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { toast as toastManager, type ToastMessage } from './toast';
import styles from './KitchenToast.module.css';

export function KitchenToastContainer() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    useEffect(() => {
        const unsubscribe = toastManager.subscribe((newToast) => {
            setToasts((prev) => [...prev, newToast]);

            if (newToast.duration !== 0) {
                setTimeout(() => {
                    removeToast(newToast.id);
                }, newToast.duration);
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (toasts.length === 0) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Enter' || event.repeat || event.defaultPrevented) {
                return;
            }

            const target = event.target as HTMLElement | null;
            if (target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
                return;
            }

            setToasts((prev) => prev.slice(0, -1));
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toasts.length]);

    const translateTechnicalMessage = (msg: string) => {
        const text = msg.trim();

        // Helper to format field name (e.g. domain_slug -> Domain Slug)
        const formatField = (rawField: string) => {
            return rawField
                .replace(/^property\s+/i, '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim();
        };

        // 1. Should not exist (Extra fields during update)
        if (text.toLowerCase().includes('should not exist')) {
            const raw = text.match(/property (.*) should/i)?.[1] || text.split(' should')[0];
            return `${formatField(raw)} cannot be updated or changed.`;
        }

        // 2. URL validation
        if (text.toLowerCase().includes('must be a url address')) {
            const raw = text.split(' must')[0];
            return `${formatField(raw)} must be a valid web link (starting with http:// or https://).`;
        }

        // 3. Email validation
        if (text.toLowerCase().includes('must be an email')) {
            const raw = text.split(' must')[0];
            return `${formatField(raw)} must be a valid email address.`;
        }

        // 4. Required fields
        if (text.toLowerCase().includes('should not be empty')) {
            const raw = text.split(' should')[0];
            return `${formatField(raw)} is required and cannot be left blank.`;
        }

        // 5. Number validation
        if (text.toLowerCase().includes('must be a number')) {
            const raw = text.split(' must')[0];
            return `${formatField(raw)} must be a numeric value.`;
        }

        return msg;
    };

    if (toasts.length === 0) return null;

    const extractReferenceId = (msg: string) => {
        const match = msg.match(/\bReference ID:\s*([A-Za-z0-9-]+)\.?/i);
        if (!match) {
            return { message: msg, referenceId: null as string | null };
        }

        return {
            message: msg.replace(/\s*\bReference ID:\s*[A-Za-z0-9-]+\.*\s*/i, ' ').replace(/\s{2,}/g, ' ').trim(),
            referenceId: match[1],
        };
    };

    const renderHighlightedText = (value: string) => {
        const pattern = /(Order\s*#\s*)([A-Za-z0-9-]+)|(KOT\s*#\s*)([A-Za-z0-9-]+)|((?:Employee|Client|Branch|Counter|Shift|Terminal|Session|Till)\s+No\.\s*)([A-Za-z0-9-]+)/gi;
        const nodes: ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(value)) !== null) {
            if (match.index > lastIndex) {
                nodes.push(value.slice(lastIndex, match.index));
            }

            if (match[1] && match[2]) {
                nodes.push(
                    <span key={`${match.index}-order`}>
                        {match[1]}
                        <span className={styles.orderNumberValue}>{match[2]}</span>
                    </span>,
                );
            } else if (match[3] && match[4]) {
                nodes.push(
                    <span key={`${match.index}-kot`}>
                        {match[3]}
                        <span className={styles.numberValue}>{match[4]}</span>
                    </span>,
                );
            } else if (match[5] && match[6]) {
                nodes.push(
                    <span key={`${match.index}-ref`}>
                        {match[5]}
                        <span className={styles.numberValue}>{match[6]}</span>
                    </span>,
                );
            }

            lastIndex = pattern.lastIndex;
        }

        if (lastIndex < value.length) {
            nodes.push(value.slice(lastIndex));
        }

        return nodes;
    };

    const renderMessage = (msg: string, type: ToastMessage['type']) => {
        const { message, referenceId } = extractReferenceId(msg);
        const separators = [',', ';'];
        let parts: string[] = [message];

        for (const sep of separators) {
            if (message.includes(sep)) {
                parts = message.split(sep)
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                break;
            }
        }

        if (parts.length > 1) {
            return (
                <>
                    <ul className={styles.messageList}>
                        {parts.map((part, index) => (
                            <li key={index} className={styles.messageItem}>
                                {renderHighlightedText(translateTechnicalMessage(part))}
                            </li>
                        ))}
                    </ul>
                    {type === 'error' && referenceId ? (
                        <p className={styles.referenceLine}>
                            <span className={styles.referenceLabel}>Reference ID</span>
                            <span className={styles.referenceValue}>{referenceId}</span>
                        </p>
                    ) : null}
                </>
            );
        }

        return (
            <>
                <p className={styles.message}>{renderHighlightedText(translateTechnicalMessage(message))}</p>
                {type === 'error' && referenceId ? (
                    <p className={styles.referenceLine}>
                        <span className={styles.referenceLabel}>Reference ID</span>
                        <span className={styles.referenceValue}>{referenceId}</span>
                    </p>
                ) : null}
            </>
        );
    };

    return (
        <div className={styles.toastContainer}>
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`${styles.toast} ${styles[toast.type]}`}
                    role="alert"
                    aria-live={toast.type === 'error' || toast.type === 'warning' ? 'assertive' : 'polite'}
                >
                    <div className={styles.icon}>
                        {toast.type === 'success' && <CheckCircle2 size={24} />}
                        {toast.type === 'warning' && <TriangleAlert size={24} />}
                        {toast.type === 'error' && <XCircle size={24} />}
                        {toast.type === 'info' && <Info size={24} />}
                    </div>
                    <div className={styles.content}>
                        <div className={styles.header}>
                            <h4 className={styles.title}>{toast.title}</h4>
                            <button
                                className={styles.closeBtn}
                                onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
                                aria-label="Close Notification"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {toast.message && renderMessage(toast.message, toast.type)}

                        <div className={styles.actions}>
                            <button
                                className={styles.okBtn}
                                onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
                                aria-label={`Dismiss ${toast.title} notification`}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
