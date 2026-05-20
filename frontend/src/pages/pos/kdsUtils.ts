/* eslint-disable @typescript-eslint/no-explicit-any */
export function getKOTColor(kot: any) {
    if (kot.status === 'ready') return '#166534';
    if (kot.status === 'preparing') return '#9A3412';
    if (kot.status === 'completed') return '#5B21B6';
    if (kot.status === 'cancelled') return '#B91C1C';
    if (kot.status === 'recalled') return '#B91C1C';

    // Time-based urgency for pending
    const startTime = new Date(kot.created_at).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - startTime) / (1000 * 60);

    if (diffMinutes > 15) return '#B91C1C';
    return '#1D4ED8';
}

export function formatTimeElapsed(createdAt: string) {
    const start = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffSeconds = Math.floor((now - start) / 1000);

    const h = Math.floor(diffSeconds / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    const s = diffSeconds % 60;

    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getItemTimeStatus(createdAt: string, targetPrepMinutes: number) {
    const start = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const targetTime = start + (targetPrepMinutes * 60 * 1000);
    const diffSeconds = Math.floor((targetTime - now) / 1000); // positive if remaining, negative if overdue

    let color = '#166534';
    if (diffSeconds < 0) {
        color = '#B91C1C'; // Overdue / delayed
    } else if (diffSeconds <= 120) {
        color = '#C2410C'; // Less than 2 min remaining
    }

    const absDiff = Math.abs(diffSeconds);
    const m = Math.floor(absDiff / 60);
    const s = absDiff % 60;
    const formatted = `${m}:${s.toString().padStart(2, '0')}`;

    return {
        isOverdue: diffSeconds < 0,
        formattedTime: diffSeconds < 0 ? `+${formatted}` : formatted,
        color
    };
}
