import { persistUserContext, readStoredUserContext, resolvePrimaryBranchId, type UserContext } from '../auth/access';

const DEFAULT_CURRENCY_CODE = 'USD';

function resolveBranchIdentifier(branch?: { branch_id?: number | null; id?: number | null } | null): number {
    return Number(branch?.branch_id ?? branch?.id ?? 0);
}

type CurrencyFormatOptions = {
    currencyCode?: string | null;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
};

function normalizeCurrencyCode(value?: string | null): string {
    const normalized = String(value || DEFAULT_CURRENCY_CODE).trim().toUpperCase();
    return normalized || DEFAULT_CURRENCY_CODE;
}

function getDefaultFractionDigits(currencyCode: string): { minimumFractionDigits?: number; maximumFractionDigits?: number } {
    if (currencyCode === 'PKR') {
        return { minimumFractionDigits: 0, maximumFractionDigits: 0 };
    }

    return {};
}

export function getEffectiveCurrencyCode(context: UserContext | null = readStoredUserContext()): string {
    const activeBranchId = Number(localStorage.getItem('activeBranchId') || localStorage.getItem('branch_id') || 0);
    const branches = context?.allowed_branches ?? [];
    const branch = branches.find((candidate) => resolveBranchIdentifier(candidate) === activeBranchId)
        ?? branches.find((candidate) => resolveBranchIdentifier(candidate) === Number(context?.active_branch_id))
        ?? branches.find((candidate) => candidate.is_primary)
        ?? branches[0];

    return normalizeCurrencyCode(
        branch?.effective_currency_code
        || branch?.currency_code
        || context?.client_currency,
    );
}

export function formatCurrency(
    value?: number | null,
    {
        currencyCode,
        locale = 'en-US',
        minimumFractionDigits,
        maximumFractionDigits,
    }: CurrencyFormatOptions = {},
): string {
    const code = normalizeCurrencyCode(currencyCode || getEffectiveCurrencyCode());
    const amount = Number(value || 0);
    const resolvedAmount = Number.isFinite(amount) ? amount : 0;
    const defaultDigits = getDefaultFractionDigits(code);
    const resolvedMinimumFractionDigits = minimumFractionDigits ?? defaultDigits.minimumFractionDigits;
    const resolvedMaximumFractionDigits = maximumFractionDigits ?? defaultDigits.maximumFractionDigits;

    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            ...(resolvedMinimumFractionDigits !== undefined ? { minimumFractionDigits: resolvedMinimumFractionDigits } : {}),
            ...(resolvedMaximumFractionDigits !== undefined ? { maximumFractionDigits: resolvedMaximumFractionDigits } : {}),
        }).format(resolvedAmount);
    } catch {
        return `${code} ${resolvedAmount.toLocaleString(locale, {
            minimumFractionDigits: resolvedMinimumFractionDigits,
            maximumFractionDigits: resolvedMaximumFractionDigits,
        })}`;
    }
}

export function updateStoredClientCurrency(currencyCode: string): void {
    const context = readStoredUserContext();
    if (!context) return;

    const normalized = normalizeCurrencyCode(currencyCode);
    persistUserContext({
        ...context,
        client_currency: normalized,
        allowed_branches: (context.allowed_branches ?? []).map((branch) => (
            branch.inherit_client_currency === false
                ? branch
                : { ...branch, effective_currency_code: normalized }
        )),
    });
}

export function updateStoredBranchCurrency(
    branchId: number,
    options: { inheritClientCurrency: boolean; currencyCode?: string | null },
): void {
    const context = readStoredUserContext();
    if (!context) return;

    const clientCurrency = normalizeCurrencyCode(context.client_currency);
    persistUserContext({
        ...context,
        allowed_branches: (context.allowed_branches ?? []).map((branch) => {
            if (Number(branch.branch_id) !== Number(branchId)) return branch;
            const overrideCode = options.currencyCode ? normalizeCurrencyCode(options.currencyCode) : null;
            return {
                ...branch,
                inherit_client_currency: options.inheritClientCurrency,
                currency_code: options.inheritClientCurrency ? null : overrideCode,
                effective_currency_code: options.inheritClientCurrency ? clientCurrency : (overrideCode || clientCurrency),
            };
        }),
        active_branch_id: context.active_branch_id ?? resolvePrimaryBranchId(context) ?? undefined,
    });
}

export function getCurrencyCodeLabel(currencyCode?: string | null): string {
    return normalizeCurrencyCode(currencyCode || getEffectiveCurrencyCode());
}
