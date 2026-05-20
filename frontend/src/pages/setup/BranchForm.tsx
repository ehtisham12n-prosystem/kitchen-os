import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Briefcase, Clock3, Hash, Mail, Phone, Save, Store, X } from 'lucide-react';
import { branchApi, setupApi } from '../../api/api';
import { readStoredUserContext } from '../../auth/access';
import { toast } from '../../components/ui/KitchenToast/toast';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import styles from './BranchForm.module.css';
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../utils/locationOptions';

const userContext = readStoredUserContext() || {};
const CURRENT_CLIENT_NAME = userContext.client_name || 'My Client';
const CURRENCY_OPTIONS = ['USD', 'PKR', 'SAR', 'AED', 'EUR', 'GBP', 'QAR', 'OMR', 'KWD', 'BHD'];
const DATE_FORMAT_OPTIONS = ['MMM DD, YYYY', 'DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const TIME_FORMAT_OPTIONS = ['hh:mma', 'hh:mm a', 'HH:mm', 'HH:mm:ss'];

function optionalValue(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function BranchForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);
    const [isSaving, setIsSaving] = useState(false);
    const [branchName, setBranchName] = useState('');
    const [shortName, setShortName] = useState('');
    const [branchCode, setBranchCode] = useState('AUTO');
    const [status, setStatus] = useState('setup_pending');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('Pakistan');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [taxRegion, setTaxRegion] = useState('');
    const [openingTime, setOpeningTime] = useState('');
    const [closingTime, setClosingTime] = useState('');
    const [currencyCode, setCurrencyCode] = useState('USD');
    const [dateFormat, setDateFormat] = useState('MMM DD, YYYY');
    const [timeFormat, setTimeFormat] = useState('hh:mma');
    const [inheritLanguage, setInheritLanguage] = useState(true);
    const [language, setLanguage] = useState('en');
    const [inheritTheme, setInheritTheme] = useState(true);
    const [themeId, setThemeId] = useState('');
    const [inventoryStoreType, setInventoryStoreType] = useState<'branch' | 'central'>('branch');
    const [isProductionSource, setIsProductionSource] = useState(false);
    const [productionSourceLabel, setProductionSourceLabel] = useState('');
    const [taxOptions, setTaxOptions] = useState<Array<{ value: string; label: string }>>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const taxes = await setupApi.getTaxes();
                setTaxOptions([
                    { value: '', label: 'No branch tax region selected' },
                    ...taxes
                        .filter((tax: any) => tax.is_active)
                        .map((tax: any) => ({
                            value: tax.tax_code,
                            label: `${tax.tax_name} (${tax.tax_code})`,
                        })),
                ]);

                if (!id) {
                    return;
                }

                const branch = await branchApi.getBranch(id);
                setBranchName(branch.branch_name || '');
                setShortName(branch.short_name || '');
                setBranchCode(branch.branch_code || 'AUTO');
                setStatus(branch.status || 'setup_pending');
                setAddress(branch.address || '');
                setCity(branch.city || '');
                setState(branch.state || '');
                setCountry(branch.country || 'Pakistan');
                setContactPerson(branch.contact_person || '');
                setPhone(branch.phone || '');
                setEmail(branch.email || '');
                setTaxRegion(branch.tax_region || '');
                setOpeningTime(branch.opening_time || '');
                setClosingTime(branch.closing_time || '');
                setCurrencyCode(branch.currency_code || branch.effective_settings?.currency_code || 'USD');
                setDateFormat(branch.date_format || branch.effective_settings?.date_format || 'MMM DD, YYYY');
                setTimeFormat(branch.time_format || branch.effective_settings?.time_format || 'hh:mma');
                setInheritLanguage(branch.inherit_client_language ?? true);
                setLanguage(branch.language || branch.effective_settings?.language || 'en');
                setInheritTheme(branch.inherit_client_theme ?? true);
                setThemeId(branch.theme_id || branch.effective_settings?.theme_id || '');
                setInventoryStoreType(branch.inventory_store_type || 'branch');
                setIsProductionSource(branch.is_production_source ?? false);
                setProductionSourceLabel(branch.production_source_label || '');
            } catch (error) {
                console.error('Failed to load branch:', error);
                toast.error('Load Failed', 'Could not load this branch record.');
            }
        };

        loadData();
    }, [id]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSaving(true);

        try {
            const payload = {
                branch_name: branchName,
                short_name: optionalValue(shortName),
                branch_code: branchCode === 'AUTO' ? undefined : branchCode,
                status,
                address,
                city,
                state: optionalValue(state),
                country,
                contact_person: optionalValue(contactPerson),
                phone: optionalValue(phone),
                email: optionalValue(email),
                tax_region: optionalValue(taxRegion),
                opening_time: openingTime,
                closing_time: closingTime,
                inherit_client_currency: false,
                currency_code: optionalValue(currencyCode) || 'USD',
                date_format: dateFormat,
                time_format: timeFormat,
                inherit_client_language: inheritLanguage,
                language: inheritLanguage ? undefined : optionalValue(language),
                inherit_client_theme: inheritTheme,
                theme_id: inheritTheme ? undefined : optionalValue(themeId),
                inventory_store_type: inventoryStoreType,
                is_production_source: isProductionSource,
                production_source_label: isProductionSource ? optionalValue(productionSourceLabel) : undefined,
            };

            if (isEditing) {
                await branchApi.updateBranch(id!, payload);
                toast.success('Branch Updated', 'Branch master data has been saved.');
            } else {
                await branchApi.createBranch(payload);
                toast.success('Branch Created', 'New branch has been added for this client.');
            }

            navigate('/console/setup/branches');
        } catch (error: any) {
            console.error('Save failed:', error);
            toast.error('Save Failed', error.message || 'Branch could not be saved.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.centerWrapper}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.iconBox}>
                            <Store size={26} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h1>{isEditing ? 'Update Operational Branch' : 'Establish New Branch'}</h1>
                            <p>Create controlled branch identity, readiness details, and minimum configuration boundaries.</p>
                        </div>
                    </div>
                </header>

                <form onSubmit={handleSubmit} className={styles.mainForm}>
                    <KitchenCard className={styles.cardSection}>
                        <div className={styles.sectionHeader}>
                            <Briefcase size={18} className={styles.sectionIcon} />
                            <h3 className={styles.sectionTitle}>Branch Identity and Control</h3>
                        </div>

                        <div className={styles.formBody}>
                            <div className={styles.row}>
                                <KitchenInput label="Client Name" value={CURRENT_CLIENT_NAME} disabled readOnly />
                                <KitchenSelect
                                    label="Operational Status"
                                    value={status}
                                    onChange={(event) => setStatus(event.target.value)}
                                    options={[
                                        { value: 'setup_pending', label: 'Setup Pending' },
                                        { value: 'inactive', label: 'Inactive' },
                                        { value: 'active', label: 'Active' },
                                        { value: 'suspended', label: 'Suspended' },
                                    ]}
                                    helpText="Only active branches can process normal operational writes. Setup pending, inactive, and suspended remain write-locked."
                                />
                            </div>

                            <div className={styles.row}>
                                <KitchenInput
                                    label="Branch Name"
                                    required
                                    value={branchName}
                                    onChange={(event) => {
                                        setBranchName(event.target.value);
                                        if (!isEditing && !shortName) {
                                            setShortName(event.target.value.slice(0, 20));
                                        }
                                    }}
                                    placeholder="e.g. Downtown Flagship"
                                />
                                <KitchenInput
                                    label="Short Name"
                                    value={shortName}
                                    onChange={(event) => setShortName(event.target.value)}
                                    placeholder="e.g. Downtown"
                                />
                            </div>

                            <div className={styles.row}>
                                <KitchenSelect
                                    label="Inventory Store Type"
                                    value={inventoryStoreType}
                                    onChange={(event) => setInventoryStoreType(event.target.value as 'branch' | 'central')}
                                    options={[
                                        { value: 'branch', label: 'Operational Branch Store' },
                                        { value: 'central', label: 'Central Store / Warehouse' },
                                    ]}
                                    helpText="Central stores can hold stock and dispatch to branches without being treated as a customer-facing outlet."
                                />
                                <div className={styles.storeTypeNote}>
                                    <strong>Batch 4 note:</strong> this controls whether the branch behaves as a normal branch inventory owner or a client-level central store for stock transfers.
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.toggleCard}>
                                    <label className={styles.toggleRow}>
                                        <input
                                            type="checkbox"
                                            checked={isProductionSource}
                                            onChange={(event) => {
                                                const enabled = event.target.checked;
                                                setIsProductionSource(enabled);
                                                if (!enabled) {
                                                    setProductionSourceLabel('');
                                                    return;
                                                }
                                                if (!productionSourceLabel.trim()) {
                                                    setProductionSourceLabel(
                                                        inventoryStoreType === 'central'
                                                            ? 'Central Kitchen'
                                                            : `${branchName || 'Production'} Kitchen`,
                                                    );
                                                }
                                            }}
                                        />
                                        <span>Enable as Production Supply Source</span>
                                    </label>
                                    <KitchenInput
                                        label="Production Source Label"
                                        value={productionSourceLabel}
                                        onChange={(event) => setProductionSourceLabel(event.target.value)}
                                        disabled={!isProductionSource}
                                        placeholder={inventoryStoreType === 'central' ? 'Central Kitchen' : 'Production Kitchen'}
                                    />
                                </div>
                                <div className={styles.storeTypeNote}>
                                    <strong>Batch 7 note:</strong> enable this only for a branch or central kitchen that is allowed to supply prepared or semi-prepared production items to other branches.
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.inputWrapper}>
                                    <Hash size={16} className={styles.inputIcon} />
                                    <KitchenInput
                                        label="Branch Code"
                                        value={branchCode}
                                        onChange={(event) => setBranchCode(event.target.value.toUpperCase())}
                                        disabled
                                        helpText="Generated and controlled by KitchenOS."
                                    />
                                </div>
                            </div>

                            <div className={styles.separator} />

                            <div className={styles.row}>
                                <KitchenInput
                                    label="Address"
                                    required
                                    value={address}
                                    onChange={(event) => setAddress(event.target.value)}
                                    placeholder="Street address"
                                />
                                <KitchenSelect
                                    label="City"
                                    required
                                    value={city}
                                    onChange={(event) => setCity(event.target.value)}
                                    options={CITY_OPTIONS as { value: string; label: string }[]}
                                />
                            </div>

                            <div className={styles.row}>
                                <KitchenInput
                                    label="State / Province"
                                    value={state}
                                    onChange={(event) => setState(event.target.value)}
                                    placeholder="State or province"
                                />
                                <KitchenSelect
                                    label="Country"
                                    required
                                    value={country}
                                    onChange={(event) => setCountry(event.target.value)}
                                    options={COUNTRY_OPTIONS as { value: string; label: string }[]}
                                />
                            </div>

                            <div className={styles.separator} />

                            <div className={styles.row}>
                                <KitchenInput
                                    label="Contact Person"
                                    value={contactPerson}
                                    onChange={(event) => setContactPerson(event.target.value)}
                                    placeholder="Primary branch contact"
                                />
                                <KitchenInput
                                    label="Phone"
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    placeholder="+92 300 0000000"
                                    icon={<Phone size={16} />}
                                />
                            </div>

                            <div className={styles.row}>
                                <KitchenInput
                                    label="Email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="branch@example.com"
                                    icon={<Mail size={16} />}
                                />
                                <KitchenSelect
                                    label="Tax Region"
                                    value={taxRegion}
                                    onChange={(event) => setTaxRegion(event.target.value)}
                                    options={taxOptions}
                                />
                            </div>

                            <div className={styles.row}>
                                <KitchenInput
                                    label="Opening Time"
                                    type="time"
                                    required
                                    value={openingTime}
                                    onChange={(event) => setOpeningTime(event.target.value)}
                                    icon={<Clock3 size={16} />}
                                />
                                <KitchenInput
                                    label="Closing Time"
                                    type="time"
                                    required
                                    value={closingTime}
                                    onChange={(event) => setClosingTime(event.target.value)}
                                    icon={<Clock3 size={16} />}
                                />
                            </div>

                            <div className={styles.configGrid}>
                                <div className={styles.toggleCard}>
                                    <label className={styles.toggleRow}>
                                        <span>Branch Currency</span>
                                    </label>
                                    <KitchenSelect
                                        label="Currency"
                                        value={currencyCode}
                                        onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
                                        options={CURRENCY_OPTIONS.map((currency) => ({ value: currency, label: currency }))}
                                    />
                                </div>
                                <div className={styles.toggleCard}>
                                    <label className={styles.toggleRow}>
                                        <span>Branch Date Format</span>
                                    </label>
                                    <KitchenSelect
                                        label="Date Format"
                                        value={dateFormat}
                                        onChange={(event) => setDateFormat(event.target.value)}
                                        options={DATE_FORMAT_OPTIONS.map((format) => ({ value: format, label: format }))}
                                    />
                                </div>
                                <div className={styles.toggleCard}>
                                    <label className={styles.toggleRow}>
                                        <span>Branch Time Format</span>
                                    </label>
                                    <KitchenSelect
                                        label="Time Format"
                                        value={timeFormat}
                                        onChange={(event) => setTimeFormat(event.target.value)}
                                        options={TIME_FORMAT_OPTIONS.map((format) => ({ value: format, label: format }))}
                                    />
                                </div>
                                <div className={styles.toggleCard}>
                                    <label className={styles.toggleRow}>
                                        <input type="checkbox" checked={inheritLanguage} onChange={(event) => setInheritLanguage(event.target.checked)} />
                                        <span>Inherit client language</span>
                                    </label>
                                    <KitchenInput
                                        label="Language Override"
                                        value={language}
                                        onChange={(event) => setLanguage(event.target.value)}
                                        disabled={inheritLanguage}
                                        placeholder="en"
                                    />
                                </div>
                                <div className={styles.toggleCard}>
                                    <label className={styles.toggleRow}>
                                        <input type="checkbox" checked={inheritTheme} onChange={(event) => setInheritTheme(event.target.checked)} />
                                        <span>Inherit client theme</span>
                                    </label>
                                    <KitchenInput
                                        label="Theme Override"
                                        value={themeId}
                                        onChange={(event) => setThemeId(event.target.value)}
                                        disabled={inheritTheme}
                                        placeholder="Optional theme id"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles.formFooter}>
                            <KitchenButton variant="ghost" onClick={() => navigate('/console/setup/branches')} type="button" size="sm">
                                <X size={16} style={{ marginRight: '6px' }} />
                                Cancel
                            </KitchenButton>
                            <KitchenButton
                                type="submit"
                                isLoading={isSaving}
                                disabled={isSaving || !branchName || !address || !city || !country || !openingTime || !closingTime}
                                size="sm"
                            >
                                <Save size={16} style={{ marginRight: '6px' }} />
                                {isEditing ? 'Update Branch' : 'Create Branch'}
                            </KitchenButton>
                        </div>
                    </KitchenCard>
                </form>
            </div>
        </div>
    );
}
