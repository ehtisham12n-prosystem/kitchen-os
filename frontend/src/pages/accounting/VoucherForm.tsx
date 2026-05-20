/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Lock,
  Receipt,
  Save,
  Search,
  User,
} from 'lucide-react';
import { accountingApi, inventoryApi, userApi, vendorApi } from '../../api/api';
import { useBranchContext } from '../../hooks/useBranchContext';
import {
  formatConfiguredCompensationVoucherNumber,
  formatConfiguredExpenseVoucherNumber,
  formatConfiguredGrnNumber,
  formatConfiguredPaymentVoucherNumber,
} from '../pos/printTemplates/printHelpers';
import styles from './VoucherForm.module.css';

type VoucherType = 'EXPENSE' | 'PAYMENT' | 'COMPENSATION' | 'PURCHASE_CREDIT_NOTE';
type PartyType = 'VENDOR' | 'EMPLOYEE' | 'OTHER';
type PeriodLockState = {
  mode: 'none' | 'admin_override' | 'hard_lock';
  locked_through_date?: string | null;
  updated_by?: string | null;
};

interface VoucherFormState {
  type: VoucherType;
  party_type: PartyType;
  party_id: string;
  party_name: string;
  amount: string;
  date: string;
  payment_method: string;
  treasury_account_id: string;
  linked_grn_id: string;
  reference_no: string;
  description: string;
  branch_id: string;
  expense_account_id: string;
}

interface AccountOption {
  id: string;
  name: string;
  branch_id: number | null;
  description?: string | null;
  usage_guidance?: string | null;
  example_entry?: string | null;
  confusion_note?: string | null;
  is_bank_account: boolean;
  is_cash_account: boolean;
  is_control_account: boolean;
  is_system: boolean;
  allow_manual_posting: boolean;
  account_type: string;
}

interface GrnOption {
  id: string;
  branch_id: number;
  vendor_id: string;
  label: string;
  payable_status: string;
  open_amount: number;
}

const EMPTY_FORM = (branchId?: number | null): VoucherFormState => ({
  type: 'EXPENSE',
  party_type: 'OTHER',
  party_id: '',
  party_name: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  payment_method: 'Cash',
  treasury_account_id: '',
  linked_grn_id: '',
  reference_no: '',
  description: '',
  branch_id: branchId ? String(branchId) : '',
  expense_account_id: '',
});

const PAYMENT_METHOD_OPTIONS = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Wallet', 'Card', 'Credit Purchase'];

