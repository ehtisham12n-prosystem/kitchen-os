export function isAnalyticsEntitlementError(message: string | null | undefined): boolean {
    if (!message) {
        return false;
    }

    const normalized = message.trim().toLowerCase();
    return normalized.includes('subscription does not include analytics reporting')
        || normalized.includes('analytics reporting is not available')
        || normalized.includes('analytics is not available for this tenant')
        || normalized.includes('reporting is not available for this tenant');
}

export function getAnalyticsBlockedMessage(message: string | null | undefined): string {
    if (isAnalyticsEntitlementError(message)) {
        return 'Your subscription does not include analytics reporting.';
    }
    return message?.trim() || 'Analytics reporting is not available right now.';
}
