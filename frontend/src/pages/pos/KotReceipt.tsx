import {
    buildKOTPrintMarkup,
    KOT_PRINT_CSS,
    type KOTPrintInput,
    type PrintTemplateSettings,
} from './printTemplates/kotPrintTemplate';
import { formatConfiguredKotNumber, formatConfiguredOrderNumber, resolveKotDisplayNumber } from './printTemplates/printHelpers';

interface KOTReceiptProps {
    kot: any;
}

export function KotReceipt({ kot }: KOTReceiptProps) {
    if (!kot) return null;

    const settings: PrintTemplateSettings = {
        logo_url: kot?.settings?.logo_url ?? kot?.company_settings?.logo_url ?? null,
        company_name: kot?.settings?.company_name ?? kot?.company_settings?.company_name ?? null,
        address: kot?.settings?.address ?? kot?.company_settings?.address ?? null,
        phone: kot?.settings?.phone ?? kot?.company_settings?.phone ?? null,
        footer_message: kot?.settings?.footer_message ?? kot?.company_settings?.footer_message ?? null,
    };

    const data: KOTPrintInput = {
        kot_no: formatConfiguredKotNumber(resolveKotDisplayNumber(kot, String(kot.kot_no || kot.id || '-')), kot, { preserveTypePrefix: true })
            || resolveKotDisplayNumber(kot, String(kot.kot_no || kot.id || '-')),
        order_no: formatConfiguredOrderNumber(kot.order_number || kot.order_no || kot.order_id || '-', kot, { preserveTypePrefix: true })
            || kot.order_number
            || kot.order_no
            || kot.order_id
            || '-',
        datetime: kot.created_at || kot.datetime || new Date(),
        order_type: kot.order_type || 'Dine-In',
        table: kot.table_number || kot.table || null,
        token: kot.token || null,
        rider: kot.rider || null,
        guests: kot.guests ?? null,
        server: kot.waiter || kot.server || null,
        items: Array.isArray(kot.items)
            ? kot.items.map((item: any) => ({
                name: item.product_name || item.name || 'Unnamed Item',
                qty: item.quantity ?? item.qty ?? 0,
                modifiers: Array.isArray(item.modifiers)
                    ? item.modifiers
                    : [item.notes || item.instructions].filter(Boolean),
            }))
            : [],
        notes: kot.notes || kot.order_note || null,
        printed_by: kot.printed_by || kot.waiter || kot.server || null,
        print_id: kot.print_id || kot.id || null,
        printed_at: new Date(),
    };

    const markup = buildKOTPrintMarkup({
        settings,
        data,
        format: 'thermal-80mm',
    });

    return (
        <>
            <style>{KOT_PRINT_CSS}</style>
            <div
                className="kot-print-host"
                id="kot-receipt-print"
                dangerouslySetInnerHTML={{ __html: markup }}
            />
        </>
    );
}
