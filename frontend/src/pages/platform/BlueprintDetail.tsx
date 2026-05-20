/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Edit2, Layers, Package, RefreshCcw, Save } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../../components/ui/KitchenTable/KitchenTable';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './ClientManagement.module.css';
import { BlueprintPayloadEditor } from './BlueprintPayloadEditor';
import { buildBlueprintPayloadRequest, fromBlueprintPayload } from './blueprintPayload';

interface BlueprintVersionRow {
  id: number;
  version_no: number;
  schema_version: string;
  release_notes?: string | null;
  payload: Record<string, any>;
  payload_summary?: Record<string, number>;
  created_at: string;
}

interface BlueprintDetailState {
  id: string;
  blueprint_code: string;
  blueprint_name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'retired';
  active_version_id?: number | null;
  active_version?: BlueprintVersionRow | null;
  versions: BlueprintVersionRow[];
  recent_assignments: Array<any>;
  application_history: Array<any>;
}

export function BlueprintDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<BlueprintDetailState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [activatingVersionId, setActivatingVersionId] = useState<number | null>(null);
  const [versionForm, setVersionForm] = useState(fromBlueprintPayload());
  const [releaseNotes, setReleaseNotes] = useState('');
  const [activateNow, setActivateNow] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await platformApi.getBlueprint(id);
      setDetail({
        ...response,
        versions: Array.isArray(response?.versions) ? response.versions : [],
        recent_assignments: Array.isArray(response?.recent_assignments) ? response.recent_assignments : [],
        application_history: Array.isArray(response?.application_history) ? response.application_history : [],
      });
      setVersionForm(fromBlueprintPayload(response?.active_version?.payload));
      setReleaseNotes('');
      setActivateNow(true);
    } catch (error) {
      toast.error('Failed to load blueprint', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleActivateVersion = useCallback(async (versionId: number) => {
    if (!id) return;
    setActivatingVersionId(versionId);
    try {
      await platformApi.activateBlueprintVersion(id, versionId);
      toast.success('Blueprint version activated', `Version ${versionId} is now active for new assignments.`);
      await load();
    } catch (error) {
      toast.error('Activation failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setActivatingVersionId(null);
    }
  }, [id, load]);

  const versionColumns = useMemo<ColumnDef<BlueprintVersionRow>[]>(() => [
    { key: 'version_no', header: 'Version', cell: (row) => `v${row.version_no}` },
    { key: 'schema_version', header: 'Schema', cell: (row) => row.schema_version },
    { key: 'release_notes', header: 'Notes', cell: (row) => row.release_notes || '—' },
    { key: 'created_at', header: 'Created', cell: (row) => new Date(row.created_at).toLocaleString() },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => row.id === detail?.active_version_id ? (
        <span className={styles.statusBadge} style={{ color: 'var(--success)', background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.32)' }}>Active</span>
      ) : (
        <KitchenButton size="sm" variant="secondary" onClick={() => handleActivateVersion(row.id)} isLoading={activatingVersionId === row.id}>Activate</KitchenButton>
      ),
    },
  ], [activatingVersionId, detail?.active_version_id, handleActivateVersion]);

  const historyColumns = useMemo<ColumnDef<any>[]>(() => [
    { key: 'client_name', header: 'Client', cell: (row) => `${row.client_name} (${row.client_id})` },
    { key: 'assignment_status', header: 'Status', cell: (row) => row.assignment_status },
    { key: 'version_no', header: 'Version', cell: (row) => row.version_no ? `v${row.version_no}` : '—' },
    { key: 'created_at', header: 'Assigned', cell: (row) => new Date(row.created_at).toLocaleString() },
  ], []);

  const applicationColumns = useMemo<ColumnDef<any>[]>(() => [
    { key: 'section_key', header: 'Section', cell: (row) => row.section_key },
    { key: 'result_status', header: 'Result', cell: (row) => row.result_status },
    { key: 'message', header: 'Message', cell: (row) => row.message },
    { key: 'created_at', header: 'Timestamp', cell: (row) => new Date(row.created_at).toLocaleString() },
  ], []);

  const createVersion = async () => {
    if (!id) return;
    setIsSavingVersion(true);
    try {
      await platformApi.createBlueprintVersion(id, {
        payload: buildBlueprintPayloadRequest(versionForm),
        release_notes: releaseNotes.trim() || undefined,
        activate: activateNow,
      });
      toast.success('Blueprint version created', 'A new version has been added to this blueprint.');
      await load();
    } catch (error) {
      toast.error('Version creation failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSavingVersion(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loaderBox} style={{ height: '60vh' }}>
        <RefreshCcw size={36} className={styles.spin} />
        <span>Loading blueprint detail...</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.emptyState}>
        <Layers size={48} color="var(--danger)" />
        <h3>Blueprint not found</h3>
        <KitchenButton onClick={() => navigate('/nexus/blueprints')}>
          <ArrowLeft size={16} style={{ marginRight: 6 }} />
          Back to Blueprints
        </KitchenButton>
      </div>
    );
  }

  const payloadSummary = detail.active_version?.payload_summary || {};

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/nexus/blueprints')}>
            <ArrowLeft size={18} />
          </button>
          <div className={styles.iconBox}><Layers size={22} /></div>
          <div>
            <div className={styles.headerEyebrow}>Blueprint Detail</div>
            <h1>{detail.blueprint_name}</h1>
            <p>{detail.blueprint_code} • {detail.status} • active version {detail.active_version?.version_no ? `v${detail.active_version.version_no}` : 'n/a'}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <KitchenButton onClick={() => navigate(`/nexus/blueprints/${detail.id}/edit`)}>
            <Edit2 size={15} style={{ marginRight: 6 }} />
            Edit Metadata
          </KitchenButton>
        </div>
      </header>

      <div className={styles.overviewGrid}>
        <KitchenCard className={styles.overviewCard}>
          <h3 className={styles.cardTitle}><Package size={16} /> Active Version Preview</h3>
          <div className={styles.infoRows}>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Status</span><span className={styles.infoRowValue}>{detail.status}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Settings</span><span className={styles.infoRowValue}>{payloadSummary.settings || 0}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Security Roles</span><span className={styles.infoRowValue}>{payloadSummary.roles || 0}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Setup Masters</span><span className={styles.infoRowValue}>{(payloadSummary.departments || 0) + (payloadSummary.designations || 0) + (payloadSummary.chart_of_accounts || 0)}</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Catalog Masters</span><span className={styles.infoRowValue}>{(payloadSummary.categories || 0) + (payloadSummary.menu_types || 0) + (payloadSummary.cuisine_types || 0) + (payloadSummary.stations || 0) + (payloadSummary.uoms || 0)}</span></div>
          </div>
          {detail.active_version?.release_notes ? (
            <div className={styles.infoBar} style={{ marginTop: 16, marginBottom: 0 }}>
              <Clock3 size={14} />
              <span>{detail.active_version.release_notes}</span>
            </div>
          ) : null}
        </KitchenCard>

        <KitchenCard className={styles.overviewCard}>
          <h3 className={styles.cardTitle}><CheckCircle2 size={16} /> Safe Application Model</h3>
          <div className={styles.infoRows}>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Overwrite Policy</span><span className={styles.infoRowValue}>Only missing tenant masters are created. Existing records are preserved.</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Idempotency</span><span className={styles.infoRowValue}>Assignment/application stays deterministic through business-key checks.</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Blocked</span><span className={styles.infoRowValue}>Users, branches, products, devices, and transactional records.</span></div>
          </div>
        </KitchenCard>
      </div>

      <div className={styles.overviewGrid}>
        <KitchenCard className={styles.overviewCard}>
          <div className={styles.tabContentHeader}><h3>Version History</h3></div>
          <KitchenTable columns={versionColumns} data={detail.versions} emptyMessage="No blueprint versions recorded yet." />
        </KitchenCard>

        <KitchenCard className={styles.overviewCard}>
          <div className={styles.tabContentHeader}>
            <h3>Create New Version</h3>
            <KitchenButton onClick={createVersion} isLoading={isSavingVersion}>
              <Save size={15} style={{ marginRight: 6 }} />
              Save Version
            </KitchenButton>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className={styles.fieldLabel}>Release Notes</label>
              <textarea className={styles.commentBox} rows={3} value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} />
            </div>
            <KitchenButton variant="secondary" onClick={() => setActivateNow((prev) => !prev)}>
              Activate Immediately: {activateNow ? 'Yes' : 'No'}
            </KitchenButton>
          </div>
        </KitchenCard>
      </div>

      <BlueprintPayloadEditor payload={versionForm} setPayload={setVersionForm} />

      <KitchenCard className={styles.tabContent}>
        <div className={styles.tabContentHeader}><h3>Client Assignment History</h3></div>
        <KitchenTable columns={historyColumns} data={detail.recent_assignments} emptyMessage="This blueprint has not been assigned to any clients yet." />
      </KitchenCard>

      <KitchenCard className={styles.tabContent}>
        <div className={styles.tabContentHeader}><h3>Application Logs</h3></div>
        <KitchenTable columns={applicationColumns} data={detail.application_history} emptyMessage="No blueprint application logs recorded yet." />
      </KitchenCard>
    </div>
  );
}

export default BlueprintDetail;
