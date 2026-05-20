import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CopyPlus, Layers, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { platformApi } from '../../api/api';
import { toast } from '../../components/ui/KitchenToast/toast';
import styles from './BlueprintForm.module.css';
import { BlueprintPayloadEditor } from './BlueprintPayloadEditor';
import {
  buildBlueprintPayloadRequest,
  emptyPayload,
  fromBlueprintPayload,
  payloadHasValues,
} from './blueprintPayload';
import type { BlueprintStatus } from './blueprintPayload';
import { blueprintPresets, clonePreset } from './blueprintPresets';

export function BlueprintForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    blueprint_code: '',
    blueprint_name: '',
    description: '',
    status: 'draft' as BlueprintStatus,
    release_notes: '',
  });
  const [payload, setPayload] = useState(emptyPayload());
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const payloadSummary = useMemo(() => {
    const itemCounts = [
      payload.roles.length,
      payload.departments.length,
      payload.designations.length,
      payload.chart_of_accounts.length,
      payload.categories.length,
      payload.menu_types.length,
      payload.cuisine_types.length,
      payload.stations.length,
      payload.uoms.length,
    ];

    const hasSettings = Boolean(
      payload.settings.currency ||
      payload.settings.timezone ||
      payload.settings.fiscal_year_start ||
      payload.settings.contact_email ||
      payload.settings.contact_phone ||
      payload.settings.address
    );

    return {
      populatedSections: itemCounts.filter((count) => count > 0).length + (hasSettings ? 1 : 0),
      totalEntries: itemCounts.reduce((sum, count) => sum + count, 0),
    };
  }, [payload]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await platformApi.getBlueprint(id);
        const activeVersion = response?.active_version;
        setForm({
          blueprint_code: response.blueprint_code || '',
          blueprint_name: response.blueprint_name || '',
          description: response.description || '',
          status: response.status || 'draft',
          release_notes: activeVersion?.release_notes || '',
        });
        setPayload(fromBlueprintPayload(activeVersion?.payload));
      } catch (error) {
        toast.error('Failed to load blueprint', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id]);

  const handleSubmit = async () => {
    if (!form.blueprint_name.trim()) {
      toast.error('Blueprint blocked', 'Blueprint name is required.');
      return;
    }

    if (!isEdit && !form.blueprint_code.trim()) {
      toast.error('Blueprint blocked', 'Blueprint code is required.');
      return;
    }

    if (!isEdit && !payloadHasValues(payload)) {
      toast.error('Blueprint blocked', 'At least one safe configuration section is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEdit && id) {
        await platformApi.updateBlueprint(id, {
          blueprint_name: form.blueprint_name.trim(),
          description: form.description.trim() || undefined,
          status: form.status,
        });
        toast.success('Blueprint updated', 'Blueprint metadata has been saved.');
        navigate(`/nexus/blueprints/${id}`);
      } else {
        const created = await platformApi.createBlueprint({
          blueprint_code: form.blueprint_code.trim(),
          blueprint_name: form.blueprint_name.trim(),
          description: form.description.trim() || undefined,
          status: form.status,
          release_notes: form.release_notes.trim() || undefined,
          payload: buildBlueprintPayloadRequest(payload),
        }) as { id: string };
        toast.success('Blueprint created', 'Initial blueprint version has been created.');
        navigate(`/nexus/blueprints/${created.id}`);
      }
    } catch (error) {
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = blueprintPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    const nextPreset = clonePreset(preset);
    setSelectedPresetId(presetId);
    setForm((prev) => ({
      ...prev,
      blueprint_code: nextPreset.blueprint_code,
      blueprint_name: nextPreset.blueprint_name,
      description: nextPreset.description,
      release_notes: nextPreset.release_notes,
    }));
    setPayload(nextPreset.payload);
    toast.success('Preset applied', `${nextPreset.title} starter loaded into the blueprint editor.`);
  };

  const resetToBlank = () => {
    setSelectedPresetId(null);
    setForm({
      blueprint_code: '',
      blueprint_name: '',
      description: '',
      status: 'draft',
      release_notes: '',
    });
    setPayload(emptyPayload());
  };

  if (isLoading) {
    return (
      <div className={styles.loaderBox} style={{ height: '60vh' }}>
        <Layers size={36} className={styles.spin} />
        <span>Loading blueprint...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate(isEdit && id ? `/nexus/blueprints/${id}` : '/nexus/blueprints')}>
            <ArrowLeft size={18} />
          </button>
          <div className={styles.iconBox}><Layers size={22} /></div>
          <div>
            <div className={styles.headerEyebrow}>Platform Blueprint Studio</div>
            <h1>{isEdit ? 'Edit Blueprint' : 'Create Blueprint'}</h1>
            <p>{isEdit ? 'Metadata changes only. New payload revisions are created from the blueprint detail page.' : 'Create a safe onboarding blueprint for new client setup.'}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.headerPill}>{isEdit ? 'Metadata only' : 'Initial version'}</span>
          <KitchenButton onClick={handleSubmit} isLoading={isSaving}>
            {isEdit ? <Save size={15} style={{ marginRight: 6 }} /> : <CopyPlus size={15} style={{ marginRight: 6 }} />}
            {isEdit ? 'Save Changes' : 'Create Blueprint'}
          </KitchenButton>
        </div>
      </header>

      <section className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}><Layers size={16} /></div>
          <div>
            <div className={styles.summaryLabel}>Mode</div>
            <div className={styles.summaryValue}>{isEdit ? 'Metadata update' : 'New blueprint'}</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryIconAccent}`}><Sparkles size={16} /></div>
          <div>
            <div className={styles.summaryLabel}>Configured sections</div>
            <div className={styles.summaryValue}>{payloadSummary.populatedSections}</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryIconSuccess}`}><CheckCircle2 size={16} /></div>
          <div>
            <div className={styles.summaryLabel}>Payload entries</div>
            <div className={styles.summaryValue}>{payloadSummary.totalEntries}</div>
          </div>
        </div>
      </section>

      <div className={styles.pageGrid}>
        {!isEdit ? (
          <KitchenCard className={styles.presetsCard}>
            <div className={styles.cardTopBar}>
              <div>
                <h3 className={styles.cardTitle}>Industry Blueprint Starters</h3>
                <p className={styles.cardHint}>Start from a standard onboarding template and adjust the payload before saving.</p>
              </div>
              <KitchenButton size="sm" variant="secondary" onClick={resetToBlank}>Start Blank</KitchenButton>
            </div>
            <div className={styles.presetGrid}>
              {blueprintPresets.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`${styles.presetCard} ${isSelected ? styles.presetCardSelected : ''}`}
                  >
                    <div>
                      <div className={styles.presetSubtitle}>{preset.subtitle}</div>
                      <div className={styles.presetTitle}>{preset.title}</div>
                    </div>
                    <div className={styles.presetSummary}>{preset.summary}</div>
                    <div className={styles.presetBestFor}>
                      <strong>Best for:</strong> {preset.bestFor}
                    </div>
                    <div className={styles.presetTags}>
                      <span className={styles.inlineBadge}>{preset.blueprint_code}</span>
                      <span className={styles.inlineBadge}>{preset.payload.categories.length} categories</span>
                      <span className={styles.inlineBadge}>{preset.payload.stations.length} stations</span>
                    </div>
                    <KitchenButton size="sm" variant={isSelected ? 'primary' : 'secondary'} onClick={() => applyPreset(preset.id)}>
                      {isSelected ? 'Applied' : 'Use This Starter'}
                    </KitchenButton>
                  </div>
                );
              })}
            </div>
          </KitchenCard>
        ) : null}

        <KitchenCard className={styles.masterCard}>
          <div className={styles.cardTopBar}>
            <div>
              <h3 className={styles.cardTitle}>Blueprint Master</h3>
              <p className={styles.cardHint}>Define the blueprint identity, rollout status, and release notes.</p>
            </div>
          </div>
          <div className={styles.masterGrid}>
            <KitchenInput
              label="Blueprint Code"
              value={form.blueprint_code}
              onChange={(event) => setForm((prev) => ({ ...prev, blueprint_code: event.target.value }))}
              disabled={isEdit}
              placeholder="e.g. hq-restaurant-standard"
              helpText="Stable unique identifier used for lookup and audit."
            />
            <KitchenInput
              label="Blueprint Name"
              value={form.blueprint_name}
              onChange={(event) => setForm((prev) => ({ ...prev, blueprint_name: event.target.value }))}
              placeholder="e.g. Restaurant HQ Starter"
              helpText="Business-facing name visible in blueprint management."
            />
            <KitchenSelect
              label="Status"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as BlueprintStatus }))}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'retired', label: 'Retired' },
              ]}
            />
            <div className={styles.textareaWrap}>
              <label className={styles.fieldLabel}>Description</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Summarize what this blueprint provisions and where it should be used."
              />
            </div>
            {!isEdit ? (
              <div className={styles.textareaWrap}>
                <label className={styles.fieldLabel}>Initial Version Notes</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={form.release_notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, release_notes: event.target.value }))}
                  placeholder="Document release assumptions or intended rollout scope."
                />
              </div>
            ) : null}
          </div>
        </KitchenCard>

        <KitchenCard className={styles.guardrailCard}>
          <div className={styles.cardTopBar}>
            <div>
              <h3 className={styles.cardTitle}><ShieldCheck size={16} /> Safety Boundary</h3>
              <p className={styles.cardHint}>Blueprints remain configuration-only and must not duplicate live tenant data.</p>
            </div>
          </div>
          <div className={styles.infoRows}>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Allowed</span><span className={styles.infoRowValue}>Settings, roles, HR masters, account masters, and menu/catalog taxonomies.</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Protection</span><span className={styles.infoRowValue}>Application creates only missing records and never crosses tenant boundaries.</span></div>
            <div className={styles.infoRow}><span className={styles.infoRowLabel}>Blocked</span><span className={styles.infoRowValue}>Branches, users, products, devices, and transactional data.</span></div>
          </div>
        </KitchenCard>
      </div>

      {!isEdit ? <BlueprintPayloadEditor payload={payload} setPayload={setPayload} /> : null}

      <div className={styles.bottomBar}>
        <KitchenButton variant="outline" onClick={() => navigate('/nexus/blueprints')}>
          Back to Blueprints
        </KitchenButton>
        <KitchenButton onClick={handleSubmit} isLoading={isSaving}>
          <Save size={15} style={{ marginRight: 6 }} />
          Save Blueprint
        </KitchenButton>
      </div>
    </div>
  );
}

export default BlueprintForm;