export function VoucherForm() {
  const navigate = useNavigate();
  const { tenantSlug, id } = useParams();
  const { branches, activeBranch } = useBranchContext();
  const consoleBase = tenantSlug ? `/console/${tenantSlug}` : '/console';
  const isEdit = !!id;

  const [formData, setFormData] = useState<VoucherFormState>(EMPTY_FORM(activeBranch?.branch_id));
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [grns, setGrns] = useState<GrnOption[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<AccountOption[]>([]);
  const [periodLock, setPeriodLock] = useState<PeriodLockState | null>(null);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenseAccountSearch, setExpenseAccountSearch] = useState('');
  const [treasuryAccountSearch, setTreasuryAccountSearch] = useState('');

  const formatVisibleVoucherNumber = useCallback((rawValue: string, voucherType: VoucherType) => {
    if (!rawValue) return '';
    if (voucherType === 'PAYMENT') {
      return formatConfiguredPaymentVoucherNumber(rawValue, activeBranch, { preserveTypePrefix: true }) || rawValue;
    }
    if (voucherType === 'COMPENSATION') {
      return formatConfiguredCompensationVoucherNumber(rawValue, activeBranch, { preserveTypePrefix: true }) || rawValue;
    }
    return formatConfiguredExpenseVoucherNumber(rawValue, activeBranch, { preserveTypePrefix: true }) || rawValue;
  }, [activeBranch]);

  useEffect(() => {
    if (formData.type === 'EXPENSE') {
      return;
    }

    const nextPartyType: PartyType =
      formData.type === 'PAYMENT' || formData.type === 'PURCHASE_CREDIT_NOTE' ? 'VENDOR' : 'EMPLOYEE';

    setFormData((prev) => ({
      ...prev,
      party_type: nextPartyType,
      party_id: nextPartyType === prev.party_type ? prev.party_id : '',
      party_name: nextPartyType === prev.party_type ? prev.party_name : '',
      expense_account_id: '',
      payment_method: formData.type === 'PURCHASE_CREDIT_NOTE' ? '' : prev.payment_method,
      treasury_account_id: formData.type === 'PURCHASE_CREDIT_NOTE' ? '' : prev.treasury_account_id,
    }));
  }, [formData.type]);

  const load = useCallback(async () => {
      setBooting(true);
      setError(null);
      try {
        const [vendorResponse, employeeResponse, accountsResponse, grnResponse, voucherResponse] = await Promise.all([
          vendorApi.getVendors().catch(() => []),
          userApi.getUsers().catch(() => []),
          accountingApi.getAccounts().catch(() => []),
          inventoryApi.getGrns().catch(() => []),
          id ? accountingApi.getFinancialVoucher(id) : Promise.resolve(null),
        ]);

        setVendors((vendorResponse ?? []).map((vendor: any) => ({
          id: String(vendor.id),
          name: vendor.vendor_name ?? vendor.name ?? `Vendor ${vendor.id}`,
        })));
        setEmployees((employeeResponse ?? []).map((user: any) => ({
          id: String(user.id),
          name: user.full_name ?? user.username ?? user.name ?? `User ${user.id}`,
        })));
        setGrns((grnResponse ?? [])
          .filter((grn: any) => grn.status === 'posted')
          .map((grn: any) => ({
            id: String(grn.id),
            branch_id: Number(grn.branch_id),
            vendor_id: grn.vendor_id ? String(grn.vendor_id) : '',
            payable_status: String(grn.payable_status ?? ''),
            open_amount: Number(grn.payable?.accrued_amount ?? 0),
            label: `${formatConfiguredGrnNumber(grn.grn_number ?? `GRN-${grn.id}`, activeBranch || grn, { preserveTypePrefix: true }) || grn.grn_number || `GRN-${grn.id}`} · ${grn.vendor?.vendor_name ?? 'Vendor'} · ${Number(grn.payable?.accrued_amount ?? 0).toLocaleString()}`,
          })));

        const flattenAccounts = (accounts: any[]): AccountOption[] =>
          accounts.flatMap((account) => {
            const current: AccountOption[] = [{
              id: String(account.id),
              name: `${account.account_code} - ${account.account_name}`,
              branch_id: account.branch_id ? Number(account.branch_id) : null,
              description: account.description ?? null,
              usage_guidance: account.usage_guidance ?? null,
              example_entry: account.example_entry ?? null,
              confusion_note: account.confusion_note ?? null,
              is_bank_account: account.is_bank_account === true,
              is_cash_account: account.is_cash_account === true,
              is_control_account: account.is_control_account === true,
              is_system: account.is_system === true,
              allow_manual_posting: account.allow_manual_posting !== false,
              account_type: String(account.account_type ?? ''),
            }];
            return [...current, ...(account.children ? flattenAccounts(account.children) : [])];
          });

        const flatAccounts = flattenAccounts(accountsResponse ?? []);
        setExpenseAccounts(
          flatAccounts.filter((account) =>
            account.account_type === 'expense'
            && !account.is_control_account,
          ),
        );
        setTreasuryAccounts(
          flatAccounts.filter((account) => account.is_bank_account || account.is_cash_account),
        );

        if (voucherResponse) {
          setVoucherNumber(formatVisibleVoucherNumber(voucherResponse.voucher_no ?? '', voucherResponse.type));
          setFormData({
            type: voucherResponse.type,
            party_type: voucherResponse.party_type ?? 'OTHER',
            party_id: voucherResponse.party_id ?? '',
            party_name: voucherResponse.party_name ?? '',
            amount: String(Number(voucherResponse.amount ?? 0)),
            date: voucherResponse.date,
            payment_method: voucherResponse.payment_method ?? 'Cash',
            treasury_account_id: voucherResponse.treasury_account_id ? String(voucherResponse.treasury_account_id) : '',
            linked_grn_id: voucherResponse.linked_grn_id ? String(voucherResponse.linked_grn_id) : '',
            reference_no: voucherResponse.reference_no ?? '',
            description: voucherResponse.description ?? '',
            branch_id: voucherResponse.branch_id ? String(voucherResponse.branch_id) : '',
            expense_account_id: voucherResponse.expense_account_id ? String(voucherResponse.expense_account_id) : '',
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load voucher form');
        setVoucherNumber('');
      } finally {
        setBooting(false);
      }
    }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const branchId = formData.branch_id || (activeBranch?.branch_id ? String(activeBranch.branch_id) : '');
    if (!branchId) {
      setPeriodLock(null);
      return;
    }

    const loadPeriodLock = async () => {
      try {
        const response = await accountingApi.getPeriodLock({ branch_id: branchId });
        setPeriodLock(response ?? null);
      } catch {
        setPeriodLock(null);
      }
    };

    void loadPeriodLock();
  }, [formData.branch_id, activeBranch?.branch_id]);

  const branchOptions = useMemo(
    () => branches.map((branch) => ({ id: String(branch.branch_id), name: branch.branch_name || `Branch ${branch.branch_id}` })),
    [branches],
  );

  const filteredTreasuryAccounts = useMemo(() => {
    if (formData.payment_method === 'Credit Purchase') {
      return [];
    }
    const branchId = formData.branch_id ? Number(formData.branch_id) : null;
    const isCashMethod = formData.payment_method === 'Cash';
    const isBankMethod = ['Bank Transfer', 'Cheque', 'Mobile Wallet', 'Card'].includes(formData.payment_method);
    return treasuryAccounts.filter((account) => {
      const branchMatch = account.branch_id === null || account.branch_id === branchId;
      if (!branchMatch) return false;
      if (isCashMethod) return account.is_cash_account;
      if (isBankMethod) return account.is_bank_account;
      return account.is_bank_account || account.is_cash_account;
    });
  }, [formData.branch_id, formData.payment_method, treasuryAccounts]);

  const filteredExpenseAccounts = useMemo(() => {
    const branchId = formData.branch_id ? Number(formData.branch_id) : null;
    return expenseAccounts.filter((account) =>
      (account.branch_id === null || account.branch_id === branchId)
      && !account.is_control_account,
    );
  }, [expenseAccounts, formData.branch_id]);

  const filteredGrns = useMemo(() => {
    if (formData.type !== 'PURCHASE_CREDIT_NOTE') {
      return [];
    }
    const branchId = formData.branch_id ? Number(formData.branch_id) : null;
    return grns.filter((grn) => {
      const branchMatch = branchId === null || grn.branch_id === branchId;
      const vendorMatch = !formData.party_id || grn.vendor_id === formData.party_id;
      return branchMatch && vendorMatch && grn.open_amount > 0.009;
    });
  }, [formData.branch_id, formData.party_id, formData.type, grns]);

  const currentPartyOptions = formData.party_type === 'VENDOR' ? vendors : employees;
  const selectedTreasuryAccount = filteredTreasuryAccounts.find((account) => account.id === formData.treasury_account_id);
  const selectedExpenseAccount = filteredExpenseAccounts.find((account) => account.id === formData.expense_account_id);
  const selectedGrn = filteredGrns.find((grn) => grn.id === formData.linked_grn_id);
  const isLockedPeriod = periodLock?.mode === 'hard_lock' && !!periodLock.locked_through_date && formData.date <= periodLock.locked_through_date;
  const isCreditPurchase = formData.type === 'EXPENSE' && formData.payment_method === 'Credit Purchase';
  const isPurchaseCreditNote = formData.type === 'PURCHASE_CREDIT_NOTE';
  const selectedVoucherTypeDescription = useMemo(() => {
    switch (formData.type) {
      case 'PAYMENT':
        return 'Use Vendor Payment when you are paying a vendor from cash or bank for something that is already payable. This voucher clears the vendor balance. It is for payment settlement, not for recording a new expense.';
      case 'COMPENSATION':
        return 'Use Compensation when you are paying an employee or making a compensation-related payout from a treasury source. This is for money going out to a staff-related party, not for vendor purchases.';
      case 'EXPENSE':
        return 'Use Direct Expense when the branch directly spent money on something like fuel, courier, stationery, urgent supplies, or another operating cost. You will choose both what type of expense it is and where the payment came from.';
      case 'PURCHASE_CREDIT_NOTE':
        return 'Use Purchase Credit Note when a vendor bill needs to be reduced against a linked GRN, such as price correction, return adjustment, or vendor credit. This reduces the purchase liability without paying out cash.';
      default:
        return '';
    }
  }, [formData.type]);

  useEffect(() => {
    setExpenseAccountSearch(selectedExpenseAccount?.name || '');
  }, [selectedExpenseAccount?.id, selectedExpenseAccount?.name]);

  useEffect(() => {
    setTreasuryAccountSearch(selectedTreasuryAccount?.name || '');
  }, [selectedTreasuryAccount?.id, selectedTreasuryAccount?.name]);

  const handleExpenseAccountSearchChange = (value: string) => {
    setExpenseAccountSearch(value);
    const exactMatch = filteredExpenseAccounts.find((account) => account.name === value);
    setFormData((prev) => ({ ...prev, expense_account_id: exactMatch ? exactMatch.id : '' }));
  };

  const handleTreasuryAccountSearchChange = (value: string) => {
    setTreasuryAccountSearch(value);
    const exactMatch = filteredTreasuryAccounts.find((account) => account.name === value);
    setFormData((prev) => ({ ...prev, treasury_account_id: exactMatch ? exactMatch.id : '' }));
  };

  const renderAccountGuide = (account?: AccountOption | null) => {
    if (!account || (!account.description && !account.usage_guidance && !account.example_entry && !account.confusion_note)) {
      return null;
    }

    return (
      <div className={styles.accountGuide}>
        {account.description ? <span><strong>Purpose:</strong> {account.description}</span> : null}
        {account.usage_guidance ? <span><strong>Use:</strong> {account.usage_guidance}</span> : null}
        {account.example_entry ? <span><strong>Example:</strong> {account.example_entry}</span> : null}
        {account.confusion_note ? <span><strong>Watch out:</strong> {account.confusion_note}</span> : null}
      </div>
    );
  };

  const renderHelpTooltip = (
    label: string,
    content: {
      purpose: string;
      use?: string;
      example?: string;
      watchOut?: string;
    },
  ) => (
    <label className={styles.labelWithHelp}>
      <span>{label}</span>
      <span className={styles.tooltipWrap}>
        <button
          type="button"
          className={styles.tooltipTrigger}
          aria-label={`${label} guidance`}
          onClick={(event) => event.preventDefault()}
        >
          <CircleHelp size={14} />
        </button>
        <span className={styles.tooltipCard} role="tooltip">
          <span><strong>Purpose:</strong> {content.purpose}</span>
          {content.use ? <span><strong>Use:</strong> {content.use}</span> : null}
          {content.example ? <span><strong>Example:</strong> {content.example}</span> : null}
          {content.watchOut ? <span><strong>Watch out:</strong> {content.watchOut}</span> : null}
        </span>
      </span>
    </label>
  );

  const validationMessage = useMemo(() => {
    if (!formData.branch_id) return 'Branch is required.';
    if (!formData.amount || Number(formData.amount) <= 0) return 'Amount must be greater than zero.';
    if (!isCreditPurchase && !isPurchaseCreditNote && !formData.treasury_account_id) return 'Treasury account is required.';
    if (formData.type === 'EXPENSE' && !formData.expense_account_id) return 'Expense account is required for direct expenses.';
    if (formData.type === 'EXPENSE' && formData.party_type === 'VENDOR' && !formData.party_id && !formData.party_name.trim()) return 'Vendor details are required for vendor-linked expenses.';
    if (isCreditPurchase && !formData.party_id && !formData.party_name.trim()) return 'Credit purchases require vendor details.';
    if (formData.type === 'PAYMENT' && !formData.party_id) return 'Vendor is required for payment vouchers.';
    if (formData.type === 'COMPENSATION' && !formData.party_id) return 'Employee is required for compensation vouchers.';
    if (isPurchaseCreditNote && !formData.party_id) return 'Vendor is required for purchase credit notes.';
    if (isPurchaseCreditNote && !formData.linked_grn_id) return 'Linked GRN is required for purchase credit notes.';
    if (isLockedPeriod) return 'This voucher date falls in a hard-locked accounting period.';
    return null;
  }, [formData, isLockedPeriod, isCreditPurchase, isPurchaseCreditNote]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        type: formData.type,
        party_type: formData.party_type,
        party_id: formData.party_id || undefined,
        party_name: formData.party_name || undefined,
        amount: Number(formData.amount || 0),
        date: formData.date,
        payment_method: isPurchaseCreditNote ? undefined : (formData.payment_method || undefined),
        treasury_account_id: isCreditPurchase || isPurchaseCreditNote ? undefined : (formData.treasury_account_id ? Number(formData.treasury_account_id) : undefined),
        reference_no: formData.reference_no || undefined,
        description: formData.description || undefined,
        branch_id: Number(formData.branch_id),
        expense_account_id: formData.expense_account_id ? Number(formData.expense_account_id) : undefined,
        linked_grn_id: formData.linked_grn_id ? Number(formData.linked_grn_id) : undefined,
      };

      if (isEdit && id) {
        await accountingApi.updateFinancialVoucher(id, payload);
      } else {
        const createdVoucher: any = await accountingApi.createFinancialVoucher(payload);
        setVoucherNumber(formatVisibleVoucherNumber(createdVoucher?.voucher_no ?? '', createdVoucher?.type || formData.type));
      }
      navigate(`${consoleBase}/accounting/vouchers`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: VoucherType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      treasury_account_id: '',
      linked_grn_id: '',
      expense_account_id: type === 'EXPENSE' ? prev.expense_account_id : '',
      payment_method: type === 'PURCHASE_CREDIT_NOTE' ? '' : prev.payment_method,
      party_type: type === 'PAYMENT' || type === 'PURCHASE_CREDIT_NOTE' ? 'VENDOR' : type === 'COMPENSATION' ? 'EMPLOYEE' : prev.party_type,
    }));
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
          </button>
          <div className={styles.headerIcon}>
            <Receipt size={20} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>{isEdit ? 'Edit Voucher' : 'Record Voucher'}</h1>
            <p className={styles.pageSubtitle}>Log finance-reviewed cash, bank, payment, and expense entries</p>
          </div>
        </div>
      </div>

      {periodLock?.mode && periodLock.mode !== 'none' && (
        <div className={styles.lockBanner}>
          <Lock size={16} />
          <span>
            {periodLock.mode === 'hard_lock' ? 'Hard period lock active.' : 'Admin override lock active.'}
            {' '}Locked through {periodLock.locked_through_date || '-'}{periodLock.updated_by ? ` by ${periodLock.updated_by}` : ''}.
          </span>
        </div>
      )}

      {error && (
        <div className={styles.errorCard}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formHero}>
          <div className={styles.formHeroText}>
            <span className={styles.heroEyebrow}>Finance Entry</span>
            <h2 className={styles.formHeroTitle}>{isEdit ? 'Update Voucher' : 'Create Voucher'}</h2>
            <p className={styles.formHeroLead}>
              Record the voucher type, party, settlement source, and narration in one controlled workflow so accounting review stays consistent.
            </p>
          </div>
          <div className={styles.heroMetrics}>
            <div className={styles.heroMetric}>
              <span>Voucher Type</span>
              <strong>{formData.type.replaceAll('_', ' ')}</strong>
            </div>
            <div className={styles.heroMetric}>
              <span>Voucher Date</span>
              <strong>{formData.date || '-'}</strong>
            </div>
            <div className={styles.heroMetric}>
              <span>Voucher Number</span>
              <strong>{voucherNumber || 'Auto-generated on save'}</strong>
            </div>
          </div>
        </div>

        <div className={styles.voucherShell}>
          <div className={styles.voucherMain}>
            <div className={styles.sectionTitle}>
              <h3>Voucher Type</h3>
              <div className={styles.sectionDivider} />
            </div>

            <div className={styles.typeCards}>
              <div
                className={`${styles.typeCard} ${formData.type === 'PAYMENT' ? styles.typeCardActive : ''}`}
                onClick={() => handleTypeChange('PAYMENT')}
              >
                <Building2 className={styles.typeIcon} size={18} />
                <span className={styles.typeName}>Vendor Payment</span>
              </div>
              <div
                className={`${styles.typeCard} ${formData.type === 'COMPENSATION' ? styles.typeCardActive : ''}`}
                onClick={() => handleTypeChange('COMPENSATION')}
              >
                <User className={styles.typeIcon} size={18} />
                <span className={styles.typeName}>Compensation</span>
              </div>
              <div
                className={`${styles.typeCard} ${formData.type === 'EXPENSE' ? styles.typeCardActive : ''}`}
                onClick={() => handleTypeChange('EXPENSE')}
              >
                <CreditCard className={styles.typeIcon} size={18} />
                <span className={styles.typeName}>Direct Expense</span>
              </div>
              <div
                className={`${styles.typeCard} ${formData.type === 'PURCHASE_CREDIT_NOTE' ? styles.typeCardActive : ''}`}
                onClick={() => handleTypeChange('PURCHASE_CREDIT_NOTE')}
              >
                <Receipt className={styles.typeIcon} size={18} />
                <span className={styles.typeName}>Purchase Credit Note</span>
              </div>
            </div>
            <div className={styles.typeDescriptionCard}>
              <span>{selectedVoucherTypeDescription}</span>
            </div>

            <div className={styles.sectionTitle}>
              <h3>Primary Details</h3>
              <div className={styles.sectionDivider} />
            </div>

            <div className={`${styles.sectionCard} ${styles.grid}`}>
          <div className={styles.field}>
            <label className={styles.label}>Voucher Number</label>
            <input
              type="text"
              className={styles.input}
              value={voucherNumber || 'Auto-generated on save'}
              disabled
            />
            <span className={styles.helperText}>The system assigns the voucher number automatically when you save.</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Select Branch</label>
            <select
              className={styles.select}
              required
              value={formData.branch_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, branch_id: e.target.value, treasury_account_id: '', expense_account_id: '', linked_grn_id: '' }))}
            >
              <option value="">Choose a branch...</option>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Voucher Date</label>
            <input
              type="date"
              className={styles.input}
              required
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              {formData.party_type === 'VENDOR' ? 'Select Vendor' :
                formData.party_type === 'EMPLOYEE' ? 'Select Employee' : 'Payee Name'}
            </label>
            <div className={styles.inputWrapper}>
              {formData.party_type === 'OTHER' ? (
                <input
                  type="text"
                  placeholder="Enter name..."
                  className={styles.input}
                  required
                  value={formData.party_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, party_name: e.target.value }))}
                />
              ) : (
                <>
                  <select
                    className={styles.select}
                    required
                    value={formData.party_id}
                    onChange={(e) => {
                      const selected = currentPartyOptions.find((item) => item.id === e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        party_id: e.target.value,
                        party_name: selected?.name || '',
                        linked_grn_id: formData.type === 'PURCHASE_CREDIT_NOTE' ? '' : prev.linked_grn_id,
                      }));
                    }}
                    disabled={booting}
                  >
                    <option value="">Select...</option>
                    {currentPartyOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className={styles.selectChevron} />
                </>
              )}
            </div>
          </div>

          {formData.type === 'EXPENSE' && (
            <div className={styles.field}>
              <label className={styles.label}>Expense Vendor Mode</label>
              <div className={styles.inputWrapper}>
                <select
                  className={styles.select}
                  value={formData.party_type}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    party_type: e.target.value as PartyType,
                    party_id: '',
                    party_name: '',
                  }))}
                >
                  <option value="OTHER">One-Time Vendor / Other</option>
                  <option value="VENDOR">Registered Vendor</option>
                </select>
                <ChevronDown size={14} className={styles.selectChevron} />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Amount (PKR)</label>
            <input
              type="number"
              placeholder="0.00"
              className={styles.input}
              required
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>

          {isPurchaseCreditNote ? (
            <div className={styles.field}>
              <label className={styles.label}>Linked GRN</label>
              <div className={styles.inputWrapper}>
                <select
                  className={styles.select}
                  value={formData.linked_grn_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linked_grn_id: e.target.value }))}
                >
                  <option value="">Select linked GRN...</option>
                  {filteredGrns.map((grn) => (
                    <option key={grn.id} value={grn.id}>{grn.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className={styles.selectChevron} />
              </div>
              {selectedGrn && (
                <span className={styles.helperText}>
                  {selectedGrn.payable_status === 'bill_received' ? 'AP' : 'GRNI'} will be reduced on approval. Open amount: PKR {selectedGrn.open_amount.toLocaleString()}.
                </span>
              )}
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label}>Payment Method</label>
              <div className={styles.inputWrapper}>
                <select
                  className={styles.select}
                  value={formData.payment_method}
                  onChange={(e) => setFormData((prev) => ({ ...prev, payment_method: e.target.value, treasury_account_id: '' }))}
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown size={14} className={styles.selectChevron} />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Reference #</label>
            <input
              type="text"
              placeholder="Ref, ID, cheque no, etc."
              className={styles.input}
              value={formData.reference_no}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference_no: e.target.value }))}
            />
          </div>

          {formData.type === 'EXPENSE' ? (
            <>
            <div className={styles.field}>
              {renderHelpTooltip('Expense Account (COA)', {
                purpose: 'This field determines which expense ledger the voucher amount will be booked into.',
                use: 'Pick the account that best explains the nature of the spend for reporting and review.',
                example: 'Courier fuel goes to transport or fuel expense, while urgent packaging goes to packaging or operating supplies.',
                watchOut: 'Do not choose a payment-source account here. Expense account explains the spend type, not how it was paid.',
              })}
              <span className={styles.helperText}>
                Select the expense COA that explains what kind of business spend this voucher belongs to.
              </span>
              <div className={styles.inputWrapper}>
                <Search size={14} className={styles.selectChevron} />
                <input
                  className={styles.input}
                  list="voucher-expense-account-options"
                  placeholder="Search and select expense account"
                  value={expenseAccountSearch}
                  onChange={(e) => handleExpenseAccountSearchChange(e.target.value)}
                  required
                />
                <datalist id="voucher-expense-account-options">
                  {filteredExpenseAccounts.map((account) => (
                    <option key={account.id} value={account.name} />
                  ))}
                </datalist>
              </div>
              {selectedExpenseAccount && (
                <span className={styles.helperText}>
                  {selectedExpenseAccount.allow_manual_posting ? 'Manual expense account.' : 'Auto-post only account selected; backend may block direct use if policy changes.'}
                </span>
              )}
              {renderAccountGuide(selectedExpenseAccount)}
            </div>
            <div className={styles.field}>
              {renderHelpTooltip('Treasury Account (Cash/Bank COA)', {
                purpose: 'This field identifies the actual cash, petty cash, bank, or treasury ledger from which the voucher is settled.',
                use: 'Choose the real source that paid the voucher so treasury and reconciliation stay correct.',
                example: 'Use Bank Current Account for EFT payment, or Petty Cash for urgent branch cash spend.',
                watchOut: 'Do not use a bank account when the spend was paid from petty cash or counter cash.',
              })}
              <span className={styles.helperText}>
                {isCreditPurchase
                  ? 'This voucher will stay unpaid in accounts payable until a later settlement voucher clears it.'
                  : 'Select the actual treasury COA used for the payment source.'}
              </span>
              {isCreditPurchase ? (
                <input className={styles.input} value="Accounts Payable" disabled />
              ) : (
                <div className={styles.inputWrapper}>
                  <Search size={14} className={styles.selectChevron} />
                  <input
                    className={styles.input}
                    list="voucher-treasury-account-options"
                    placeholder="Search and select treasury account"
                    value={treasuryAccountSearch}
                    onChange={(e) => handleTreasuryAccountSearchChange(e.target.value)}
                    required
                  />
                  <datalist id="voucher-treasury-account-options">
                    {filteredTreasuryAccounts.map((account) => (
                      <option key={account.id} value={account.name} />
                    ))}
                  </datalist>
                </div>
              )}
              {isCreditPurchase ? (
                <span className={styles.helperText}>Approval will create a payable instead of reducing cash or bank.</span>
              ) : selectedTreasuryAccount ? (
                <span className={styles.helperText}>
                  {selectedTreasuryAccount.is_cash_account ? 'Cash drawer / on-hand source.' : 'Bank-linked treasury source.'}
                </span>
              ) : null}
              {renderAccountGuide(selectedTreasuryAccount)}
            </div>
            </>
          ) : (
            <div className={styles.field}>
              {isPurchaseCreditNote ? (
                <label className={styles.label}>Posting Source</label>
              ) : renderHelpTooltip('Treasury Account (Cash/Bank COA)', {
                purpose: 'This field identifies the actual cash, petty cash, bank, or treasury ledger from which the voucher is settled.',
                use: 'Choose the real source that paid the voucher so treasury and reconciliation stay correct.',
                example: 'Use Bank Current Account for EFT payment, or Petty Cash for urgent branch cash spend.',
                watchOut: 'Do not use a bank account when the spend was paid from petty cash or counter cash.',
              })}
              <span className={styles.helperText}>
                {isPurchaseCreditNote
                  ? 'Approval will reduce the linked vendor liability instead of using a cash or bank source.'
                  : 'Select the actual treasury COA used for the payment source.'}
              </span>
              {isPurchaseCreditNote ? (
                <input className={styles.input} value="Vendor Liability on Linked GRN" disabled />
              ) : (
                <div className={styles.inputWrapper}>
                  <Search size={14} className={styles.selectChevron} />
                  <input
                    className={styles.input}
                    list="voucher-treasury-account-options"
                    placeholder="Search and select treasury account"
                    value={treasuryAccountSearch}
                    onChange={(e) => handleTreasuryAccountSearchChange(e.target.value)}
                    required
                  />
                </div>
              )}
              {isPurchaseCreditNote ? (
                <span className={styles.helperText}>Approval reduces the linked vendor liability and credits Purchase Credits & Rebates.</span>
              ) : selectedTreasuryAccount ? (
                <span className={styles.helperText}>
                  {selectedTreasuryAccount.is_cash_account ? 'Cash drawer / on-hand source.' : 'Bank-linked treasury source.'}
                </span>
              ) : null}
              {renderAccountGuide(selectedTreasuryAccount)}
            </div>
          )}

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              placeholder="Internal notes..."
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
            </div>

            <div className={styles.formFooter}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnSubmit}
                disabled={loading || booting || !!validationMessage}
              >
                <Save size={16} />
                {loading ? 'Saving...' : (isEdit ? 'Update Voucher' : 'Record Voucher')}
              </button>
            </div>
          </div>

          <aside className={styles.reviewRail}>
            <div className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewEyebrow}>Voucher Preview</span>
                <strong>{formData.type.replaceAll('_', ' ')}</strong>
              </div>
              <div className={styles.reviewGrid}>
                <div className={styles.reviewRow}><span>Branch</span><strong>{branchOptions.find((branch) => branch.id === formData.branch_id)?.name || '-'}</strong></div>
                <div className={styles.reviewRow}><span>Party</span><strong>{formData.party_name || '-'}</strong></div>
                <div className={styles.reviewRow}><span>Amount</span><strong>{formData.amount ? `PKR ${Number(formData.amount).toLocaleString()}` : '-'}</strong></div>
                <div className={styles.reviewRow}><span>Payment Method</span><strong>{isPurchaseCreditNote ? 'Linked Liability' : (formData.payment_method || '-')}</strong></div>
                <div className={styles.reviewRow}><span>Treasury</span><strong>{isPurchaseCreditNote ? 'Linked Vendor Liability' : isCreditPurchase ? 'Accounts Payable' : (selectedTreasuryAccount?.name || '-')}</strong></div>
                {isPurchaseCreditNote && <div className={styles.reviewRow}><span>Linked GRN</span><strong>{selectedGrn?.label || '-'}</strong></div>}
                {formData.type === 'EXPENSE' && <div className={styles.reviewRow}><span>Expense Account</span><strong>{selectedExpenseAccount?.name || '-'}</strong></div>}
              </div>
              {validationMessage ? (
                <div className={styles.reviewNote}>
                  <strong>Before Submit</strong>
                  <span>{validationMessage}</span>
                </div>
              ) : (
                <div className={styles.reviewNote}>
                  <strong>Ready For Review</strong>
                  <span>
                    The voucher has the minimum finance fields needed for posting and approval.
                    {!isPurchaseCreditNote && !isCreditPurchase ? ' Treasury Account is the payment-source COA.' : ''}
                    {formData.type === 'EXPENSE' ? ' Expense Account is the spend-type COA.' : ''}
                  </span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
