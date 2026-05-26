import { apiAssetUrl } from '../../../api/api';
import type { PrintPaperFormat, PrintTemplateSettings } from './kotPrintTemplate';

type PrintSource = object | null | undefined;
type OperationalRule = {
    prefix?: string | null;
    zero_pad?: number | null;
    include_branch_code?: boolean;
    include_counter_code?: boolean;
    date_segment_format?: string | null;
} | null;
export type DocumentRuleMode =
    | 'pos_order'
    | 'pos_receipt'
    | 'pos_kot'
    | 'purchase_order'
    | 'procurement_request'
    | 'goods_receipt_note'
    | 'payment_voucher'
    | 'expense_voucher'
    | 'compensation_voucher';

const pickString = (source: PrintSource, keys: string[]) => {
    if (!source) {
        return null;
    }

    const values = source as Record<string, unknown>;
    for (const key of keys) {
        const value = values[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    return null;
};

const pickNested = (source: PrintSource, key: string): PrintSource => {
    if (!source || typeof source !== 'object') {
        return null;
    }
    const value = (source as Record<string, unknown>)[key];
    return value && typeof value === 'object' ? value as PrintSource : null;
};

const padKotBase = (value: unknown) => {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return String(Math.trunc(parsed)).padStart(3, '0');
};

const buildKotDisplayFromBaseAndVersion = (baseDisplay: string, version: number) => {
    const normalizedVersion = Math.max(0, Math.trunc(Number(version || 0)));
    if (normalizedVersion <= 1) {
        return baseDisplay;
    }
    return `${baseDisplay}-${normalizedVersion - 1}`;
};

export const formatOperationalDisplayNumber = (
    value: unknown,
    options?: {
        hideOperationalIdentity?: boolean;
        preserveTypePrefix?: boolean;
    },
) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '';
    }

    if (!options?.hideOperationalIdentity) {
        return normalized;
    }

    const segments = normalized.split('-').filter(Boolean);
    if (segments.length <= 1) {
        return normalized;
    }

    const first = segments[0] || '';
    const hasTypePrefix = /^(ord|order|kot)$/i.test(first);
    const tailCount = segments.length >= 2
        && /^\d+$/.test(segments[segments.length - 1] || '')
        && /^\d+$/.test(segments[segments.length - 2] || '')
        ? 2
        : 1;
    const tail = segments.slice(-tailCount);

    if (options.preserveTypePrefix && hasTypePrefix) {
        return [first, ...tail].join('-');
    }

    return tail.join('-');
};

const normalizeCodeSegment = (value?: string | null) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

const resolveOperationalRule = (
    source: PrintSource,
    mode: DocumentRuleMode,
): OperationalRule => {
    const branding = pickNested(source, 'client_branding') || pickNested(source, 'branding');
    const numbering = pickNested(source, 'numbering_settings')
        || pickNested(branding, 'numbering_settings')
        || pickNested(pickNested(source, 'order'), 'numbering_settings');
    const rules = pickNested(numbering, 'rules');
    const branchDocumentSettings = pickNested(source, 'document_settings');
    const nestedBranchDocumentSettings = pickNested(pickNested(source, 'branch'), 'document_settings');
    return (pickNested(rules, mode)
        || pickNested(branchDocumentSettings, mode)
        || pickNested(nestedBranchDocumentSettings, mode)) as OperationalRule;
};

const resolveOperationalCode = (
    source: PrintSource,
    keys: string[],
): string | null => {
    const direct = normalizeCodeSegment(pickString(source, keys));
    if (direct) {
        return direct;
    }
    const orderSource = pickNested(source, 'order');
    const nested = normalizeCodeSegment(pickString(orderSource, keys));
    return nested || null;
};

const getRevisionSuffixLength = (segments: string[], zeroPad: number) => {
    if (segments.length < 2) {
        return 0;
    }
    const last = segments[segments.length - 1] || '';
    const previous = segments[segments.length - 2] || '';
    if (!/^\d+$/.test(last) || !/^\d+$/.test(previous)) {
        return 0;
    }
    return previous.length >= Math.max(2, zeroPad) && last.length < Math.max(2, zeroPad) ? 1 : 0;
};

