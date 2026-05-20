import { useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import {
    FileText,
    Download,
    Plus,
    Search,
    Clock,
    CheckCircle,
    AlertCircle,
    Eye,
    CreditCard,
    Activity,
    Calendar,
    X,
    Save,
    User,
    DollarSign,
    Wallet
} from 'lucide-react';
import styles from './InvoiceManagement.module.css';

interface Invoice {
    id: string;
    clientName: string;
    packageName: string;
    amount: number;
    currency: string;
    billingCycle: 'Monthly' | 'Annually';
    dueDate: string;
    status: 'Paid' | 'Pending' | 'Overdue';
    updatedBy?: string;
    updatedAt?: string;
}

export default function InvoiceManagement() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPaidModalOpen, setIsPaidModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [paymentData, setPaymentData] = useState({
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMode: 'Cash'
    });
    const [invoices, setInvoices] = useState<Invoice[]>([]);

    const [newInvoice, setNewInvoice] = useState({
        clientName: '',
        packageName: 'Starter',
        amount: '',
        billingCycle: 'Monthly',
        dueDate: ''
    });

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.clientName.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Paid': return <CheckCircle size={14} className={styles.statusPaidIcon} />;
            case 'Pending': return <Clock size={14} className={styles.statusPendingIcon} />;
            case 'Overdue': return <AlertCircle size={14} className={styles.statusOverdueIcon} />;
            default: return null;
        }
    };

    const handleGenerateInvoice = (e: React.FormEvent) => {
        e.preventDefault();
        const invoice: Invoice = {
            id: `INV-2026-00${invoices.length + 1}`,
            clientName: newInvoice.clientName,
            packageName: newInvoice.packageName,
            amount: Number(newInvoice.amount),
            currency: 'PKR',
            billingCycle: newInvoice.billingCycle as any,
            dueDate: newInvoice.dueDate,
            status: 'Pending'
        };
        setInvoices([invoice, ...invoices]);
        setIsModalOpen(false);
        setNewInvoice({ clientName: '', packageName: 'Starter', amount: '', billingCycle: 'Monthly', dueDate: '' });
    };

    const handleMarkPaid = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        const updatedInvoices = invoices.map(inv => {
            if (inv.id === selectedInvoice.id) {
                return {
                    ...inv,
                    status: 'Paid' as const,
                    updatedBy: 'Admin',
                    updatedAt: new Date().toLocaleString()
                };
            }
            return inv;
        });

        setInvoices(updatedInvoices);
        setIsPaidModalOpen(false);
        setSelectedInvoice(null);
    };

    const stats = {
        totalReceivable: `PKR ${invoices.reduce((a, b) => a + (b.status !== 'Paid' ? b.amount : 0), 0).toLocaleString()}`,
        pendingInvoices: invoices.filter(i => i.status === 'Pending').length,
        overdueCount: invoices.filter(i => i.status === 'Overdue').length,
        collectedThisMonth: `PKR ${invoices.reduce((a, b) => a + (b.status === 'Paid' ? b.amount : 0), 0).toLocaleString()}`
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <FileText size={22} />
                    </div>
                    <div>
                        <h1>Invoice & Payments</h1>
                        <p>Manage platform subscription invoices and track payments from clients.</p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <KitchenButton variant="secondary">
                        <Download size={16} /> Export CSV
                    </KitchenButton>
                    <KitchenButton onClick={() => setIsModalOpen(true)}>
                        <Plus size={16} /> Generate Manual Invoice
                    </KitchenButton>
                </div>
            </header>

            {/* KPI Section */}
            <div className={styles.kpiGrid}>
                {/* Total Receivable */}
                <div className={`${styles.kpiCard} ${styles.kpiIndigo}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconIndigo}`}>
                                <CreditCard size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Total Receivable</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{stats.totalReceivable}</div>
                    <div className={styles.kpiMeta}>
                        <Activity size={12} /> Standard billing liquidity
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '85%' }} />
                    </div>
                </div>

                {/* Pending Invoices */}
                <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                    <div className={styles.kpiTop}>
                        <div className={styles.kpiHeaderInfo}>
                            <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                                <Clock size={18} />
                            </div>
                            <div className={styles.kpiLabel}>Pending Invoices</div>
                        </div>
                    </div>
                    <div className={styles.kpiValue}>{stats.pendingInvoices}</div>
                    <div className={styles.kpiMeta}>
                        <Calendar size={12} /> Awaiting clearance
                    </div>
                    <div className={styles.kpiProgressBar}>
                        <div className={styles.kpiProgressFill} style={{ width: '65%' }} />
                    </div>
                </div>
            </div>

            <KitchenCard className={styles.tableCard}>
                <div className={styles.tableToolbar}>
                    <div className={styles.searchWrapper}>
                        <Search size={18} className={styles.searchIcon} />
                        <KitchenInput
                            placeholder="Search by client or invoice ID..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                    <div className={styles.filters}>
                        {['All', 'Pending', 'Paid', 'Overdue'].map((status) => (
                            <button
                                key={status}
                                className={`${styles.filterBtn} ${statusFilter === status ? styles.activeFilter : ''}`}
                                onClick={() => setStatusFilter(status as any)}
                            >
                                {status === 'All' ? 'All Invoices' : status}
                            </button>
                        ))}
                    </div>
                </div>

                <KitchenTable
                    columns={[
                        { header: 'Invoice ID', key: 'id', cell: (row) => row.id },
                        { header: 'Client Name', key: 'clientName', cell: (row) => row.clientName },
                        { header: 'Package', key: 'packageName', cell: (row) => <span className={styles.packageBadge}>{row.packageName}</span> },
                        { header: 'Cycle', key: 'billingCycle', cell: (row) => row.billingCycle },
                        { header: 'Amount', key: 'amount', cell: (row) => <span>{row.currency} {row.amount.toLocaleString()}</span> },
                        { header: 'Due Date', key: 'dueDate', cell: (row) => row.dueDate },
                        {
                            header: 'Status',
                            key: 'status',
                            cell: (row) => (
                                <div className={`${styles.statusBadge} ${styles['status' + row.status]}`}>
                                    {getStatusIcon(row.status)} {row.status}
                                </div>
                            )
                        },
                        {
                            header: 'Updated By',
                            key: 'updatedBy',
                            cell: (row) => (
                                row.updatedBy ? (
                                    <div className={styles.updatedByCell}>
                                        <div className={styles.updaterInfo}>
                                            <User size={12} />
                                            <span>{row.updatedBy}</span>
                                        </div>
                                        <span className={styles.updatedAt}>{row.updatedAt}</span>
                                    </div>
                                ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                            )
                        },
                        {
                            header: 'Actions',
                            key: 'actions',
                            cell: (row) => (
                                <div className={styles.actions}>
                                    <button className={styles.actionBtn} title="View Invoice"><Eye size={16} /></button>
                                    {row.status !== 'Paid' && (
                                        <button
                                            className={`${styles.actionBtn} ${styles.markPaidIconBtn}`}
                                            title="Receive Payment"
                                            onClick={() => {
                                                setSelectedInvoice(row);
                                                setIsPaidModalOpen(true);
                                            }}
                                        >
                                            <DollarSign size={16} />
                                        </button>
                                    )}
                                </div>
                            )
                        }
                    ]}
                    data={filteredInvoices}
                />
            </KitchenCard>

            {/* Generate Invoice Modal */}
            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Generate Manual Invoice</h2>
                            <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleGenerateInvoice}>
                            <div className={styles.modalBody}>
                                <div className={styles.formField}>
                                    <label>Client Name</label>
                                    <input
                                        required
                                        className={styles.input}
                                        placeholder="Enter client name"
                                        value={newInvoice.clientName}
                                        onChange={e => setNewInvoice({ ...newInvoice, clientName: e.target.value })}
                                    />
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formField}>
                                        <label>Subscription Package</label>
                                        <select
                                            className={styles.input}
                                            value={newInvoice.packageName}
                                            onChange={e => setNewInvoice({ ...newInvoice, packageName: e.target.value })}
                                        >
                                            <option value="Starter">Starter</option>
                                            <option value="Growth">Growth</option>
                                            <option value="Professional">Professional</option>
                                            <option value="Enterprise">Enterprise</option>
                                        </select>
                                    </div>
                                    <div className={styles.formField}>
                                        <label>Amount (PKR)</label>
                                        <input
                                            required
                                            type="number"
                                            className={styles.input}
                                            placeholder="0.00"
                                            value={newInvoice.amount}
                                            onChange={e => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formField}>
                                        <label>Billing Cycle</label>
                                        <select
                                            className={styles.input}
                                            value={newInvoice.billingCycle}
                                            onChange={e => setNewInvoice({ ...newInvoice, billingCycle: e.target.value as any })}
                                        >
                                            <option value="Monthly">Monthly</option>
                                            <option value="Annually">Annually</option>
                                        </select>
                                    </div>
                                    <div className={styles.formField}>
                                        <label>Due Date</label>
                                        <input
                                            required
                                            type="date"
                                            className={styles.input}
                                            value={newInvoice.dueDate}
                                            onChange={e => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <KitchenButton variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                                    Cancel
                                </KitchenButton>
                                <KitchenButton type="submit">
                                    <Save size={16} style={{ marginRight: '6px' }} /> Generate Invoice
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Mark Paid Modal */}
            {isPaidModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Confirm Payment</h2>
                            <button className={styles.closeBtn} onClick={() => setIsPaidModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleMarkPaid}>
                            <div className={styles.modalBody}>
                                <p className={styles.modalSubtext}>
                                    Recording payment for <strong>{selectedInvoice?.id}</strong> ({selectedInvoice?.clientName})
                                </p>
                                <div className={styles.formRow}>
                                    <div className={styles.formField}>
                                        <label>Payment Date</label>
                                        <input
                                            required
                                            type="date"
                                            className={styles.input}
                                            value={paymentData.paymentDate}
                                            onChange={e => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                                        />
                                    </div>
                                    <div className={styles.formField}>
                                        <label>Payment Mode</label>
                                        <select
                                            className={styles.input}
                                            value={paymentData.paymentMode}
                                            onChange={e => setPaymentData({ ...paymentData, paymentMode: e.target.value })}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="Online">Online</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <KitchenButton variant="secondary" onClick={() => setIsPaidModalOpen(false)} type="button">
                                    Cancel
                                </KitchenButton>
                                <KitchenButton type="submit">
                                    <Wallet size={16} style={{ marginRight: '6px' }} /> Record Payment
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

