import { useEffect, useState } from 'react';
import { USER_CONTEXT_CHANGED_EVENT } from '../auth/access';
import { formatCurrency, getCurrencyCodeLabel, getEffectiveCurrencyCode } from '../utils/currency';

const BRANCH_CHANGED_EVENT = 'branch_changed';

export function useCurrencyConfig() {
    const [, setVersion] = useState(0);

    useEffect(() => {
        const sync = () => setVersion((current) => current + 1);
        window.addEventListener(USER_CONTEXT_CHANGED_EVENT, sync);
        window.addEventListener(BRANCH_CHANGED_EVENT, sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, sync);
            window.removeEventListener(BRANCH_CHANGED_EVENT, sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const currencyCode = getEffectiveCurrencyCode();

    return {
        currencyCode,
        currencyLabel: getCurrencyCodeLabel(currencyCode),
        formatMoney: (value?: number | null, options?: Parameters<typeof formatCurrency>[1]) => (
            formatCurrency(value, { currencyCode, ...options })
        ),
    };
}