export const formatConfiguredOperationalNumber = (
    value: unknown,
    source: PrintSource,
    mode: DocumentRuleMode,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '';
    }

    const rule = resolveOperationalRule(source, mode);
    if (!rule) {
        return normalized;
    }

    const segments = normalized.split('-').filter(Boolean);
    if (segments.length <= 2) {
        return normalized;
    }

    const zeroPad = Math.max(2, Number(rule.zero_pad || 4));
    const revisionSuffixLength = getRevisionSuffixLength(segments, zeroPad);
    const protectedSuffixLength = 1
        + revisionSuffixLength
        + (String(rule.date_segment_format || 'none').toLowerCase() === 'none' ? 0 : 1);
    const prefix = segments[0] || '';
    const suffixStart = Math.max(1, segments.length - protectedSuffixLength);
    const middle = segments.slice(1, suffixStart);
    const suffix = segments.slice(suffixStart);
    const branchCode = resolveOperationalCode(source, ['branch_code', 'branchCode']);
    const counterCode = resolveOperationalCode(source, ['sale_counter_code', 'counter_code', 'counterCode']);

    const removeMiddleSegment = (candidates: string[], fallbackIndex: number) => {
        const normalizedCandidates = candidates.map((candidate) => normalizeCodeSegment(candidate)).filter(Boolean);
        const matchedIndex = middle.findIndex((segment) => normalizedCandidates.includes(normalizeCodeSegment(segment)));
        if (matchedIndex >= 0) {
            middle.splice(matchedIndex, 1);
            return;
        }
        if (fallbackIndex >= 0 && fallbackIndex < middle.length) {
            middle.splice(fallbackIndex, 1);
        }
    };

    if (rule.include_branch_code === false && middle.length > 0) {
        removeMiddleSegment(branchCode ? [branchCode] : [], 0);
    }

    if (rule.include_counter_code === false && middle.length > 0) {
        removeMiddleSegment(counterCode ? [counterCode] : [], middle.length > 1 ? 1 : 0);
    }

    const nextSegments = [prefix, ...middle, ...suffix].filter(Boolean);
    if (!options?.preserveTypePrefix) {
        return nextSegments.join('-');
    }
    return nextSegments.join('-');
};

export const formatConfiguredOrderNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'pos_order', options);

export const formatConfiguredKotNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'pos_kot', options);

export const formatConfiguredReceiptNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'pos_receipt', options);

export const formatConfiguredPurchaseOrderNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'purchase_order', options);

export const formatConfiguredProcurementRequestNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'procurement_request', options);

export const formatConfiguredGrnNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'goods_receipt_note', options);

export const formatConfiguredPaymentVoucherNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'payment_voucher', options);

export const formatConfiguredExpenseVoucherNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'expense_voucher', options);

export const formatConfiguredCompensationVoucherNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => formatConfiguredOperationalNumber(value, source, 'compensation_voucher', options);

export const formatConfiguredDocumentNumber = (
    value: unknown,
    source: PrintSource,
    options?: {
        preserveTypePrefix?: boolean;
    },
) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return '';
    }

    const upper = normalized.toUpperCase();
    if (upper.startsWith('KOT-')) {
        return formatConfiguredKotNumber(normalized, source, options);
    }
    if (upper.startsWith('ORD-') || upper.startsWith('ORDER-')) {
        return formatConfiguredOrderNumber(normalized, source, options);
    }
    if (upper.startsWith('REC-') || upper.startsWith('RCP-') || upper.startsWith('INV-') || upper.startsWith('INVOICE-')) {
        return formatConfiguredReceiptNumber(normalized, source, options);
    }
    if (upper.startsWith('PO-')) {
        return formatConfiguredPurchaseOrderNumber(normalized, source, options);
    }
    if (upper.startsWith('PR-')) {
        return formatConfiguredProcurementRequestNumber(normalized, source, options);
    }
    if (upper.startsWith('GRN-')) {
        return formatConfiguredGrnNumber(normalized, source, options);
    }
    if (upper.startsWith('PV-')) {
        return formatConfiguredPaymentVoucherNumber(normalized, source, options);
    }
    if (upper.startsWith('EV-') || upper.startsWith('EXP-')) {
        return formatConfiguredExpenseVoucherNumber(normalized, source, options);
    }
    if (upper.startsWith('CV-') || upper.startsWith('COMP-')) {
        return formatConfiguredCompensationVoucherNumber(normalized, source, options);
    }

    return normalized;
};

