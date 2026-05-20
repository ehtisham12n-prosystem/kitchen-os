const TERMINAL_SESSION_KEY = 'active_till_session';

export interface TerminalTillSession {
    id: number;
    name: string;
    code: string;
    branch_id: number;
    sale_counter_id?: number;
}

function readStoredTillSession(storage: Storage | undefined): TerminalTillSession | null {
    if (!storage) return null;
    try {
        const raw = storage.getItem(TERMINAL_SESSION_KEY);
        return raw ? JSON.parse(raw) as TerminalTillSession : null;
    } catch {
        return null;
    }
}

export function getActiveTillSession(): TerminalTillSession | null {
    const fromSession = readStoredTillSession(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
    if (fromSession) return fromSession;

    const fromLocal = readStoredTillSession(typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (fromLocal) {
        try {
            sessionStorage.setItem(TERMINAL_SESSION_KEY, JSON.stringify(fromLocal));
        } catch {
            // Ignore storage sync errors and still return the persisted till session.
        }
    }
    return fromLocal;
}

export function setActiveTillSession(session: TerminalTillSession) {
    const raw = JSON.stringify(session);
    sessionStorage.setItem(TERMINAL_SESSION_KEY, raw);
    localStorage.setItem(TERMINAL_SESSION_KEY, raw);
}

export function clearActiveTillSession() {
    sessionStorage.removeItem(TERMINAL_SESSION_KEY);
    localStorage.removeItem(TERMINAL_SESSION_KEY);
}
