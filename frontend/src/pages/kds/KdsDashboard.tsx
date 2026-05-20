/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { posApi, branchApi } from '../../api/api';
import { Clock, ChefHat, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatConfiguredKotNumber, resolveKotDisplayNumber } from '../pos/printTemplates/printHelpers';
import styles from './KdsDashboard.module.css';

interface KotItem {
    id: string | number;
    name: string;
    quantity: number;
    notes?: string;
}

interface KotTicket {
    id: string | number;
    kot_number: string;
    order_id: string | number;
    type: string;
    status: 'pending' | 'preparing' | 'ready' | 'completed';
    created_at: string;
    items: KotItem[];
}

export function KdsDashboard() {
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchOverride, setSelectedBranchOverride] = useState('');
    const [tickets, setTickets] = useState<KotTicket[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const selectedBranch = selectedBranchOverride || branches[0]?.value || '';

    useEffect(() => {
        const init = async () => {
            try {
                const bData = await branchApi.getBranches();
                const branchOptions = bData.map(b => ({ value: b.id.toString(), label: b.branch_name }));
                setBranches(branchOptions);
                if (branchOptions[0]?.value) {
                    const data = await posApi.getKots(Number(branchOptions[0].value));
                    setTickets(data);
                }
            } catch (err) {
                console.error('Failed to init branches', err);
            }
        };
        void init();
    }, []);

    const fetchTickets = useCallback(async () => {
        if (!selectedBranch) return;
        try {
            const data = await posApi.getKots(Number(selectedBranch));
            setTickets(data);
        } catch (err) {
            console.error('Failed to fetch KOTs', err);
        }
    }, [selectedBranch]);

    useEffect(() => {
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        const pollInterval = setInterval(() => void fetchTickets(), 5000); // Poll every 5 seconds

        return () => {
            clearInterval(clockInterval);
            clearInterval(pollInterval);
        };
    }, [fetchTickets]);

    const handleBranchChange = async (branchId: string) => {
        setSelectedBranchOverride(branchId);
        try {
            const data = await posApi.getKots(Number(branchId));
            setTickets(data);
        } catch (err) {
            console.error('Failed to fetch KOTs', err);
        }
    };

    const handleAdvanceStatus = async (kotId: string | number, currentStatus: string) => {
        let nextStatus = currentStatus;
        if (currentStatus === 'pending') nextStatus = 'preparing';
        else if (currentStatus === 'preparing') nextStatus = 'ready';
        else if (currentStatus === 'ready') nextStatus = 'completed';

        try {
            await posApi.updateKotStatus(Number(selectedBranch), kotId.toString(), nextStatus);
            await fetchTickets();
        } catch (err) {
            console.error('Failed to update KOT status', err);
        }
    };

    const formatElapsedTime = (startStr: string) => {
        const start = new Date(startStr);
        const diffMs = currentTime.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        return `${diffMins}:${diffSecs.toString().padStart(2, '0')}`;
    };

    const getTimerClass = (startStr: string) => {
        const start = new Date(startStr);
        const diffMins = Math.floor((currentTime.getTime() - start.getTime()) / 60000);
        if (diffMins >= 20) return styles.timerWarningCritical;
        if (diffMins >= 10) return styles.timerWarning;
        return styles.timerNormal;
    };

    // Columns
    const pendingTickets = tickets.filter(t => t.status === 'pending');
    const preparingTickets = tickets.filter(t => t.status === 'preparing');
    const readyTickets = tickets.filter(t => t.status === 'ready');

    const TicketCard = ({ ticket }: { ticket: KotTicket }) => {
        const isTakeout = ticket.type === 'takeout' || ticket.type === 'delivery';

        return (
            <div className={`${styles.ticket} ${styles['ticket' + ticket.status]}`}>
                <div className={`${styles.ticketHeader} ${isTakeout ? styles.headerTakeout : styles.headerDineIn}`}>
                    <div className={styles.ticketMeta}>
                        <span className={styles.kotNumber}>{formatConfiguredKotNumber(resolveKotDisplayNumber(ticket as unknown as Record<string, unknown>, String(ticket.kot_number || ticket.id || '-')), ticket as unknown as Record<string, unknown>, { preserveTypePrefix: true }) || resolveKotDisplayNumber(ticket as unknown as Record<string, unknown>, String(ticket.kot_number || ticket.id || '-'))}</span>
                        <span className={styles.orderType}>{ticket.type.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <div className={`${styles.ticketTimer} ${getTimerClass(ticket.created_at)}`}>
                        <Clock size={16} />
                        {formatElapsedTime(ticket.created_at)}
                    </div>
                </div>

                <div className={styles.ticketBody}>
                    <ul className={styles.itemList}>
                        {ticket.items?.map((item, idx) => (
                            <li key={idx} className={styles.itemRow}>
                                <div className={styles.itemMain}>
                                    <span className={styles.itemQty}>{item.quantity}x</span>
                                    <span className={styles.itemName}>{item.name}</span>
                                </div>
                                {item.notes && (
                                    <div className={styles.itemNotes}>
                                        <AlertCircle size={14} /> {item.notes}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={styles.ticketFooter}>
                    {ticket.status === 'pending' && (
                        <button className={styles.btnStart} onClick={() => handleAdvanceStatus(ticket.id, ticket.status)}>
                            <ChefHat size={20} /> Start Preparing
                        </button>
                    )}
                    {ticket.status === 'preparing' && (
                        <button className={styles.btnReady} onClick={() => handleAdvanceStatus(ticket.id, ticket.status)}>
                            <CheckCircle2 size={20} /> Mark as Ready
                        </button>
                    )}
                    {ticket.status === 'ready' && (
                        <button className={styles.btnComplete} onClick={() => handleAdvanceStatus(ticket.id, ticket.status)}>
                            <CheckCircle2 size={20} /> Handover / Finish
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.kdsContainer}>
            <header className={styles.kdsHeader}>
                <div className={styles.headerLeft}>
                    <h1>Kitchen Display System</h1>
                    <div className={styles.liveIndicator}>
                        <span className={styles.pulseDot}></span> Live Sync Active
                    </div>
                </div>
                <KitchenSelect
                    options={branches}
                    value={selectedBranch}
                    onChange={(e) => void handleBranchChange(e.target.value)}
                    className={styles.branchSelect}
                />
            </header>

            <div className={styles.kanbanBoard}>
                {/* Column 1: New */}
                <div className={styles.column}>
                    <div className={styles.columnHeader}>
                        <h2>New Orders ({pendingTickets.length})</h2>
                    </div>
                    <div className={styles.ticketContainer}>
                        {pendingTickets.map(t => <TicketCard key={t.id} ticket={t} />)}
                    </div>
                </div>

                {/* Column 2: Preparing */}
                <div className={styles.column}>
                    <div className={styles.columnHeaderPreparing}>
                        <h2>Preparing ({preparingTickets.length})</h2>
                    </div>
                    <div className={styles.ticketContainer}>
                        {preparingTickets.map(t => <TicketCard key={t.id} ticket={t} />)}
                    </div>
                </div>

                {/* Column 3: Ready */}
                <div className={styles.column}>
                    <div className={styles.columnHeaderReady}>
                        <h2>Ready to Serve ({readyTickets.length})</h2>
                    </div>
                    <div className={styles.ticketContainer}>
                        {readyTickets.map(t => <TicketCard key={t.id} ticket={t} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}