export const resolveKotDisplayNumber = (source: PrintSource, fallback = '-'): string => {
    const nestedKots = Array.isArray((source as Record<string, unknown> | undefined)?.kots)
        ? ((source as Record<string, unknown>).kots as unknown[])
        : [];
    const latestKot = nestedKots.length > 0 ? nestedKots[nestedKots.length - 1] : null;
    if (latestKot && typeof latestKot === 'object') {
        const nestedDisplay = pickString(latestKot as Record<string, unknown>, [
            'current_kot_display_number',
            'display_kot_number',
            'kot_display_number',
            'kot_number',
            'kot_no',
        ]);
        if (nestedDisplay) {
            return nestedDisplay;
        }
    }

    const explicitDisplay = pickString(source, ['current_kot_display_number', 'kot_display_number', 'display_kot_number']);
    if (explicitDisplay) {
        return explicitDisplay;
    }

    const version = Number((source as Record<string, unknown> | undefined)?.kot_version ?? 0);
    const baseDisplay = pickString(source, ['kot_base_display']) || padKotBase((source as Record<string, unknown> | undefined)?.kot_base_number);
    if (baseDisplay && Number.isFinite(version) && version > 0) {
        return buildKotDisplayFromBaseAndVersion(baseDisplay, version);
    }

    const raw = pickString(source, ['current_kot_number', 'kot_number', 'kot_no']);
    if (raw) {
        return raw;
    }

    return fallback;
};

export const resolvePrintTemplateSettings = (
    source: PrintSource,
    fallbackCompanyName?: string | null
): PrintTemplateSettings => {
    const branding = pickNested(source, 'client_branding') || pickNested(source, 'branding');
    const brandingData = (branding ?? {}) as Record<string, any>;
    const branchName = pickString(source, ['branch_name', 'branchName']);
    const branchAddress = pickString(source, ['address', 'branch_address', 'branchAddress']);
    const branchPhone = pickString(source, ['phone', 'phone_number', 'phoneNumber', 'branch_phone', 'branchPhone']);
    const fullLogo = pickString(branding, ['full_logo_url', 'logo_url', 'logoUrl', 'company_logo', 'companyLogo']);
    const shortLogo = pickString(branding, ['short_logo_url', 'shortLogoUrl']);
    const footerMessage = pickString(source, ['footer_message', 'footerMessage', 'receipt_footer', 'receiptFooter']);
    const footer1 = brandingData.show_receipt_footer_message_1 !== false
        ? pickString(branding, ['receipt_footer_message_1', 'footer_1', 'footer1'])
        : null;
    const footer2 = brandingData.show_receipt_footer_message_2
        ? pickString(branding, ['receipt_footer_message_2', 'footer_2', 'footer2'])
        : null;
    const footerLines = [footer1, footer2, footerMessage]
        .filter((line, index, values) => Boolean(line) && values.indexOf(line) === index);
    const businessName = brandingData.show_receipt_business_name !== false
        ? (pickString(branding, ['receipt_business_name']) || (fallbackCompanyName ? String(fallbackCompanyName) : null))
        : null;
    const kotFooter1 = brandingData.show_kot_footer_message_1
        ? pickString(branding, ['receipt_footer_message_1', 'footer_1', 'footer1'])
        : null;
    const kotFooter2 = brandingData.show_kot_footer_message_2
        ? pickString(branding, ['receipt_footer_message_2', 'footer_2', 'footer2'])
        : null;
    const kotFooterLines = [kotFooter1, kotFooter2]
        .filter((line, index, values) => Boolean(line) && values.indexOf(line) === index);
    const kotBusinessName = brandingData.show_kot_business_name !== false
        ? (pickString(branding, ['receipt_business_name']) || (fallbackCompanyName ? String(fallbackCompanyName) : null))
        : null;

    return {
        logo_url: brandingData.show_receipt_full_logo !== false && fullLogo
            ? apiAssetUrl(fullLogo)
            : brandingData.show_receipt_short_logo && shortLogo
                ? apiAssetUrl(shortLogo)
                : null,
        company_name: businessName,
        branch_name: brandingData.show_receipt_branch_name !== false ? branchName : null,
        address: brandingData.show_receipt_branch_address !== false ? branchAddress : null,
        phone: brandingData.show_receipt_contact_number !== false ? branchPhone : null,
        footer_1: footer1 || null,
        footer_2: footer2 || null,
        footer_message: footerLines.join('\n') || null,
        kot_logo_url: brandingData.show_kot_full_logo && fullLogo
            ? apiAssetUrl(fullLogo)
            : brandingData.show_kot_short_logo && shortLogo
                ? apiAssetUrl(shortLogo)
                : null,
        kot_company_name: kotBusinessName,
        kot_branch_name: brandingData.show_kot_branch_name !== false ? branchName : null,
        kot_address: brandingData.show_kot_branch_address ? branchAddress : null,
        kot_phone: brandingData.show_kot_contact_number ? branchPhone : null,
        kot_footer_1: kotFooter1 || null,
        kot_footer_2: kotFooter2 || null,
        kot_footer_message: kotFooterLines.join('\n') || null,
        receipt_paper_size: (pickString(branding, ['receipt_paper_size']) as PrintPaperFormat | null) || 'thermal-80mm',
        invoice_paper_size: (pickString(branding, ['invoice_paper_size']) as PrintPaperFormat | null) || 'a4',
        kot_paper_size: (pickString(branding, ['kot_paper_size']) as PrintPaperFormat | null) || 'thermal-80mm',
        report_paper_size: (pickString(branding, ['report_paper_size']) as PrintPaperFormat | null) || 'a4',
        receipt_print_copies: Number(brandingData.receipt_print_copies ?? 1),
        invoice_print_copies: Number(brandingData.invoice_print_copies ?? 1),
        kot_print_copies: Number(brandingData.kot_print_copies ?? 1),
        kot_print_enabled: brandingData.kot_print_enabled !== false,
        report_print_copies: Number(brandingData.report_print_copies ?? 1),
        order_change_print_mode: (pickString(branding, ['order_change_print_mode']) as PrintTemplateSettings['order_change_print_mode']) || 'change_only',
        order_change_print_copies: Number(brandingData.order_change_print_copies ?? 1),
        enable_station_wise_kot_printing: Boolean(brandingData.enable_station_wise_kot_printing),
        allow_multiple_kot_per_station: Boolean(brandingData.allow_multiple_kot_per_station),
        service_station_print_copies: (brandingData.service_station_print_copies as Record<string, number> | undefined) || {},
        station_printer_mapping: (brandingData.station_printer_mapping as Record<string, string> | undefined) || {},
        separate_kot_stations: Array.isArray(brandingData.separate_kot_stations) ? brandingData.separate_kot_stations as string[] : [],
    };
};

