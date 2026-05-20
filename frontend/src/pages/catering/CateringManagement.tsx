/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ClipboardList,
    CookingPot,
    CreditCard,
    FileText,
    Loader2,
    Plus,
    Receipt,
    Search,
    ShoppingBasket,
    UtensilsCrossed,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cateringApi, resolveActiveBranchId } from '../../api/api';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { toast } from '../../components/ui/KitchenToast/toast';
import { usePermissionAccess } from '../../hooks/usePermissionAccess';
import styles from './CateringManagement.module.css';

type TabKey = 'inquiries' | 'quotations' | 'events';
type QuoteItemForm = {
    item_type: string;
    product_id: string;
    inventory_item_id: string;
    line_description: string;
    quantity: string;
    unit_price: string;
    supply_strategy: string;
};

const TAB_OPTIONS: Array<{ key: TabKey; label: string }> = [
    { key: 'inquiries', label: 'Inquiries' },
    { key: 'quotations', label: 'Quotations' },
    { key: 'events', label: 'Events' },
];

const EVENT_STATUS_OPTIONS = [
    { value: 'planned', label: 'Planned' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_production', label: 'In Production' },
    { value: 'ready', label: 'Ready' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const QUOTE_STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
];

const emptyQuoteItem = (): QuoteItemForm => ({
    item_type: 'product',
    product_id: '',
    inventory_item_id: '',
    line_description: '',
    quantity: '1',
    unit_price: '0',
    supply_strategy: 'produce',
});

const getCostLinkStatusLabel = (status?: string | null) => {
    switch (status) {
        case 'fully_linked':
            return 'Fully linked';
        case 'covered_with_commitments':
            return 'Covered with commitments';
        case 'partially_linked':
            return 'Partially linked';
        case 'unlinked':
            return 'Not linked yet';
        default:
            return 'No cost estimate';
    }
};

const getFollowUpStatusLabel = (status?: string | null) => {
    switch (status) {
        case 'critical':
            return 'Critical follow-up';
        case 'attention':
            return 'Attention required';
        default:
            return 'Clean';
    }
};

const getFollowUpActionLabel = (status?: string | null) => {
    switch (status) {
        case 'critical':
            return 'Immediate finance action';
        case 'attention':
            return 'Finance review';
        default:
            return 'Clean';
    }
};

const getPostingStatusLabel = (status?: string | null) => {
    switch (status) {
        case 'finance_posted':
            return 'Finance posted';
        case 'partially_posted':
            return 'Partially posted';
        case 'operational_cost_only':
            return 'Operational cost only';
        default:
            return 'No posting yet';
    }
};

export function CateringManagement() {
    const navigate = useNavigate();
    const {
        canManageCatering,
        canManagePurchaseOrders,
        canPostAccounting,
        canViewCatering,
    } = usePermissionAccess();
    const [activeTab, setActiveTab] = useState<TabKey>('inquiries');
    const [selectedBranchId, setSelectedBranchId] = useState(resolveActiveBranchId() || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [dashboard, setDashboard] = useState<any | null>(null);
    const [options, setOptions] = useState<any | null>(null);
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);
    const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState<'inquiry' | 'quotation' | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [settlementForm, setSettlementForm] = useState({
        payment_date: new Date().toISOString().slice(0, 10),
        settlement_type: 'advance',
        payment_mode: 'cash',
        amount: '',
        reference_no: '',
        notes: '',
    });
    const [billingForm, setBillingForm] = useState({
        billing_date: new Date().toISOString().slice(0, 10),
        billing_type: 'milestone',
        amount: '',
        label: '',
        notes: '',
    });
    const [inquiryForm, setInquiryForm] = useState({
        customer_id: '',
        event_title: '',
        service_type: 'offsite',
        event_date: new Date().toISOString().slice(0, 10),
        start_time: '',
        end_time: '',
        guest_count: '50',
        venue_name: '',
        venue_address: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        budget_amount: '',
        notes: '',
    });
    const [quotationForm, setQuotationForm] = useState({
        inquiry_id: '',
        valid_until: '',
        service_charge_amount: '0',
        tax_amount: '0',
        discount_amount: '0',
        notes: '',
        terms_and_conditions: '',
        items: [emptyQuoteItem()],
    });

    const branchOptions = useMemo(
        () => (options?.branches ?? []).map((branch: any) => ({ value: String(branch.id), label: branch.branch_name })),
        [options],
    );

    const activeInquiry = inquiries.find((row) => row.id === selectedInquiryId) ?? null;
    const activeEvent = events.find((row) => row.id === selectedEventId) ?? selectedEvent;
    const hasIssuedBillings = (activeEvent?.billings ?? []).length > 0;
    const settlementTypeOptions = useMemo(() => {
        const options: Array<{ value: string; label: string }> = [];
        if (!hasIssuedBillings) {
            options.push({ value: 'advance', label: 'Customer Advance / Deposit' });
        }
        if (Number(activeEvent?.unapplied_advance_amount ?? 0) > 0) {
            options.push({ value: 'advance_refund', label: 'Advance Refund' });
        }
        if (hasIssuedBillings) {
            options.push({ value: 'collection', label: 'Collection After Billing' });
        }
        if (Number(activeEvent?.collection_received_amount ?? 0) > 0) {
            options.push({ value: 'collection_refund', label: 'Collection Refund' });
        }
        if (Number(activeEvent?.billed_outstanding_amount ?? 0) > 0) {
            options.push({ value: 'write_off', label: 'AR Write-Off' });
        }
        return options;
    }, [
        activeEvent?.billed_outstanding_amount,
        activeEvent?.collection_received_amount,
        activeEvent?.unapplied_advance_amount,
        hasIssuedBillings,
    ]);
    const billingTypeOptions = [
        { value: 'deposit', label: 'Deposit Invoice' },
        { value: 'milestone', label: 'Milestone Invoice' },
        { value: 'final', label: 'Final Invoice' },
    ];
    const settlementActionLabel = useMemo(() => {
        switch (settlementForm.settlement_type) {
            case 'advance_refund':
                return 'Post Advance Refund';
            case 'collection':
                return 'Post Collection';
            case 'collection_refund':
                return 'Post Collection Refund';
            case 'write_off':
                return 'Post Write-Off';
            default:
                return 'Post Advance';
        }
    }, [settlementForm.settlement_type]);
    const canCancelEvent = Number(activeEvent?.unapplied_advance_amount ?? 0) <= 0
        && Number(activeEvent?.billed_outstanding_amount ?? 0) <= 0;
    const costLinkStatusLabel = getCostLinkStatusLabel(activeEvent?.profitability?.cost_link_status);
    const postingStatusLabel = getPostingStatusLabel(activeEvent?.profitability?.posting_status);
    const followUpStatusLabel = getFollowUpStatusLabel(activeEvent?.finance_follow_up?.revision_follow_up_status);

    const filteredRecords = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        const match = (_row: any, fields: any[]) =>
            !needle || fields.filter(Boolean).join(' ').toLowerCase().includes(needle);
        return {
            inquiries: inquiries.filter((row) => match(row, [row.inquiry_no, row.event_title, row.contact_name])),
            quotations: quotations.filter((row) => match(row, [row.quote_no, row.inquiry?.event_title, row.status])),
            events: events.filter((row) => match(row, [row.event_no, row.event_title, row.status])),
        };
    }, [events, inquiries, quotations, searchTerm]);

    const loadWorkspace = useCallback(async () => {
        if (!canViewCatering && !canManageCatering) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const branchId = selectedBranchId ? Number(selectedBranchId) : undefined;
            const [dashboardData, optionData, inquiryData, quotationData, eventData] = await Promise.all([
                cateringApi.getDashboard(),
                cateringApi.getOptions(branchId),
                cateringApi.getInquiries({ branch_id: branchId }),
                cateringApi.getQuotations({ branch_id: branchId }),
                cateringApi.getEvents({ branch_id: branchId }),
            ]);
            setDashboard(dashboardData);
            setOptions(optionData);
            setInquiries(inquiryData);
            setQuotations(quotationData);
            setEvents(eventData);
            setSelectedInquiryId((current) => current ?? inquiryData[0]?.id ?? null);
            setSelectedQuotationId((current) => current ?? quotationData[0]?.id ?? null);
            setSelectedEventId((current) => current ?? eventData[0]?.id ?? null);
        } catch (error: any) {
            toast.error('Load Failed', error?.message || 'Could not load catering workspace.');
        } finally {
            setIsLoading(false);
        }
    }, [canManageCatering, canViewCatering, selectedBranchId]);

    useEffect(() => {
        void loadWorkspace();
    }, [loadWorkspace]);

    useEffect(() => {
        const branchId = selectedBranchId ? Number(selectedBranchId) : undefined;
        if (!selectedQuotationId) {
            setSelectedQuotation(null);
            return;
        }
        cateringApi.getQuotation(selectedQuotationId, branchId).then(setSelectedQuotation).catch(() => undefined);
    }, [selectedQuotationId, selectedBranchId]);

    useEffect(() => {
        const branchId = selectedBranchId ? Number(selectedBranchId) : undefined;
        if (!selectedEventId) {
            setSelectedEvent(null);
            return;
        }
        cateringApi.getEvent(selectedEventId, branchId).then(setSelectedEvent).catch(() => undefined);
    }, [selectedEventId, selectedBranchId]);

    useEffect(() => {
        const preselectedEventId = new URLSearchParams(window.location.search).get('event_id');
        if (preselectedEventId && Number(preselectedEventId) && Number(preselectedEventId) !== selectedEventId) {
            setSelectedEventId(Number(preselectedEventId));
            setActiveTab('events');
        }
    }, [selectedEventId]);

    useEffect(() => {
        setSettlementForm((current) => {
            if (settlementTypeOptions.some((option) => option.value === current.settlement_type)) {
                return current;
            }
            return {
                ...current,
                settlement_type: settlementTypeOptions[0]?.value || 'advance',
            };
        });
    }, [settlementTypeOptions]);

    useEffect(() => {
        setBillingForm((current) => ({
            ...current,
            billing_date: activeEvent?.event_date || current.billing_date,
            billing_type: Number(activeEvent?.unbilled_amount ?? 0) <= 0 ? 'final' : current.billing_type,
        }));
    }, [activeEvent?.event_date, activeEvent?.unbilled_amount]);

    const addQuoteLine = () => {
        setQuotationForm((current) => ({ ...current, items: [...current.items, emptyQuoteItem()] }));
    };

    const updateQuoteLine = (index: number, patch: Partial<QuoteItemForm>) => {
        setQuotationForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
        }));
    };

    const openInquiryDrawer = () => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot create catering inquiries.');
            return;
        }
        setIsDrawerOpen('inquiry');
    };
    const openQuotationDrawer = () => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot prepare catering quotations.');
            return;
        }
        if (!activeInquiry) {
            toast.error('Selection Required', 'Select an inquiry before preparing a quotation.');
            return;
        }
        setQuotationForm((current) => ({ ...current, inquiry_id: String(activeInquiry.id) }));
        setIsDrawerOpen('quotation');
    };

    const saveInquiry = async () => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot create catering inquiries.');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                branch_id: selectedBranchId ? Number(selectedBranchId) : undefined,
                customer_id: inquiryForm.customer_id ? Number(inquiryForm.customer_id) : undefined,
                event_title: inquiryForm.event_title,
                service_type: inquiryForm.service_type,
                event_date: inquiryForm.event_date,
                start_time: inquiryForm.start_time || undefined,
                end_time: inquiryForm.end_time || undefined,
                guest_count: Number(inquiryForm.guest_count),
                venue_name: inquiryForm.venue_name || undefined,
                venue_address: inquiryForm.venue_address || undefined,
                contact_name: inquiryForm.contact_name || undefined,
                contact_phone: inquiryForm.contact_phone || undefined,
                contact_email: inquiryForm.contact_email || undefined,
                budget_amount: inquiryForm.budget_amount ? Number(inquiryForm.budget_amount) : undefined,
                notes: inquiryForm.notes || undefined,
            };
            const created = await cateringApi.createInquiry(payload);
            toast.success('Inquiry Captured', `${created.inquiry_no} is ready for quotation.`);
            setSelectedInquiryId(created.id);
            setIsDrawerOpen(null);
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Save Failed', error?.message || 'Could not capture catering inquiry.');
        } finally {
            setIsSaving(false);
        }
    };

    const saveQuotation = async () => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot create catering quotations.');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                inquiry_id: Number(quotationForm.inquiry_id),
                valid_until: quotationForm.valid_until || undefined,
                service_charge_amount: Number(quotationForm.service_charge_amount || 0),
                tax_amount: Number(quotationForm.tax_amount || 0),
                discount_amount: Number(quotationForm.discount_amount || 0),
                notes: quotationForm.notes || undefined,
                terms_and_conditions: quotationForm.terms_and_conditions || undefined,
                items: quotationForm.items.map((item) => ({
                    item_type: item.item_type,
                    product_id: item.product_id ? Number(item.product_id) : undefined,
                    inventory_item_id: item.inventory_item_id ? Number(item.inventory_item_id) : undefined,
                    line_description: item.line_description || undefined,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    supply_strategy: item.supply_strategy || undefined,
                })),
            };
            const created = await cateringApi.createQuotation(payload, selectedBranchId ? Number(selectedBranchId) : undefined);
            toast.success('Quotation Prepared', `${created.quote_no} is ready for review.`);
            setSelectedQuotationId(created.id);
            setIsDrawerOpen(null);
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Quotation Failed', error?.message || 'Could not create quotation.');
        } finally {
            setIsSaving(false);
        }
    };

    const submitQuotationStatus = async (status: string) => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot update quotation status.');
            return;
        }
        if (!selectedQuotationId) return;
        try {
            await cateringApi.updateQuotationStatus(selectedQuotationId, { status }, selectedBranchId ? Number(selectedBranchId) : undefined);
            toast.success('Quotation Updated', `Quotation marked ${status.replace('_', ' ')}.`);
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Status Failed', error?.message || 'Could not update quotation status.');
        }
    };

    const convertQuotation = async () => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot convert quotations into events.');
            return;
        }
        if (!selectedQuotationId) return;
        try {
            const event = await cateringApi.convertQuotation(
                selectedQuotationId,
                { execution_branch_id: selectedBranchId ? Number(selectedBranchId) : undefined },
                selectedBranchId ? Number(selectedBranchId) : undefined,
            );
            toast.success('Event Created', `${event.event_no} is now planned.`);
            setSelectedEventId(event.id);
            setActiveTab('events');
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Conversion Failed', error?.message || 'Could not create event from quotation.');
        }
    };

    const updateEventStatus = async (status: string) => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot update catering event status.');
            return;
        }
        if (!selectedEventId) return;
        try {
            const event = await cateringApi.updateEventStatus(
                selectedEventId,
                { status },
                selectedBranchId ? Number(selectedBranchId) : undefined,
            );
            setSelectedEvent(event);
            toast.success('Event Updated', `Event marked ${status.replace('_', ' ')}.`);
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Event Failed', error?.message || 'Could not update event status.');
        }
    };

    const issueEventBilling = async () => {
        if (!canManageCatering || !canPostAccounting) {
            toast.error('Access Denied', 'Your current role cannot issue catering billings.');
            return;
        }
        if (!selectedEventId) return;
        try {
            const event = await cateringApi.issueEventBilling(
                selectedEventId,
                {
                    branch_id: selectedBranchId ? Number(selectedBranchId) : undefined,
                    billing_date: billingForm.billing_date,
                    billing_type: billingForm.billing_type,
                    amount: Number(billingForm.amount),
                    label: billingForm.label || undefined,
                    notes: billingForm.notes || undefined,
                },
                selectedBranchId ? Number(selectedBranchId) : undefined,
            );
            setSelectedEvent(event);
            setBillingForm((current) => ({
                ...current,
                amount: '',
                label: '',
                notes: '',
            }));
            toast.success('Billing Issued', 'Milestone invoice posted into receivables.');
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Billing Failed', error?.message || 'Could not issue event billing.');
        }
    };

    const createProcurement = async () => {
        if (!canManageCatering || !canManagePurchaseOrders) {
            toast.error('Access Denied', 'Your current role cannot raise procurement from catering events.');
            return;
        }
        if (!selectedEventId) return;
        try {
            await cateringApi.createEventProcurement(
                selectedEventId,
                { destination_branch_id: selectedBranchId ? Number(selectedBranchId) : undefined },
                selectedBranchId ? Number(selectedBranchId) : undefined,
            );
            toast.success('Procurement Linked', 'Event demand was pushed into procurement.');
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Procurement Failed', error?.message || 'Could not create procurement request.');
        }
    };

    const createProduction = async () => {
        if (!canManageCatering) {
            toast.error('Access Denied', 'Your current role cannot create production from catering events.');
            return;
        }
        if (!selectedEventId) return;
        try {
            await cateringApi.createEventProduction(
                selectedEventId,
                { source_branch_id: selectedBranchId ? Number(selectedBranchId) : undefined },
                selectedBranchId ? Number(selectedBranchId) : undefined,
            );
            toast.success('Production Linked', 'Kitchen production requests were created.');
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Production Failed', error?.message || 'Could not create production orders.');
        }
    };

    const recordSettlement = async () => {
        if (!canManageCatering || !canPostAccounting) {
            toast.error('Access Denied', 'Your current role cannot post catering settlements.');
            return;
        }
        if (!selectedEventId) return;
        try {
            const updated = await cateringApi.recordSettlement(
                selectedEventId,
                {
                    branch_id: selectedBranchId ? Number(selectedBranchId) : undefined,
                    payment_date: settlementForm.payment_date,
                    settlement_type: settlementForm.settlement_type,
                    payment_mode: settlementForm.payment_mode,
                    amount: Number(settlementForm.amount),
                    reference_no: settlementForm.reference_no || undefined,
                    notes: settlementForm.notes || undefined,
                },
                selectedBranchId ? Number(selectedBranchId) : undefined,
            );
            setSelectedEvent(updated);
            setSettlementForm((current) => ({
                ...current,
                settlement_type: (
                    Number(updated?.unapplied_advance_amount ?? 0) > 0
                        ? 'advance_refund'
                        : (updated?.billings ?? []).length > 0
                            ? 'collection'
                            : 'advance'
                ),
                amount: '',
                reference_no: '',
                notes: '',
            }));
            toast.success('Settlement Posted', `${settlementActionLabel} recorded and posted into accounting.`);
            await loadWorkspace();
        } catch (error: any) {
            toast.error('Settlement Failed', error?.message || 'Could not record settlement.');
        }
    };

    const renderInquiryList = () => (
        <div className={styles.recordList}>
            {filteredRecords.inquiries.map((row) => (
                <button
                    key={row.id}
                    className={`${styles.recordButton} ${selectedInquiryId === row.id ? styles.recordButtonActive : ''}`}
                    onClick={() => setSelectedInquiryId(row.id)}
                >
                    <strong>{row.inquiry_no}</strong>
                    <span>{row.event_title}</span>
                    <small>{getFollowUpActionLabel(row.finance_follow_up?.revision_follow_up_status)} - {row.finance_follow_up?.revision_follow_up_action || 'No pending finance follow-up.'}</small>
                    <small>{row.event_date} • {row.guest_count} pax</small>
                </button>
            ))}
        </div>
    );

    const renderQuotationList = () => (
        <div className={styles.recordList}>
            {filteredRecords.quotations.map((row) => (
                <button
                    key={row.id}
                    className={`${styles.recordButton} ${selectedQuotationId === row.id ? styles.recordButtonActive : ''}`}
                    onClick={() => setSelectedQuotationId(row.id)}
                >
                    <strong>{row.quote_no}</strong>
                    <span>{row.inquiry?.event_title}</span>
                    <small>{row.status} • PKR {Number(row.total_amount ?? 0).toLocaleString()}</small>
                </button>
            ))}
        </div>
    );

    const renderEventList = () => (
        <div className={styles.recordList}>
            {filteredRecords.events.map((row) => (
                <button
                    key={row.id}
                    className={`${styles.recordButton} ${selectedEventId === row.id ? styles.recordButtonActive : ''}`}
                    onClick={() => setSelectedEventId(row.id)}
                >
                    <strong>{row.event_no}</strong>
                    <small>{getPostingStatusLabel(row.profitability?.posting_status)} / {row.profitability?.posting_note || 'No event cost posting note available.'}</small>
                    <span>{row.event_title}</span>
                    <small>{row.status} • Outstanding PKR {Number(row.outstanding_amount ?? 0).toLocaleString()}</small>
                </button>
            ))}
        </div>
    );

    if (!canViewCatering && !canManageCatering) {
        return (
            <div className={styles.page}>
                <KitchenCard className={styles.detailCard}>
                    Your current role does not have access to catering and event management.
                </KitchenCard>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1>Catering & Event Management</h1>
                    <p>Capture inquiries, prepare cost-aware quotations, convert them into executable events, and post settlement safely.</p>
                </div>
                <div className={styles.headerActions}>
                    <KitchenSelect
                        options={branchOptions.length ? branchOptions : [{ value: '', label: 'All accessible branches' }]}
                        value={selectedBranchId}
                        onChange={(event) => setSelectedBranchId(event.target.value)}
                        className={styles.branchSelect}
                    />
                    {canManageCatering && (
                        <>
                            <KitchenButton variant="outline" onClick={openInquiryDrawer}>
                                <Plus size={16} />
                                New Inquiry
                            </KitchenButton>
                            <KitchenButton variant="primary" onClick={openQuotationDrawer}>
                                <Receipt size={16} />
                                New Quote
                            </KitchenButton>
                        </>
                    )}
                </div>
            </header>

            <section className={styles.metricsGrid}>
                <KitchenCard className={styles.metricCard}>
                    <ClipboardList size={18} />
                    <div><span>Open Inquiries</span><strong>{dashboard?.inquiries?.open ?? 0}</strong></div>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <FileText size={18} />
                    <div><span>Approved Quotes</span><strong>{dashboard?.quotations?.approved ?? 0}</strong></div>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <UtensilsCrossed size={18} />
                    <div><span>Active Events</span><strong>{(dashboard?.events?.confirmed ?? 0) + (dashboard?.events?.in_production ?? 0) + (dashboard?.events?.ready ?? 0)}</strong></div>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <CreditCard size={18} />
                    <div><span>Outstanding</span><strong>PKR {Number(dashboard?.financials?.outstanding_total ?? 0).toLocaleString()}</strong></div>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <Receipt size={18} />
                    <div><span>Critical Event Follow-Up</span><strong>{dashboard?.finance_priority?.critical_event_count ?? 0}</strong></div>
                </KitchenCard>
                <KitchenCard className={styles.metricCard}>
                    <FileText size={18} />
                    <div><span>Attention Event Follow-Up</span><strong>{dashboard?.finance_priority?.attention_event_count ?? 0}</strong></div>
                </KitchenCard>
            </section>

            {(dashboard?.finance_priority?.top_priority_event || (dashboard?.finance_priority?.priority_events ?? []).length > 0) ? (
                <KitchenCard className={styles.detailStack}>
                    <div className={styles.titleRow}>
                        <div>
                            <h2>Event Finance Priority</h2>
                            <p>Use this queue to catch unsettled or finance-sensitive events before delivery close.</p>
                        </div>
                    </div>
                    {dashboard?.finance_priority?.top_priority_event ? (
                        <div className={styles.followUpBanner}>
                            <strong>{getFollowUpStatusLabel(dashboard.finance_priority.top_priority_event.revision_follow_up_status)} - {dashboard.finance_priority.top_priority_event.event_no}</strong>
                            <span>{dashboard.finance_priority.top_priority_event.revision_follow_up_action} / {dashboard.finance_priority.top_priority_event.posting_note || 'No event cost posting note available.'}</span>
                        </div>
                    ) : null}
                    <div className={styles.lineList}>
                        {(dashboard?.finance_priority?.priority_events ?? []).map((event: any) => (
                            <button
                                key={event.id}
                                className={styles.recordButton}
                                onClick={() => {
                                    setActiveTab('events');
                                    setSelectedEventId(event.id);
                                }}
                            >
                                <strong>{event.event_no} - {event.event_title}</strong>
                                <span>{getFollowUpStatusLabel(event.revision_follow_up_status)} - {event.status} - {event.event_date}</span>
                                <small>Outstanding PKR {Number(event.outstanding_amount ?? 0).toLocaleString()} - {event.revision_follow_up_action}</small>
                                <small>{getPostingStatusLabel(event.posting_status)} - {event.posting_note || 'No event cost posting note available.'}</small>
                            </button>
                        ))}
                    </div>
                </KitchenCard>
            ) : null}

            <KitchenCard className={styles.toolbar}>
                <div className={styles.tabRow}>
                    {TAB_OPTIONS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <KitchenInput
                    placeholder="Search inquiry no, quote no, event no, or title..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    icon={<Search size={16} />}
                    containerClassName={styles.searchInput}
                />
            </KitchenCard>

            {isLoading ? (
                <KitchenCard className={styles.loadingCard}>
                    <Loader2 className={styles.spinner} />
                    <p>Loading catering workspace...</p>
                </KitchenCard>
            ) : (
                <section className={styles.workspace}>
                    <KitchenCard className={styles.listPane}>
                        <h2>{TAB_OPTIONS.find((tab) => tab.key === activeTab)?.label}</h2>
                        {activeTab === 'inquiries' ? renderInquiryList() : null}
                        {activeTab === 'quotations' ? renderQuotationList() : null}
                        {activeTab === 'events' ? renderEventList() : null}
                    </KitchenCard>

                    <KitchenCard className={styles.detailPane}>
                        {activeTab === 'inquiries' && activeInquiry ? (
                            <div className={styles.detailStack}>
                                <h2>{activeInquiry.event_title}</h2>
                                <p>{activeInquiry.inquiry_no} • {activeInquiry.service_type} • {activeInquiry.event_date}</p>
                                <div className={styles.infoGrid}>
                                    <div><span>Guest Count</span><strong>{activeInquiry.guest_count}</strong></div>
                                    <div><span>Venue</span><strong>{activeInquiry.venue_name || 'Pending'}</strong></div>
                                    <div><span>Contact</span><strong>{activeInquiry.contact_name || 'Pending'}</strong></div>
                                    <div><span>Budget</span><strong>PKR {Number(activeInquiry.budget_amount ?? 0).toLocaleString()}</strong></div>
                                </div>
                                {canManageCatering && (
                                    <KitchenButton variant="primary" onClick={openQuotationDrawer}>
                                        Prepare Quotation
                                    </KitchenButton>
                                )}
                            </div>
                        ) : null}

                        {activeTab === 'quotations' && selectedQuotation ? (
                            <div className={styles.detailStack}>
                                <div className={styles.titleRow}>
                                    <div>
                                        <h2>{selectedQuotation.quote_no}</h2>
                                        <p>{selectedQuotation.inquiry?.event_title} • {selectedQuotation.status}</p>
                                    </div>
                                    <strong>PKR {Number(selectedQuotation.total_amount ?? 0).toLocaleString()}</strong>
                                </div>
                                <div className={styles.actionRow}>
                                    {canManageCatering && QUOTE_STATUS_OPTIONS.filter((option) => option.value !== selectedQuotation.status && option.value !== 'converted').map((option) => (
                                        <KitchenButton key={option.value} variant="outline" size="sm" onClick={() => submitQuotationStatus(option.value)}>
                                            {option.label}
                                        </KitchenButton>
                                    ))}
                                    {canManageCatering && selectedQuotation.status === 'approved' ? (
                                        <KitchenButton variant="primary" size="sm" onClick={convertQuotation}>
                                            Convert To Event
                                        </KitchenButton>
                                    ) : null}
                                </div>
                                <div className={styles.lineList}>
                                    {(selectedQuotation.items ?? []).map((item: any) => (
                                        <div key={item.id} className={styles.lineRow}>
                                            <div>
                                                <strong>{item.line_description}</strong>
                                                <small>{item.supply_strategy} • cost PKR {Number(item.estimated_total_cost ?? 0).toLocaleString()}</small>
                                            </div>
                                            <strong>{Number(item.quantity ?? 0)} x PKR {Number(item.unit_price ?? 0).toLocaleString()}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {activeTab === 'events' && activeEvent ? (
                            <div className={styles.detailStack}>
                                <div className={styles.titleRow}>
                                    <div>
                                        <h2>{activeEvent.event_no}</h2>
                                        <p>{activeEvent.event_title} • {activeEvent.event_date}</p>
                                    </div>
                                    <strong>Outstanding PKR {Number(activeEvent.outstanding_amount ?? 0).toLocaleString()}</strong>
                                </div>
                                    <div className={styles.actionRow}>
                                        {canManageCatering && EVENT_STATUS_OPTIONS.filter((option) => option.value !== activeEvent.status).map((option) => (
                                        <KitchenButton
                                            key={option.value}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateEventStatus(option.value)}
                                            disabled={option.value === 'cancelled' && !canCancelEvent}
                                        >
                                            {option.label}
                                        </KitchenButton>
                                    ))}
                                </div>
                                <div className={styles.actionRow}>
                                    {canManageCatering && canManagePurchaseOrders && (
                                    <KitchenButton variant="outline" size="sm" onClick={createProcurement}>
                                        <ShoppingBasket size={14} />
                                        Raise Procurement
                                    </KitchenButton>
                                    )}
                                    {canManageCatering && (
                                    <KitchenButton variant="outline" size="sm" onClick={createProduction}>
                                        <CookingPot size={14} />
                                        Create Production
                                    </KitchenButton>
                                    )}
                                    <KitchenButton
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/console/accounting/event-receivables?event_id=${activeEvent.id}${selectedBranchId ? `&branch_id=${selectedBranchId}` : ''}`)}
                                    >
                                        <CreditCard size={14} />
                                        Event Collections
                                    </KitchenButton>
                                </div>
                                <div className={styles.followUpBanner}>
                                    <strong>{followUpStatusLabel}</strong>
                                    <span>{activeEvent.finance_follow_up?.revision_follow_up_action || 'No pending finance follow-up.'}</span>
                                </div>
                                <div className={styles.infoGrid}>
                                    <div><span>Execution Branch</span><strong>{activeEvent.execution_branch?.branch_name || 'Not set'}</strong></div>
                                    <div><span>Production Branch</span><strong>{activeEvent.production_branch?.branch_name || 'Not set'}</strong></div>
                                    <div><span>Total Event Value</span><strong>PKR {Number(activeEvent.actual_total_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Paid</span><strong>PKR {Number(activeEvent.total_paid_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Billed To Customer</span><strong>PKR {Number(activeEvent.billed_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Unbilled Balance</span><strong>PKR {Number(activeEvent.unbilled_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Billed Outstanding</span><strong>PKR {Number(activeEvent.billed_outstanding_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Customer Advance</span><strong>PKR {Number(activeEvent.advance_received_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Post-Billing Collection</span><strong>PKR {Number(activeEvent.collection_received_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Refunds</span><strong>PKR {Number(activeEvent.refund_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Write-Offs</span><strong>PKR {Number(activeEvent.write_off_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Unapplied Advance</span><strong>PKR {Number(activeEvent.unapplied_advance_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Estimated Cost</span><strong>PKR {Number(activeEvent.estimated_cost_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Actual Linked Cost</span><strong>PKR {Number(activeEvent.profitability?.total_actual_cost ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Procurement Cost</span><strong>PKR {Number(activeEvent.profitability?.actual_procurement_cost ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Production Cost</span><strong>PKR {Number(activeEvent.profitability?.actual_production_cost ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Open Procurement Commitments</span><strong>PKR {Number(activeEvent.profitability?.open_committed_procurement_cost ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Cost Link Status</span><strong>{costLinkStatusLabel}</strong></div>
                                    <div><span>Posting Status</span><strong>{postingStatusLabel}</strong></div>
                                    <div><span>Linked / Covered Cost</span><strong>{Number(activeEvent.profitability?.linked_cost_coverage_percent ?? 0).toFixed(1)}% linked / {Number(activeEvent.profitability?.committed_cost_coverage_percent ?? 0).toFixed(1)}% covered</strong></div>
                                    <div><span>Finance-Posted Cost</span><strong>PKR {Number(activeEvent.profitability?.finance_posted_cost_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Operational-Only Cost</span><strong>PKR {Number(activeEvent.profitability?.operational_only_cost_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Cost Variance</span><strong>PKR {Number(activeEvent.profitability?.cost_variance_amount ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Estimated Gross Margin</span><strong>PKR {Number(activeEvent.profitability?.estimated_gross_margin ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Realized Gross Margin</span><strong>PKR {Number(activeEvent.profitability?.realized_gross_margin ?? 0).toLocaleString()}</strong></div>
                                    <div><span>Margin / Collection</span><strong>{Number(activeEvent.profitability?.estimated_margin_percent ?? 0).toFixed(1)}% est. / {Number(activeEvent.profitability?.realized_margin_percent ?? 0).toFixed(1)}% actual / {Number(activeEvent.profitability?.collection_percent ?? 0).toFixed(1)}% collection</strong></div>
                                </div>
                                <div className={styles.lineList}>
                                    {(activeEvent.items ?? []).map((item: any) => (
                                        <div key={item.id} className={styles.lineRow}>
                                            <div>
                                                <strong>{item.line_description}</strong>
                                                <small>{item.supply_strategy} • est. cost PKR {Number(item.estimated_total_cost ?? 0).toLocaleString()}</small>
                                            </div>
                                            <strong>{Number(item.quantity ?? 0)} x PKR {Number(item.unit_price ?? 0).toLocaleString()}</strong>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.sectionTitle}>Cost Control</div>
                                <div className={styles.costGrid}>
                                    <div className={styles.costCard}>
                                        <span>Estimated Event Cost</span>
                                        <strong>PKR {Number(activeEvent.estimated_cost_amount ?? 0).toLocaleString()}</strong>
                                        <small>Quoted recipe and procurement estimate.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Actual Linked Cost</span>
                                        <strong>PKR {Number(activeEvent.profitability?.total_actual_cost ?? 0).toLocaleString()}</strong>
                                        <small>Live from linked GRNs and production material consumption.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Committed Procurement</span>
                                        <strong>PKR {Number(activeEvent.profitability?.committed_procurement_cost ?? 0).toLocaleString()}</strong>
                                        <small>PO commitment raised for the event.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Open Procurement Commitment</span>
                                        <strong>PKR {Number(activeEvent.profitability?.open_committed_procurement_cost ?? 0).toLocaleString()}</strong>
                                        <small>Ordered but not yet received into actual cost.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Cost Link Coverage</span>
                                        <strong>{Number(activeEvent.profitability?.linked_cost_coverage_percent ?? 0).toFixed(1)}% linked</strong>
                                        <small>{Number(activeEvent.profitability?.committed_cost_coverage_percent ?? 0).toFixed(1)}% covered after open commitments.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Unlinked Cost Gap</span>
                                        <strong>PKR {Number(activeEvent.profitability?.unlinked_cost_gap_amount ?? 0).toLocaleString()}</strong>
                                        <small>{costLinkStatusLabel} • {Number(activeEvent.profitability?.open_procurement_link_count ?? 0)} procurement links still open.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Cost Trace Depth</span>
                                        <strong>{Number(activeEvent.profitability?.procurement_link_count ?? 0)} procurement / {Number(activeEvent.profitability?.production_link_count ?? 0)} production</strong>
                                        <small>Use this to judge whether realized margin is fully backed by linked cost activity.</small>
                                    </div>
                                </div>
                                <div className={styles.sectionTitle}>Finance Posting Maturity</div>
                                <div className={styles.costGrid}>
                                    <div className={styles.costCard}>
                                        <span>Finance-Posted Cost</span>
                                        <strong>PKR {Number(activeEvent.profitability?.finance_posted_cost_amount ?? 0).toLocaleString()}</strong>
                                        <small>Linked procurement receipt cost already reflected in finance journals.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Operational-Only Cost</span>
                                        <strong>PKR {Number(activeEvent.profitability?.operational_only_cost_amount ?? 0).toLocaleString()}</strong>
                                        <small>Production material consumption cost is still operationally costed for this event.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Posting Coverage</span>
                                        <strong>{Number(activeEvent.profitability?.finance_posted_cost_coverage_percent ?? 0).toFixed(1)}%</strong>
                                        <small>{postingStatusLabel} • gap PKR {Number(activeEvent.profitability?.posting_gap_amount ?? 0).toLocaleString()}</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Supporting Cost Documents</span>
                                        <strong>{Number(activeEvent.profitability?.procurement_grn_count ?? 0)} GRNs / {Number(activeEvent.profitability?.cost_journal_entry_count ?? 0)} journals</strong>
                                        <small>{activeEvent.profitability?.latest_cost_posted_at ? `Latest cost posted ${activeEvent.profitability.latest_cost_posted_at}` : 'No finance-posted procurement receipt yet.'}</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Production Cost Links</span>
                                        <strong>{Number(activeEvent.profitability?.production_operational_link_count ?? 0)} live link(s)</strong>
                                        <small>These links support operational cost trace, not a direct event finance posting.</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Posting Note</span>
                                        <strong>{postingStatusLabel}</strong>
                                        <small>{activeEvent.profitability?.posting_note || 'No event cost posting note available.'}</small>
                                    </div>
                                </div>
                                <div className={styles.sectionTitle}>Finance Follow-Up</div>
                                <div className={styles.costGrid}>
                                    <div className={styles.costCard}>
                                        <span>Cancellation Readiness</span>
                                        <strong>{activeEvent.finance_follow_up?.cancellation_ready ? 'Ready' : 'Blocked'}</strong>
                                        <small>{activeEvent.finance_follow_up?.cancellation_ready ? 'Finance is clear for cancellation if operations decide to cancel.' : 'Finance items still need to be cleared before cancellation.'}</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Billing Revision Exposure</span>
                                        <strong>{activeEvent.finance_follow_up?.has_billed_revision_exposure ? 'Open' : 'Clean'}</strong>
                                        <small>{activeEvent.finance_follow_up?.has_billed_revision_exposure ? 'Issued billing exists while event value is still unbilled after change.' : 'No mixed billed vs unbilled revision gap detected.'}</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Collection Exposure</span>
                                        <strong>{activeEvent.finance_follow_up?.has_collection_exposure ? 'Open' : 'Clean'}</strong>
                                        <small>{activeEvent.finance_follow_up?.has_collection_exposure ? 'Outstanding receivable or unapplied advance still needs settlement follow-up.' : 'No collection follow-up is currently blocking clean close.'}</small>
                                    </div>
                                    <div className={styles.costCard}>
                                        <span>Cost Follow-Up</span>
                                        <strong>{activeEvent.finance_follow_up?.has_cost_follow_up ? 'Open' : 'Clean'}</strong>
                                        <small>{activeEvent.finance_follow_up?.has_cost_follow_up ? 'Open commitments or unlinked cost remain after the latest event scope.' : 'Cost linkage is materially in line with current event scope.'}</small>
                                    </div>
                                </div>
                                {(activeEvent.finance_follow_up?.cancellation_blockers ?? []).length > 0 ? (
                                    <div className={styles.lineList}>
                                        {(activeEvent.finance_follow_up?.cancellation_blockers ?? []).map((blocker: string) => (
                                            <div key={blocker} className={styles.lineRow}>
                                                <div>
                                                    <strong>Cancellation Blocker</strong>
                                                    <small>{blocker}</small>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <div className={styles.sectionTitle}>Linked Cost Activity</div>
                                <div className={styles.linkedCostColumns}>
                                    <div className={styles.lineList}>
                                        <div className={styles.subSectionTitle}>Procurement Links</div>
                                        {(activeEvent.procurement_links ?? []).length === 0 ? (
                                            <div className={styles.lineRow}>
                                                <div>
                                                    <strong>No procurement links yet</strong>
                                                    <small>Procurement requests and receipts tied to the event will appear here.</small>
                                                </div>
                                            </div>
                                        ) : (activeEvent.procurement_links ?? []).map((link: any) => (
                                            <div key={link.id} className={styles.lineRow}>
                                                <div>
                                                    <strong>{link.request_no || `Request #${link.procurement_request_id}`}</strong>
                                                    <small>{Number(link.grn_count ?? 0)} GRNs / {Number(link.journal_entry_count ?? 0)} journals / {getPostingStatusLabel(link.finance_posting_status)}</small>
                                                    <small>{link.po_number || 'No PO yet'} · {link.request_status || 'pending'} / {link.po_status || 'not ordered'}</small>
                                                </div>
                                                <div className={styles.billingAmounts}>
                                                    <strong>PKR {Number(link.actual_cost_amount ?? 0).toLocaleString()}</strong>
                                                    <small>Committed PKR {Number(link.committed_cost_amount ?? 0).toLocaleString()}</small>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={styles.lineList}>
                                        <div className={styles.subSectionTitle}>Production Links</div>
                                        {(activeEvent.production_links ?? []).length === 0 ? (
                                            <div className={styles.lineRow}>
                                                <div>
                                                    <strong>No production links yet</strong>
                                                    <small>Kitchen production orders tied to the event will appear here.</small>
                                                </div>
                                            </div>
                                        ) : (activeEvent.production_links ?? []).map((link: any) => (
                                            <div key={link.id} className={styles.lineRow}>
                                                <div>
                                                    <strong>{link.production_no || `Production #${link.production_order_id}`}</strong>
                                                    <small>{getPostingStatusLabel(link.finance_posting_status)} / operational production cost trace</small>
                                                    <small>{link.production_status || 'requested'} · Output {Number(link.actual_quantity ?? 0).toLocaleString()}</small>
                                                </div>
                                                <div className={styles.billingAmounts}>
                                                    <strong>PKR {Number(link.total_consumed_cost ?? 0).toLocaleString()}</strong>
                                                    <small>Unit PKR {Number(link.output_unit_cost ?? 0).toLocaleString()}</small>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className={styles.sectionTitle}>Staged Billing</div>
                                <div className={styles.billingGrid}>
                                    <KitchenInput type="date" label="Billing Date" value={billingForm.billing_date} onChange={(event) => setBillingForm((current) => ({ ...current, billing_date: event.target.value }))} />
                                    <KitchenSelect label="Billing Type" value={billingForm.billing_type} onChange={(event) => setBillingForm((current) => ({ ...current, billing_type: event.target.value }))} options={billingTypeOptions} />
                                    <KitchenInput type="number" label="Invoice Amount" value={billingForm.amount} onChange={(event) => setBillingForm((current) => ({ ...current, amount: event.target.value }))} />
                                    <KitchenInput label="Label" value={billingForm.label} onChange={(event) => setBillingForm((current) => ({ ...current, label: event.target.value }))} />
                                </div>
                                <label className={styles.notesField}>
                                    Billing Notes
                                    <textarea value={billingForm.notes} onChange={(event) => setBillingForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
                                </label>
                                {canManageCatering && canPostAccounting && (
                                <KitchenButton variant="primary" onClick={issueEventBilling} disabled={Number(activeEvent.unbilled_amount ?? 0) <= 0}>
                                    <Receipt size={14} />
                                    {Number(activeEvent.unbilled_amount ?? 0) <= 0 ? 'Fully Billed' : 'Issue Billing Milestone'}
                                </KitchenButton>
                                )}
                                <div className={styles.sectionTitle}>Billing History</div>
                                <div className={styles.lineList}>
                                    {(activeEvent.billings ?? []).length === 0 ? (
                                        <div className={styles.lineRow}>
                                            <div>
                                                <strong>No billing milestones yet</strong>
                                                <small>Use milestone invoices to bill the event in stages instead of a single final receivable.</small>
                                            </div>
                                        </div>
                                    ) : (activeEvent.billings ?? []).map((billing: any) => (
                                        <div key={billing.id} className={styles.lineRow}>
                                            <div>
                                                <strong>{billing.label || billing.billing_type} · {billing.status}</strong>
                                                <small>{billing.billing_date} · Advance Applied PKR {Number(billing.applied_advance_amount ?? 0).toLocaleString()} · Collected PKR {Number(billing.collected_amount ?? 0).toLocaleString()} · Write-Off PKR {Number(billing.write_off_amount ?? 0).toLocaleString()} · JE {billing.accounting_journal_entry_id || 'Pending'}</small>
                                            </div>
                                            <div className={styles.billingAmounts}>
                                                <strong>PKR {Number(billing.amount ?? 0).toLocaleString()}</strong>
                                                <small>Open PKR {Number(billing.outstanding_amount ?? 0).toLocaleString()}</small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.sectionTitle}>Settlement</div>
                                <div className={styles.settlementGrid}>
                                    <KitchenInput type="date" label="Payment Date" value={settlementForm.payment_date} onChange={(event) => setSettlementForm((current) => ({ ...current, payment_date: event.target.value }))} />
                                    <KitchenSelect label="Entry Type" value={settlementForm.settlement_type} onChange={(event) => setSettlementForm((current) => ({ ...current, settlement_type: event.target.value }))} options={settlementTypeOptions} />
                                    <KitchenSelect label="Mode" value={settlementForm.payment_mode} onChange={(event) => setSettlementForm((current) => ({ ...current, payment_mode: event.target.value }))} options={[
                                        { value: 'cash', label: 'Cash' },
                                        { value: 'bank', label: 'Bank' },
                                        { value: 'card', label: 'Card' },
                                        { value: 'online', label: 'Online' },
                                        { value: 'cheque', label: 'Cheque' },
                                        { value: 'other', label: 'Other' },
                                    ]} />
                                    <KitchenInput type="number" label="Amount" value={settlementForm.amount} onChange={(event) => setSettlementForm((current) => ({ ...current, amount: event.target.value }))} />
                                    <KitchenInput label="Reference" value={settlementForm.reference_no} onChange={(event) => setSettlementForm((current) => ({ ...current, reference_no: event.target.value }))} />
                                </div>
                                <label className={styles.notesField}>
                                    Notes
                                    <textarea value={settlementForm.notes} onChange={(event) => setSettlementForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
                                </label>
                                {canManageCatering && canPostAccounting && (
                                <KitchenButton variant="primary" onClick={recordSettlement}>
                                    {settlementActionLabel}
                                </KitchenButton>
                                )}
                                <div className={styles.sectionTitle}>Receipts & Settlement History</div>
                                <div className={styles.lineList}>
                                    {(activeEvent.settlements ?? []).length === 0 ? (
                                        <div className={styles.lineRow}>
                                            <div>
                                                <strong>No receipts recorded yet</strong>
                                                <small>Customer advances, refunds, collections, and write-offs will appear here.</small>
                                            </div>
                                        </div>
                                    ) : (activeEvent.settlements ?? []).map((settlement: any) => (
                                        <div key={settlement.id} className={styles.lineRow}>
                                            <div>
                                                <strong>{
                                                    settlement.settlement_type === 'advance'
                                                        ? 'Advance / Deposit'
                                                        : settlement.settlement_type === 'advance_refund'
                                                            ? 'Advance Refund'
                                                            : settlement.settlement_type === 'collection_refund'
                                                                ? 'Collection Refund'
                                                                : settlement.settlement_type === 'write_off'
                                                                    ? 'AR Write-Off'
                                                                    : 'Collection'
                                                } · {settlement.payment_mode}</strong>
                                                <small>{settlement.payment_date} · Ref {settlement.reference_no || 'N/A'} · JE {settlement.accounting_journal_entry_id || 'Pending'}</small>
                                            </div>
                                            <strong>PKR {Number(settlement.amount ?? 0).toLocaleString()}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </KitchenCard>
                </section>
            )}

            {isDrawerOpen === 'inquiry' ? (
                <div className={styles.modalOverlay} onClick={() => setIsDrawerOpen(null)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <h2>Capture Catering Inquiry</h2>
                        <div className={styles.formGrid}>
                            <KitchenSelect label="Customer" value={inquiryForm.customer_id} onChange={(event) => setInquiryForm((current) => ({ ...current, customer_id: event.target.value }))} options={[{ value: '', label: 'Walk-in / Prospect' }, ...((options?.customers ?? []).map((customer: any) => ({ value: String(customer.id), label: customer.name })))]} />
                            <KitchenInput label="Event Title" value={inquiryForm.event_title} onChange={(event) => setInquiryForm((current) => ({ ...current, event_title: event.target.value }))} />
                            <KitchenSelect label="Service Type" value={inquiryForm.service_type} onChange={(event) => setInquiryForm((current) => ({ ...current, service_type: event.target.value }))} options={[
                                { value: 'offsite', label: 'Offsite' },
                                { value: 'on_premise', label: 'On Premise' },
                                { value: 'delivery', label: 'Delivery' },
                                { value: 'pickup', label: 'Pickup' },
                            ]} />
                            <KitchenInput label="Event Date" type="date" value={inquiryForm.event_date} onChange={(event) => setInquiryForm((current) => ({ ...current, event_date: event.target.value }))} />
                            <KitchenInput label="Start Time" type="time" value={inquiryForm.start_time} onChange={(event) => setInquiryForm((current) => ({ ...current, start_time: event.target.value }))} />
                            <KitchenInput label="End Time" type="time" value={inquiryForm.end_time} onChange={(event) => setInquiryForm((current) => ({ ...current, end_time: event.target.value }))} />
                            <KitchenInput label="Guest Count" type="number" value={inquiryForm.guest_count} onChange={(event) => setInquiryForm((current) => ({ ...current, guest_count: event.target.value }))} />
                            <KitchenInput label="Budget" type="number" value={inquiryForm.budget_amount} onChange={(event) => setInquiryForm((current) => ({ ...current, budget_amount: event.target.value }))} />
                            <KitchenInput label="Venue Name" value={inquiryForm.venue_name} onChange={(event) => setInquiryForm((current) => ({ ...current, venue_name: event.target.value }))} />
                            <KitchenInput label="Contact Name" value={inquiryForm.contact_name} onChange={(event) => setInquiryForm((current) => ({ ...current, contact_name: event.target.value }))} />
                            <KitchenInput label="Contact Phone" value={inquiryForm.contact_phone} onChange={(event) => setInquiryForm((current) => ({ ...current, contact_phone: event.target.value }))} />
                            <KitchenInput label="Contact Email" value={inquiryForm.contact_email} onChange={(event) => setInquiryForm((current) => ({ ...current, contact_email: event.target.value }))} />
                        </div>
                        <label className={styles.notesField}>
                            Venue Address
                            <textarea value={inquiryForm.venue_address} onChange={(event) => setInquiryForm((current) => ({ ...current, venue_address: event.target.value }))} rows={3} />
                        </label>
                        <label className={styles.notesField}>
                            Notes
                            <textarea value={inquiryForm.notes} onChange={(event) => setInquiryForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
                        </label>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="secondary" onClick={() => setIsDrawerOpen(null)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" isLoading={isSaving} onClick={saveInquiry}>Save Inquiry</KitchenButton>
                        </div>
                    </div>
                </div>
            ) : null}

            {isDrawerOpen === 'quotation' ? (
                <div className={styles.modalOverlay} onClick={() => setIsDrawerOpen(null)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <h2>Prepare Quotation</h2>
                        <div className={styles.formGrid}>
                            <KitchenSelect label="Inquiry" value={quotationForm.inquiry_id} onChange={(event) => setQuotationForm((current) => ({ ...current, inquiry_id: event.target.value }))} options={(inquiries ?? []).map((inquiry: any) => ({ value: String(inquiry.id), label: `${inquiry.inquiry_no} • ${inquiry.event_title}` }))} />
                            <KitchenInput label="Valid Until" type="date" value={quotationForm.valid_until} onChange={(event) => setQuotationForm((current) => ({ ...current, valid_until: event.target.value }))} />
                            <KitchenInput label="Service Charge" type="number" value={quotationForm.service_charge_amount} onChange={(event) => setQuotationForm((current) => ({ ...current, service_charge_amount: event.target.value }))} />
                            <KitchenInput label="Tax" type="number" value={quotationForm.tax_amount} onChange={(event) => setQuotationForm((current) => ({ ...current, tax_amount: event.target.value }))} />
                            <KitchenInput label="Discount" type="number" value={quotationForm.discount_amount} onChange={(event) => setQuotationForm((current) => ({ ...current, discount_amount: event.target.value }))} />
                        </div>
                        <div className={styles.quoteLines}>
                            {quotationForm.items.map((item, index) => (
                                <div key={index} className={styles.quoteLineCard}>
                                    <div className={styles.formGrid}>
                                        <KitchenSelect label="Type" value={item.item_type} onChange={(event) => updateQuoteLine(index, { item_type: event.target.value, product_id: '', inventory_item_id: '', supply_strategy: event.target.value === 'inventory' ? 'procure' : event.target.value === 'product' ? 'produce' : 'none' })} options={[
                                            { value: 'product', label: 'Product Menu' },
                                            { value: 'inventory', label: 'Inventory Item' },
                                            { value: 'service', label: 'Service' },
                                            { value: 'fee', label: 'Fee' },
                                            { value: 'discount', label: 'Discount' },
                                            { value: 'other', label: 'Other' },
                                        ]} />
                                        {item.item_type === 'product' ? (
                                            <KitchenSelect label="Product" value={item.product_id} onChange={(event) => {
                                                const product = (options?.products ?? []).find((row: any) => String(row.id) === event.target.value);
                                                updateQuoteLine(index, { product_id: event.target.value, line_description: product?.product_name || '', unit_price: String(product?.product_base_price ?? 0), supply_strategy: 'produce' });
                                            }} options={[{ value: '', label: 'Select product' }, ...((options?.products ?? []).map((product: any) => ({ value: String(product.id), label: `${product.product_name} (${product.product_sku || 'No SKU'})` })))]} />
                                        ) : null}
                                        {item.item_type === 'inventory' ? (
                                            <KitchenSelect label="Inventory Item" value={item.inventory_item_id} onChange={(event) => {
                                                const inventoryItem = (options?.inventory_items ?? []).find((row: any) => String(row.id) === event.target.value);
                                                updateQuoteLine(index, { inventory_item_id: event.target.value, line_description: inventoryItem?.item_name || '', unit_price: String(inventoryItem?.estimated_unit_cost ?? 0), supply_strategy: 'procure' });
                                            }} options={[{ value: '', label: 'Select inventory item' }, ...((options?.inventory_items ?? []).map((inventoryItem: any) => ({ value: String(inventoryItem.id), label: `${inventoryItem.item_name} (${inventoryItem.uom_base})` })))]} />
                                        ) : null}
                                        {item.item_type !== 'product' && item.item_type !== 'inventory' ? (
                                            <KitchenInput label="Description" value={item.line_description} onChange={(event) => updateQuoteLine(index, { line_description: event.target.value })} />
                                        ) : null}
                                        <KitchenInput label="Quantity" type="number" value={item.quantity} onChange={(event) => updateQuoteLine(index, { quantity: event.target.value })} />
                                        <KitchenInput label="Unit Price" type="number" value={item.unit_price} onChange={(event) => updateQuoteLine(index, { unit_price: event.target.value })} />
                                        <KitchenSelect label="Supply Strategy" value={item.supply_strategy} onChange={(event) => updateQuoteLine(index, { supply_strategy: event.target.value })} options={[
                                            { value: 'none', label: 'None' },
                                            { value: 'produce', label: 'Produce' },
                                            { value: 'procure', label: 'Procure' },
                                            { value: 'both', label: 'Both' },
                                        ]} />
                                    </div>
                                </div>
                            ))}
                            <KitchenButton variant="outline" onClick={addQuoteLine}>
                                <Plus size={14} />
                                Add Line
                            </KitchenButton>
                        </div>
                        <label className={styles.notesField}>
                            Terms & Conditions
                            <textarea value={quotationForm.terms_and_conditions} onChange={(event) => setQuotationForm((current) => ({ ...current, terms_and_conditions: event.target.value }))} rows={3} />
                        </label>
                        <label className={styles.notesField}>
                            Notes
                            <textarea value={quotationForm.notes} onChange={(event) => setQuotationForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
                        </label>
                        <div className={styles.modalActions}>
                            <KitchenButton variant="secondary" onClick={() => setIsDrawerOpen(null)}>Cancel</KitchenButton>
                            <KitchenButton variant="primary" isLoading={isSaving} onClick={saveQuotation}>Save Quotation</KitchenButton>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default CateringManagement;
