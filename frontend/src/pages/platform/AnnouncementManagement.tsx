import { useState } from 'react';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import {
    Megaphone, Send, Trash2, Clock,
    ShieldAlert, Info, CheckCircle2, Plus, Globe, AlertTriangle, Eye, X
} from 'lucide-react';
import styles from './AnnouncementManagement.module.css';

interface Announcement {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    target: 'all' | 'enterprise_only' | 'staff_only';
    status: 'draft' | 'active' | 'scheduled' | 'expired';
    created_at: string;
    expires_at: string;
    views: number;
}

type AnnouncementForm = Pick<Announcement, 'title' | 'message' | 'type' | 'target'> & {
    expires_at: string;
};

function getDefaultExpiryDate() {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
}

function createDefaultForm(): AnnouncementForm {
    return {
        title: '',
        message: '',
        type: 'info',
        target: 'all',
        expires_at: getDefaultExpiryDate(),
    };
}

export default function AnnouncementManagement() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState<AnnouncementForm>(createDefaultForm);

    const handleCreate = () => {
        setIsCreating(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newAnnouncement: Announcement = {
            id: String(Date.now()),
            title: form.title || '',
            message: form.message || '',
            type: form.type || 'info',
            target: form.target || 'all',
            status: 'active',
            created_at: new Date().toISOString(),
            expires_at: new Date(form.expires_at || '').toISOString(),
            views: 0
        };
        setAnnouncements([newAnnouncement, ...announcements]);
        setIsCreating(false);
        setForm(createDefaultForm());

        // Broadcast simulation logic for the local demo
        localStorage.setItem('nexus_broadcast', JSON.stringify({
            id: newAnnouncement.id,
            title: newAnnouncement.title,
            message: newAnnouncement.message,
            type: newAnnouncement.type,
            active: true
        }));
    };

    const deleteAnnouncement = (id: string) => {
        setAnnouncements(announcements.filter(a => a.id !== id));
        if (JSON.parse(localStorage.getItem('nexus_broadcast') || '{}').id === id) {
            localStorage.removeItem('nexus_broadcast');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.iconBox}>
                        <Megaphone size={22} />
                    </div>
                    <div>
                        <h1>Global Broadcasts</h1>
                        <p>Communicate critical updates and announcements to all connected clients.</p>
                    </div>
                </div>
                <KitchenButton variant="primary" onClick={handleCreate}>
                    <Plus size={18} style={{ marginRight: '8px' }} /> Create Announcement
                </KitchenButton>
            </header>

            <div className={styles.content}>
                <div className={styles.announcementGrid}>
                    {announcements.map(a => (
                        <KitchenCard key={a.id} className={`${styles.announcementCard} ${styles[`type_${a.type}`]}`}>
                            <div className={styles.cardTop}>
                                <div className={styles.typeBadge}>
                                    {a.type === 'info' && <Info size={14} />}
                                    {a.type === 'warning' && <AlertTriangle size={14} />}
                                    {a.type === 'danger' && <ShieldAlert size={14} />}
                                    {a.type === 'success' && <CheckCircle2 size={14} />}
                                    {a.type}
                                </div>
                                <span className={`${styles.statusBadge} ${styles[`status_${a.status}`]}`}>
                                    {a.status}
                                </span>
                            </div>
                            <h3 className={styles.announcementTitle}>{a.title}</h3>
                            <p className={styles.announcementMessage}>{a.message}</p>

                            <div className={styles.cardFooter}>
                                <div className={styles.metaInfo}>
                                    <div className={styles.metaItem}>
                                        <Globe size={13} />
                                        <span>Target: {a.target.replace('_', ' ')}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <Clock size={13} />
                                        <span>Expires: {new Date(a.expires_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <Eye size={13} />
                                        <span>{a.views.toLocaleString()} views</span>
                                    </div>
                                </div>
                                <div className={styles.cardActions}>
                                    <button className={styles.actionBtn} onClick={() => deleteAnnouncement(a.id)} title="Archive">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </KitchenCard>
                    ))}
                </div>
            </div>

            {isCreating && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3><Megaphone size={18} /> New Global Broadcast</h3>
                            <button className={styles.closeBtn} onClick={() => setIsCreating(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className={styles.modalForm}>
                            <KitchenInput
                                label="Announcement Title"
                                placeholder="Short, attention-grabbing title..."
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                required
                            />
                            <div className={styles.formGroup}>
                                <label className={styles.fieldLabel}>Core Message</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder="Provide details about the update or event..."
                                    value={form.message}
                                    onChange={e => setForm({ ...form, message: e.target.value })}
                                    rows={4}
                                    required
                                />
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.fieldLabel}>Broadcast Type</label>
                                    <select
                                        className={styles.select}
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value as Announcement['type'] })}
                                    >
                                        <option value="info">Information (Blue)</option>
                                        <option value="warning">Maintenance / Warning (Amber)</option>
                                        <option value="danger">Critical Alert (Red)</option>
                                        <option value="success">New Feature / Success (Green)</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.fieldLabel}>Target Audience</label>
                                    <select
                                        className={styles.select}
                                        value={form.target}
                                        onChange={e => setForm({ ...form, target: e.target.value as Announcement['target'] })}
                                    >
                                        <option value="all">All Clients & Staff</option>
                                        <option value="enterprise_only">Enterprise Clients Only</option>
                                        <option value="staff_only">Branch Staff Only</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.fieldLabel}>Expiry Date</label>
                                <input
                                    type="date"
                                    className={styles.dateInput}
                                    value={form.expires_at}
                                    onChange={e => setForm({ ...form, expires_at: e.target.value })}
                                />
                                <span className={styles.hintText}>Announcement will automatically vanish after this date.</span>
                            </div>
                            <div className={styles.modalFooter}>
                                <KitchenButton variant="secondary" type="button" onClick={() => setIsCreating(false)}>
                                    Cancel
                                </KitchenButton>
                                <KitchenButton type="submit">
                                    <Send size={16} style={{ marginRight: '8px' }} /> Broadcast Now
                                </KitchenButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

