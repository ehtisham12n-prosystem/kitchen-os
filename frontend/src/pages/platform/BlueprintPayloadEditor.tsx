import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Trash2 } from 'lucide-react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import styles from './BlueprintForm.module.css';
import {
  emptyAccount,
  emptyCategory,
  emptyCuisineType,
  emptyDepartment,
  emptyDesignation,
  emptyMenuType,
  emptyRole,
  emptyStation,
  emptyUom,
} from './blueprintPayload';
import type { BlueprintPayloadDraft } from './blueprintPayload';

type Props = {
  payload: BlueprintPayloadDraft;
  setPayload: Dispatch<SetStateAction<BlueprintPayloadDraft>>;
};

type ArraySectionKey =
  | 'roles'
  | 'departments'
  | 'designations'
  | 'chart_of_accounts'
  | 'categories'
  | 'menu_types'
  | 'cuisine_types'
  | 'stations'
  | 'uoms';

export function BlueprintPayloadEditor({ payload, setPayload }: Props) {
  const updateArrayItem = <K extends ArraySectionKey>(section: K, index: number, patch: Partial<BlueprintPayloadDraft[K][number]>) => {
    setPayload((prev) => ({
      ...prev,
      [section]: prev[section].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const removeArrayItem = (section: ArraySectionKey, index: number) => {
    setPayload((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addArrayItem = (section: ArraySectionKey) => {
    const factories = {
      roles: emptyRole,
      departments: emptyDepartment,
      designations: emptyDesignation,
      chart_of_accounts: emptyAccount,
      categories: emptyCategory,
      menu_types: emptyMenuType,
      cuisine_types: emptyCuisineType,
      stations: emptyStation,
      uoms: emptyUom,
    };

    setPayload((prev) => ({
      ...prev,
      [section]: [...prev[section], factories[section]() as never],
    }));
  };

  return (
    <div className={styles.payloadGrid}>
      <KitchenCard className={`${styles.payloadCard} ${styles.payloadCardWide}`}>
        <div className={styles.cardTopBar}>
          <div>
            <h3 className={styles.cardTitle}>Settings Preset</h3>
            <p className={styles.cardHint}>Set the safe default organization profile applied during onboarding.</p>
          </div>
        </div>
        <div className={styles.formStack}>
          <div className={styles.twoColGrid}>
            <KitchenInput label="Currency" value={payload.settings.currency} onChange={(event) => setPayload((prev) => ({ ...prev, settings: { ...prev.settings, currency: event.target.value } }))} />
            <KitchenInput label="Timezone" value={payload.settings.timezone} onChange={(event) => setPayload((prev) => ({ ...prev, settings: { ...prev.settings, timezone: event.target.value } }))} />
          </div>
          <div className={styles.twoColGrid}>
            <KitchenInput label="Fiscal Year Start Month" type="number" value={payload.settings.fiscal_year_start} onChange={(event) => setPayload((prev) => ({ ...prev, settings: { ...prev.settings, fiscal_year_start: event.target.value } }))} />
            <KitchenInput label="Contact Email" type="email" value={payload.settings.contact_email} onChange={(event) => setPayload((prev) => ({ ...prev, settings: { ...prev.settings, contact_email: event.target.value } }))} />
          </div>
          <KitchenInput label="Contact Phone" value={payload.settings.contact_phone} onChange={(event) => setPayload((prev) => ({ ...prev, settings: { ...prev.settings, contact_phone: event.target.value } }))} />
          <div className={styles.textareaWrap}>
            <label className={styles.fieldLabel}>Address</label>
            <textarea className={styles.textarea} rows={3} value={payload.settings.address} onChange={(event) => setPayload((prev) => ({ ...prev, settings: { ...prev.settings, address: event.target.value } }))} />
          </div>
        </div>
      </KitchenCard>

      <ArraySectionCard title="Role Skeletons" onAdd={() => addArrayItem('roles')}>
        {payload.roles.map((role, index) => (
          <ItemCard key={`role-${index}`} onRemove={() => removeArrayItem('roles', index)}>
            <div className={styles.formStack}>
              <div className={styles.twoColGrid}>
                <KitchenInput label="Role Name" value={role.role_name} onChange={(event) => updateArrayItem('roles', index, { role_name: event.target.value })} />
                <KitchenInput label="Permissions (comma-separated)" value={role.permissions} onChange={(event) => updateArrayItem('roles', index, { permissions: event.target.value })} />
              </div>
              <KitchenInput label="Description" value={role.description} onChange={(event) => updateArrayItem('roles', index, { description: event.target.value })} />
              <div className={styles.fourColGrid}>
                <KitchenSelect label="Context" value={role.context_scope} onChange={(event) => updateArrayItem('roles', index, { context_scope: event.target.value as RoleDraft['context_scope'] })} options={[{ value: 'hybrid', label: 'Hybrid' }, { value: 'central', label: 'Central' }, { value: 'branch', label: 'Branch' }]} />
                <KitchenSelect label="Approval" value={role.approval_authority} onChange={(event) => updateArrayItem('roles', index, { approval_authority: event.target.value as RoleDraft['approval_authority'] })} options={[{ value: 'none', label: 'None' }, { value: 'branch', label: 'Branch' }, { value: 'central', label: 'Central' }, { value: 'both', label: 'Both' }]} />
                <KitchenSelect label="System Role" value={role.is_system_role ? 'yes' : 'no'} onChange={(event) => updateArrayItem('roles', index, { is_system_role: event.target.value === 'yes' })} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
                <KitchenSelect label="Active" value={role.is_active ? 'yes' : 'no'} onChange={(event) => updateArrayItem('roles', index, { is_active: event.target.value === 'yes' })} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
              </div>
            </div>
          </ItemCard>
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="Departments" onAdd={() => addArrayItem('departments')}>
        {payload.departments.map((item, index) => (
          <ItemCard key={`dept-${index}`} onRemove={() => removeArrayItem('departments', index)}>
            <div className={styles.formStack}>
              <div className={styles.threeColGrid}>
                <KitchenInput label="Code" value={item.code} onChange={(event) => updateArrayItem('departments', index, { code: event.target.value })} />
                <KitchenInput label="Name" value={item.name} onChange={(event) => updateArrayItem('departments', index, { name: event.target.value })} />
                <KitchenInput label="Head Name" value={item.head_name} onChange={(event) => updateArrayItem('departments', index, { head_name: event.target.value })} />
              </div>
              <KitchenInput label="Description" value={item.description} onChange={(event) => updateArrayItem('departments', index, { description: event.target.value })} />
            </div>
          </ItemCard>
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="Designations" onAdd={() => addArrayItem('designations')}>
        {payload.designations.map((item, index) => (
          <ItemCard key={`desg-${index}`} onRemove={() => removeArrayItem('designations', index)}>
            <div className={styles.formStack}>
              <div className={styles.fourColGrid}>
                <KitchenInput label="Code" value={item.code} onChange={(event) => updateArrayItem('designations', index, { code: event.target.value })} />
                <KitchenInput label="Name" value={item.name} onChange={(event) => updateArrayItem('designations', index, { name: event.target.value })} />
                <KitchenInput label="Level" value={item.level} onChange={(event) => updateArrayItem('designations', index, { level: event.target.value })} />
                <KitchenInput label="Department Name" value={item.department_name} onChange={(event) => updateArrayItem('designations', index, { department_name: event.target.value })} />
              </div>
              <KitchenInput label="Description" value={item.description} onChange={(event) => updateArrayItem('designations', index, { description: event.target.value })} />
            </div>
          </ItemCard>
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="Chart Of Accounts" onAdd={() => addArrayItem('chart_of_accounts')}>
        {payload.chart_of_accounts.map((item, index) => (
          <ItemCard key={`coa-${index}`} onRemove={() => removeArrayItem('chart_of_accounts', index)}>
            <div className={styles.formStack}>
              <div className={styles.accountGrid}>
                <KitchenInput label="Account Code" value={item.account_code} onChange={(event) => updateArrayItem('chart_of_accounts', index, { account_code: event.target.value })} />
                <KitchenInput label="Account Name" value={item.account_name} onChange={(event) => updateArrayItem('chart_of_accounts', index, { account_name: event.target.value })} />
                <KitchenSelect label="Type" value={item.account_type} onChange={(event) => updateArrayItem('chart_of_accounts', index, { account_type: event.target.value as AccountDraft['account_type'] })} options={[{ value: 'asset', label: 'Asset' }, { value: 'liability', label: 'Liability' }, { value: 'equity', label: 'Equity' }, { value: 'revenue', label: 'Revenue' }, { value: 'expense', label: 'Expense' }]} />
                <KitchenInput label="Parent Code" value={item.parent_code} onChange={(event) => updateArrayItem('chart_of_accounts', index, { parent_code: event.target.value })} />
              </div>
            </div>
          </ItemCard>
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="Categories" onAdd={() => addArrayItem('categories')}>
        {payload.categories.map((item, index) => (
          <ItemCard key={`cat-${index}`} onRemove={() => removeArrayItem('categories', index)}>
            <div className={styles.formStack}>
              <div className={styles.categoryGrid}>
                <KitchenInput label="Template Key" value={item.template_key} onChange={(event) => updateArrayItem('categories', index, { template_key: event.target.value })} />
                <KitchenInput label="Category Name" value={item.category_name} onChange={(event) => updateArrayItem('categories', index, { category_name: event.target.value })} />
                <KitchenInput label="Sort Order" type="number" value={item.category_sort_order} onChange={(event) => updateArrayItem('categories', index, { category_sort_order: event.target.value })} />
                <KitchenInput label="Parent Ref" value={item.parent_template_key} onChange={(event) => updateArrayItem('categories', index, { parent_template_key: event.target.value })} />
              </div>
              <KitchenInput label="Description" value={item.category_description} onChange={(event) => updateArrayItem('categories', index, { category_description: event.target.value })} />
            </div>
          </ItemCard>
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="Menu Types" onAdd={() => addArrayItem('menu_types')}>
        {payload.menu_types.map((item, index) => (
          <SimpleNameCodeCard key={`menu-${index}`} item={item} onRemove={() => removeArrayItem('menu_types', index)} onChange={(patch) => updateArrayItem('menu_types', index, patch)} />
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="Cuisine Types" onAdd={() => addArrayItem('cuisine_types')}>
        {payload.cuisine_types.map((item, index) => (
          <SimpleNameCodeCard key={`cuisine-${index}`} item={item} onRemove={() => removeArrayItem('cuisine_types', index)} onChange={(patch) => updateArrayItem('cuisine_types', index, patch)} />
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="Stations" onAdd={() => addArrayItem('stations')}>
        {payload.stations.map((item, index) => (
          <ItemCard key={`station-${index}`} onRemove={() => removeArrayItem('stations', index)}>
            <div className={styles.formStack}>
              <div className={styles.fourColGrid}>
                <KitchenInput label="Name" value={item.name} onChange={(event) => updateArrayItem('stations', index, { name: event.target.value })} />
                <KitchenInput label="Code" value={item.code} onChange={(event) => updateArrayItem('stations', index, { code: event.target.value })} />
                <KitchenInput label="Display Order" type="number" value={item.kitchen_display_order} onChange={(event) => updateArrayItem('stations', index, { kitchen_display_order: event.target.value })} />
                <KitchenInput label="Description" value={item.description} onChange={(event) => updateArrayItem('stations', index, { description: event.target.value })} />
              </div>
            </div>
          </ItemCard>
        ))}
      </ArraySectionCard>

      <ArraySectionCard title="UOMs" onAdd={() => addArrayItem('uoms')}>
        {payload.uoms.map((item, index) => (
          <ItemCard key={`uom-${index}`} onRemove={() => removeArrayItem('uoms', index)}>
            <div className={styles.formStack}>
              <div className={styles.uomGrid}>
                <KitchenInput label="Template Key" value={item.template_key} onChange={(event) => updateArrayItem('uoms', index, { template_key: event.target.value })} />
                <KitchenInput label="Name" value={item.name} onChange={(event) => updateArrayItem('uoms', index, { name: event.target.value })} />
                <KitchenInput label="Abbreviation" value={item.abbreviation} onChange={(event) => updateArrayItem('uoms', index, { abbreviation: event.target.value })} />
                <KitchenInput label="Base Ref" value={item.base_template_key} onChange={(event) => updateArrayItem('uoms', index, { base_template_key: event.target.value })} />
                <KitchenInput label="Conversion" type="number" value={item.conversion_factor} onChange={(event) => updateArrayItem('uoms', index, { conversion_factor: event.target.value })} />
              </div>
              <KitchenInput label="Description" value={item.description} onChange={(event) => updateArrayItem('uoms', index, { description: event.target.value })} />
            </div>
          </ItemCard>
        ))}
      </ArraySectionCard>
    </div>
  );
}

function ArraySectionCard({ title, onAdd, children }: { title: string; onAdd: () => void; children: ReactNode }) {
  return (
    <KitchenCard className={styles.payloadCard}>
      <div className={styles.tabContentHeader}>
        <h3>{title}</h3>
        <KitchenButton size="sm" variant="secondary" onClick={onAdd}>Add</KitchenButton>
      </div>
      <div className={styles.sectionBody}>
        {children || <p className={styles.emptyText}>No items added yet.</p>}
      </div>
    </KitchenCard>
  );
}

function ItemCard({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className={styles.itemCard}>
      <div className={styles.itemCardToolbar}>
        <KitchenButton size="sm" variant="danger" onClick={onRemove}>
          <Trash2 size={14} style={{ marginRight: 6 }} />
          Remove
        </KitchenButton>
      </div>
      {children}
    </div>
  );
}

function SimpleNameCodeCard({
  item,
  onRemove,
  onChange,
}: {
  item: { name: string; code: string; description: string; sort_order: string };
  onRemove: () => void;
  onChange: (patch: Partial<typeof item>) => void;
}) {
  return (
    <ItemCard onRemove={onRemove}>
      <div className={styles.formStack}>
        <div className={styles.nameCodeGrid}>
          <KitchenInput label="Name" value={item.name} onChange={(event) => onChange({ name: event.target.value })} />
          <KitchenInput label="Code" value={item.code} onChange={(event) => onChange({ code: event.target.value })} />
          <KitchenInput label="Sort Order" type="number" value={item.sort_order} onChange={(event) => onChange({ sort_order: event.target.value })} />
        </div>
        <KitchenInput label="Description" value={item.description} onChange={(event) => onChange({ description: event.target.value })} />
      </div>
    </ItemCard>
  );
}

type RoleDraft = BlueprintPayloadDraft['roles'][number];
type AccountDraft = BlueprintPayloadDraft['chart_of_accounts'][number];
