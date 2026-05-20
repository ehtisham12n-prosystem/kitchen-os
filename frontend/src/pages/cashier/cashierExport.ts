import { toast } from '../../components/ui/KitchenToast/toast';

export type CashierExportFormat = 'csv' | 'excel' | 'word' | 'pdf';

type ExportRow = Record<string, unknown>;

const EXPORT_FORMATS: Record<CashierExportFormat, { extension: string; mime: string }> = {
    csv: { extension: 'csv', mime: 'text/csv;charset=utf-8;' },
    excel: { extension: 'xls', mime: 'application/vnd.ms-excel;charset=utf-8;' },
    word: { extension: 'doc', mime: 'application/msword;charset=utf-8;' },
    pdf: { extension: 'html', mime: 'text/html;charset=utf-8;' },
};

function csvEscape(value: unknown, delimiter: ',' | '\t') {
    const normalized = value === null || value === undefined ? '' : String(value);
    const escaped = normalized.replace(/\r?\n/g, ' ');
    return new RegExp(`["${delimiter}\n]`).test(escaped)
        ? `"${escaped.replace(/"/g, '""')}"`
        : escaped;
}

function htmlEscape(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function collectHeaders(rows: ExportRow[]) {
    return Array.from(
        rows.reduce((keys, row) => {
            Object.keys(row).forEach((key) => keys.add(key));
            return keys;
        }, new Set<string>()),
    );
}

function buildDelimitedText(rows: ExportRow[], delimiter: ',' | '\t') {
    const headers = collectHeaders(rows);
    return [
        headers.map((header) => csvEscape(header, delimiter)).join(delimiter),
        ...rows.map((row) => headers.map((header) => csvEscape(row[header], delimiter)).join(delimiter)),
    ].join('\n');
}

function buildExcelTable(rows: ExportRow[]) {
    const headers = collectHeaders(rows);
    const head = headers.map((header) => `<th>${htmlEscape(header)}</th>`).join('');
    const body = rows.map((row) => (
        `<tr>${headers.map((header) => `<td>${htmlEscape(row[header])}</td>`).join('')}</tr>`
    )).join('');

    return [
        '<html><head><meta charset="utf-8"></head><body>',
        '<table border="1"><thead><tr>',
        head,
        '</tr></thead><tbody>',
        body,
        '</tbody></table></body></html>',
    ].join('');
}

function buildDocumentHtml(title: string, rows: ExportRow[]) {
    const headers = collectHeaders(rows);
    const head = headers.map((header) => `<th>${htmlEscape(header)}</th>`).join('');
    const body = rows.map((row) => (
        `<tr>${headers.map((header) => `<td>${htmlEscape(row[header])}</td>`).join('')}</tr>`
    )).join('');

    return [
        '<html><head><meta charset="utf-8">',
        `<title>${htmlEscape(title)}</title>`,
        '<style>',
        'body{font-family:Arial,sans-serif;padding:24px;color:#111;}',
        'h1{margin:0 0 16px;font-size:22px;}',
        'p{margin:0 0 16px;color:#555;font-size:12px;}',
        'table{width:100%;border-collapse:collapse;font-size:12px;}',
        'th,td{border:1px solid #cfcfcf;padding:8px;text-align:left;vertical-align:top;}',
        'th{background:#f4f4f4;}',
        '@media print{body{padding:0;}h1,p{margin-left:8px;}}',
        '</style></head><body>',
        `<h1>${htmlEscape(title)}</h1>`,
        `<p>Generated on ${htmlEscape(new Date().toLocaleString())}</p>`,
        '<table><thead><tr>',
        head,
        '</tr></thead><tbody>',
        body,
        '</tbody></table></body></html>',
    ].join('');
}

function downloadBlob(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportCashierRows(filenameBase: string, format: CashierExportFormat, rows: ExportRow[]) {
    if (!rows.length) {
        toast.error('Nothing To Export', 'There are no rows available for the current filters.');
        return;
    }

    const target = EXPORT_FORMATS[format];
    const filename = `${filenameBase}.${target.extension}`;
    const title = filenameBase.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

    if (format === 'excel') {
        downloadBlob(filename, buildExcelTable(rows), target.mime);
        return;
    }

    if (format === 'word') {
        downloadBlob(filename, buildDocumentHtml(title, rows), target.mime);
        return;
    }

    if (format === 'pdf') {
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            toast.error('Popup Blocked', 'Allow popups to open the printable PDF view.');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(buildDocumentHtml(title, rows));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        return;
    }

    downloadBlob(filename, buildDelimitedText(rows, ','), target.mime);
}
