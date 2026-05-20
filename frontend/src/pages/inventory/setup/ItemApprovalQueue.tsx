/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import styles from './ItemApprovalQueue.module.css';
import {
    ClipboardCheck,
    Clock,
    CheckCircle,
    ChevronRight,
    PackagePlus,
    MessageSquare
} from 'lucide-react';
import { KitchenButton } from '../../../components/ui/KitchenButton/KitchenButton';
import { KitchenTable } from '../../../components/ui/KitchenTable/KitchenTable';
import { apiUrl } from '../../../api/api';
import { clearAuthSession, readAuthSessionItem } from '../../../auth/storage';

interface ItemRequest {
    id: number;
    item_name: string;
    uom_base: string;
    uom_purchase: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    admin_comment: string;
    created_at: string;
    branch: {
        branch_name: string;
    }
}

export function ItemApprovalQueue() {
    const [requests, setRequests] = useState<ItemRequest[]>([]);
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<ItemRequest | null>(null);
    const [selectedSubType, setSelectedSubType] = useState<number>(0);
    const [adminComment, setAdminComment] = useState('');

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(apiUrl('/inventory/requests'), {
                headers: {
                    'Authorization': `Bearer ${readAuthSessionItem('access_token')}`
                }
            });

            if (res.status === 401) {
                console.error('Unauthorized access');
                clearAuthSession();
                window.location.href = '/console/auth';
                return;
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to fetch requests', err);
            // setError is not defined in this file, but we should keep mock data
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchHierarchy = useCallback(async () => {
        try {
            const res = await fetch(apiUrl('/inventory/filter-hierarchy'), {
                headers: {
                    'Authorization': `Bearer ${readAuthSessionItem('access_token')}`
                }
            });

            if (!res.ok) return;

            const data = await res.json();
            setHierarchy(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch hierarchy', err);
            setHierarchy([]);
        }
    }, []);

    useEffect(() => {
        void fetchRequests();
        void fetchHierarchy();
    }, [fetchHierarchy, fetchRequests]);

    const processRequest = async (status: 'APPROVED' | 'REJECTED') => {
        if (!selectedRequest) return;
        if (status === 'APPROVED' && !selectedSubType) {
            alert('Please select a sub-category for this item.');
            return;
        }

        try {
            setProcessingId(selectedRequest.id);
            const res = await fetch(apiUrl(`/inventory/requests/${selectedRequest.id}/process`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${readAuthSessionItem('access_token')}`
                },
                body: JSON.stringify({
                    status,
                    subTypeId: selectedSubType,
                    adminComment
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Failed to process request');
            }

            setSelectedRequest(null);
            setAdminComment('');
            setSelectedSubType(0);
            alert(`Request ${status === 'APPROVED' ? 'approved and item created' : 'rejected'} successfully.`);
            void fetchRequests();
        } catch (err: any) {
            console.error('Processing failed', err);
            alert(err.message || 'An error occurred while processing the request.');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTitle}>
                    <ClipboardCheck className={styles.headerIcon} />
                    <div>
                        <h1>Master Entry Approvals</h1>
                        <p>Review and incorporate branch requests into the global master list.</p>
                    </div>
                </div>
            </header>

            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <Clock size={24} className={styles.pendingIcon} />
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{requests.filter(r => r.status === 'PENDING').length}</span>
                        <span className={styles.statLabel}>Pending Requests</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <CheckCircle size={24} className={styles.approvedIcon} />
                    <div className={styles.statInfo}>
                        <span className={styles.statValue}>{requests.filter(r => r.status === 'APPROVED').length}</span>
                        <span className={styles.statLabel}>Processed (Monthly)</span>
                    </div>
                </div>
            </div>

            <div className={styles.tableContainer}>
                {loading ? (
                    <div className={styles.loading}>Loading requests Catalog...</div>
                ) : (
                    <>
                        <KitchenTable
                            data={requests}
                            columns={[
                                {
                                    key: 'request_info',
                                    header: 'Request Info',
                                    cell: (row: ItemRequest) => (
                                        <div className={styles.requestCell}>
                                            <div className={styles.itemName}>{row.item_name}</div>
                                            <div className={styles.branchName}>from {row.branch?.branch_name}</div>
                                        </div>
                                    )
                                },
                                {
                                    key: 'specs',
                                    header: 'Specifications',
                                    cell: (row: ItemRequest) => (
                                        <div className={styles.specsCell}>
                                            <span className={styles.badge}>Base: {row.uom_base}</span>
                                            {row.uom_purchase && <span className={styles.badge}>Order: {row.uom_purchase}</span>}
                                        </div>
                                    )
                                },
                                {
                                    key: 'reason',
                                    header: 'Reason',
                                    cell: (row: ItemRequest) => <div className={styles.reasonCell}>{row.reason || '--'}</div>
                                },
                                {
                                    key: 'status',
                                    header: 'Status',
                                    cell: (row: ItemRequest) => (
                                        <span className={`${styles.statusBadge} ${styles[row.status.toLowerCase()]}`}>
                                            {row.status}
                                        </span>
                                    )
                                },
                                {
                                    key: 'date',
                                    header: 'Date',
                                    cell: (row: ItemRequest) => <div>{new Date(row.created_at).toLocaleDateString()}</div>
                                },
                                {
                                    key: 'action',
                                    header: 'Action',
                                    cell: (row: ItemRequest) => (
                                        row.status === 'PENDING' ? (
                                            <KitchenButton
                                                variant="primary"
                                                size="sm"
                                                onClick={() => setSelectedRequest(row)}
                                            >
                                                Assess <ChevronRight size={14} />
                                            </KitchenButton>
                                        ) : (
                                            <KitchenButton variant="ghost" size="sm" onClick={() => setSelectedRequest(row)}>
                                                View Details
                                            </KitchenButton>
                                        )
                                    )
                                }
                            ]}
                        />
                        {requests.length === 0 && (
                            <div className={styles.emptyState}>
                                <ClipboardCheck size={48} style={{ opacity: 0.2 }} />
                                <div>
                                    <h3>No Requests Found</h3>
                                    <p>The global review queue is empty.</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {selectedRequest && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitle}>
                                <PackagePlus size={20} className={styles.modalHeaderIcon} />
                                <h3>Review Request: {selectedRequest.item_name}</h3>
                            </div>
                            <p>Submitted by {selectedRequest.branch?.branch_name} on {new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.infoSection}>
                                <h4>Branch Context</h4>
                                <div className={styles.reasonBox}>
                                    <MessageSquare size={16} />
                                    <p>{selectedRequest.reason || "No reason provided."}</p>
                                </div>
                            </div>

                            {selectedRequest.status === 'PENDING' ? (
                                <div className={styles.approvalForm}>
                                    <h4>Classification</h4>
                                    <div className={styles.formGroup}>
                                        <label>Incorporate Under Sub-Category</label>
                                        <select
                                            value={selectedSubType}
                                            onChange={(e) => setSelectedSubType(Number(e.target.value))}
                                            className={styles.select}
                                        >
                                            <option value={0}>-- Select Hierarchy Path --</option>
                                            {hierarchy.map(cls => (
                                                cls.types.map((type: any) => (
                                                    type.subTypes.map((st: any) => (
                                                        <option key={st.id} value={st.id}>
                                                            {cls.class_name} → {type.type_name} → {st.sub_type_name}
                                                        </option>
                                                    ))
                                                ))
                                            ))}
                                        </select>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <label>Admin Comments / Feedback</label>
                                        <textarea
                                            placeholder="Enter feedback for the branch..."
                                            value={adminComment}
                                            onChange={e => setAdminComment(e.target.value)}
                                            rows={3}
                                            className={styles.textarea}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.processedInfo}>
                                    <div className={styles.infoRow}>
                                        <label>Resolution Status</label>
                                        <span className={`${styles.statusBadge} ${styles[selectedRequest.status.toLowerCase()]}`}>{selectedRequest.status}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <label>Admin Feedback</label>
                                        <p>{selectedRequest.admin_comment || "No feedback provided."}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            <KitchenButton variant="outline" onClick={() => setSelectedRequest(null)}>Close</KitchenButton>
                            {selectedRequest.status === 'PENDING' && (
                                <>
                                    <KitchenButton
                                        variant="danger"
                                        onClick={() => processRequest('REJECTED')}
                                        disabled={!!processingId}
                                    >
                                        Reject Request
                                    </KitchenButton>
                                    <KitchenButton
                                        variant="primary"
                                        onClick={() => processRequest('APPROVED')}
                                        disabled={!!processingId || !selectedSubType}
                                    >
                                        Approve & Incorporate
                                    </KitchenButton>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