export const shouldHideOperationalIdentity = (
    source: PrintSource,
    settings?: Pick<PrintTemplateSettings, 'branch_name' | 'kot_branch_name'> | null,
    mode: 'receipt' | 'kot' | 'any' = 'any',
) => {
    const branding = pickNested(source, 'client_branding') || pickNested(source, 'branding');
    const brandingData = (branding ?? {}) as Record<string, any>;
    if (mode === 'receipt') {
        if (brandingData.show_receipt_branch_name === false) {
            return true;
        }
        return Boolean(settings?.branch_name === null);
    }

    if (mode === 'kot') {
        if (brandingData.show_kot_branch_name === false) {
            return true;
        }
        return Boolean(settings?.kot_branch_name === null);
    }

    if (brandingData.show_receipt_branch_name === false || brandingData.show_kot_branch_name === false) {
        return true;
    }

    return Boolean(settings && (settings.branch_name === null || settings.kot_branch_name === null));
};

export const openPrintDocument = (markup: string, title = 'Print') => {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(markup, 'text/html');
    const nextTitle = parsed.title || title;
    const headMarkup = parsed.head?.innerHTML || '';
    const bodyMarkup = parsed.body?.innerHTML || markup;
    const documentMarkup = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${nextTitle}</title>${headMarkup}</head><body>${bodyMarkup}</body></html>`;
    const blob = new Blob([documentMarkup], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    const cleanup = () => {
        window.setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        }, 500);
    };

    const waitForFrameAssets = (frameWindow: Window, done: () => void) => {
        const frameDocument = frameWindow.document;
        const images = Array.from(frameDocument.images || []);
        let pending = images.filter((image) => !image.complete).length;

        if (pending === 0) {
            window.setTimeout(done, 120);
            return;
        }

        const settle = () => {
            pending -= 1;
            if (pending <= 0) {
                window.setTimeout(done, 120);
            }
        };

        images.forEach((image) => {
            if (image.complete) {
                return;
            }
            image.addEventListener('load', settle, { once: true });
            image.addEventListener('error', settle, { once: true });
        });

        window.setTimeout(done, 1200);
    };

    iframe.onload = () => {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
            cleanup();
            return;
        }

        const afterPrint = () => {
            frameWindow.removeEventListener('afterprint', afterPrint);
            cleanup();
        };

        frameWindow.addEventListener('afterprint', afterPrint);
        waitForFrameAssets(frameWindow, () => {
            frameWindow.focus();
            frameWindow.print();
            window.setTimeout(cleanup, 4000);
        });
    };

    document.body.appendChild(iframe);
    iframe.src = blobUrl;

    return true;
};

export const openPrintDocumentCopies = (
    buildMarkup: (copyIndex: number) => string,
    copies = 1,
    title = 'Print',
) => {
    const safeCopies = Math.max(1, Number(copies || 1));
    let opened = false;
    for (let index = 0; index < safeCopies; index += 1) {
        opened = openPrintDocument(buildMarkup(index + 1), title) || opened;
    }
    return opened;
};
