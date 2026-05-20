import { useState, type CSSProperties } from 'react';
import type { PrintPaperFormat } from './printTemplates/kotPrintTemplate';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';

type Props = {
    isOpen: boolean;
    defaultFormat?: PrintPaperFormat;
    title?: string;
    description?: string;
    onClose: () => void;
    onPrint: (format: PrintPaperFormat) => void;
};

const OPTIONS: Array<{ value: PrintPaperFormat; label: string }> = [
    { value: 'thermal-80mm', label: '80mm Thermal' },
    { value: 'a4', label: 'A4' },
];

export function XReportPrintModal({
    isOpen,
    defaultFormat = 'thermal-80mm',
    title = 'Print X-Report',
    description = 'Choose a paper size for this report.',
    onClose,
    onPrint,
}: Props) {
    const normalizedDefault = OPTIONS.some((option) => option.value === defaultFormat) ? defaultFormat : 'thermal-80mm';
    const [format, setFormat] = useState<PrintPaperFormat>(normalizedDefault);
    const overlayStyle: CSSProperties = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(9, 10, 15, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5600,
        padding: '1rem',
    };
    const cardStyle: CSSProperties = {
        width: '100%',
        maxWidth: 420,
        background: 'var(--modal-bg, #ffffff)',
        border: '1px solid var(--modal-border, #e5e7eb)',
        borderRadius: '14px',
        padding: '1.25rem',
        boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
    };
    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={cardStyle} onClick={(event) => event.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                            {description}
                        </p>
                    </div>
                </div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                    Paper Size
                </label>
                <select
                    value={format}
                    onChange={(event) => setFormat(event.target.value as PrintPaperFormat)}
                    style={{
                        width: '100%',
                        borderRadius: '10px',
                        border: '1px solid var(--input-border, #e5e7eb)',
                        background: 'var(--input-bg, #fff)',
                        padding: '0.6rem 0.75rem',
                        fontSize: '0.9rem',
                    }}
                >
                    {OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
                    <KitchenButton variant="outline" onClick={onClose}>Cancel</KitchenButton>
                    <KitchenButton variant="primary" onClick={() => onPrint(format)}>Print</KitchenButton>
                </div>
            </div>
        </div>
    );
}
