export type BlueprintStatus = 'draft' | 'active' | 'retired';

export interface RoleDraft {
  role_name: string;
  permissions: string;
  is_system_role: boolean;
  is_active: boolean;
  description: string;
  context_scope: 'central' | 'branch' | 'hybrid';
  approval_authority: 'none' | 'branch' | 'central' | 'both';
}

export interface DepartmentDraft {
  code: string;
  name: string;
  description: string;
  head_name: string;
  is_active: boolean;
}

export interface DesignationDraft {
  code: string;
  name: string;
  level: string;
  department_name: string;
  description: string;
  is_active: boolean;
}

export interface AccountDraft {
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_code: string;
  is_active: boolean;
}

export interface CategoryDraft {
  template_key: string;
  category_name: string;
  category_description: string;
  category_sort_order: string;
  parent_template_key: string;
  is_active: boolean;
}

export interface MenuTypeDraft {
  name: string;
  code: string;
  description: string;
  sort_order: string;
  is_active: boolean;
}

export interface CuisineTypeDraft {
  name: string;
  code: string;
  description: string;
  sort_order: string;
  is_active: boolean;
}

export interface StationDraft {
  name: string;
  code: string;
  description: string;
  kitchen_display_order: string;
  supports_hot_food: boolean;
  supports_cold_food: boolean;
  is_active: boolean;
}

export interface UomDraft {
  template_key: string;
  name: string;
  abbreviation: string;
  description: string;
  is_base_unit: boolean;
  is_active: boolean;
  base_template_key: string;
  conversion_factor: string;
}

export interface BlueprintPayloadDraft {
  settings: {
    currency: string;
    timezone: string;
    fiscal_year_start: string;
    contact_email: string;
    contact_phone: string;
    address: string;
  };
  roles: RoleDraft[];
  departments: DepartmentDraft[];
  designations: DesignationDraft[];
  chart_of_accounts: AccountDraft[];
  categories: CategoryDraft[];
  menu_types: MenuTypeDraft[];
  cuisine_types: CuisineTypeDraft[];
  stations: StationDraft[];
  uoms: UomDraft[];
}

export const emptyRole = (): RoleDraft => ({
  role_name: '',
  permissions: '',
  is_system_role: false,
  is_active: true,
  description: '',
  context_scope: 'hybrid',
  approval_authority: 'none',
});

export const emptyDepartment = (): DepartmentDraft => ({
  code: '',
  name: '',
  description: '',
  head_name: '',
  is_active: true,
});

export const emptyDesignation = (): DesignationDraft => ({
  code: '',
  name: '',
  level: '',
  department_name: '',
  description: '',
  is_active: true,
});

export const emptyAccount = (): AccountDraft => ({
  account_code: '',
  account_name: '',
  account_type: 'asset',
  parent_code: '',
  is_active: true,
});

export const emptyCategory = (): CategoryDraft => ({
  template_key: '',
  category_name: '',
  category_description: '',
  category_sort_order: '',
  parent_template_key: '',
  is_active: true,
});

export const emptyMenuType = (): MenuTypeDraft => ({
  name: '',
  code: '',
  description: '',
  sort_order: '',
  is_active: true,
});

export const emptyCuisineType = (): CuisineTypeDraft => ({
  name: '',
  code: '',
  description: '',
  sort_order: '',
  is_active: true,
});

export const emptyStation = (): StationDraft => ({
  name: '',
  code: '',
  description: '',
  kitchen_display_order: '',
  supports_hot_food: false,
  supports_cold_food: false,
  is_active: true,
});

export const emptyUom = (): UomDraft => ({
  template_key: '',
  name: '',
  abbreviation: '',
  description: '',
  is_base_unit: true,
  is_active: true,
  base_template_key: '',
  conversion_factor: '',
});

export const emptyPayload = (): BlueprintPayloadDraft => ({
  settings: {
    currency: '',
    timezone: '',
    fiscal_year_start: '',
    contact_email: '',
    contact_phone: '',
    address: '',
  },
  roles: [],
  departments: [],
  designations: [],
  chart_of_accounts: [],
  categories: [],
  menu_types: [],
  cuisine_types: [],
  stations: [],
  uoms: [],
});

const toNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const payloadHasValues = (payload: BlueprintPayloadDraft) =>
  Boolean(
    payload.settings.currency ||
    payload.settings.timezone ||
    payload.settings.fiscal_year_start ||
    payload.settings.contact_email ||
    payload.settings.contact_phone ||
    payload.settings.address ||
    payload.roles.some((item) => item.role_name.trim()) ||
    payload.departments.some((item) => item.code.trim() || item.name.trim()) ||
    payload.designations.some((item) => item.code.trim() || item.name.trim()) ||
    payload.chart_of_accounts.some((item) => item.account_code.trim() || item.account_name.trim()) ||
    payload.categories.some((item) => item.category_name.trim()) ||
    payload.menu_types.some((item) => item.name.trim()) ||
    payload.cuisine_types.some((item) => item.name.trim()) ||
    payload.stations.some((item) => item.name.trim()) ||
    payload.uoms.some((item) => item.abbreviation.trim() || item.name.trim()),
  );

export function buildBlueprintPayloadRequest(payload: BlueprintPayloadDraft) {
  const nextPayload: Record<string, unknown> = {};

  if (payload.settings.currency || payload.settings.timezone || payload.settings.fiscal_year_start || payload.settings.contact_email || payload.settings.contact_phone || payload.settings.address) {
    nextPayload.settings = {
      ...(payload.settings.currency ? { currency: payload.settings.currency.trim() } : {}),
      ...(payload.settings.timezone ? { timezone: payload.settings.timezone.trim() } : {}),
      ...(payload.settings.fiscal_year_start ? { fiscal_year_start: Number(payload.settings.fiscal_year_start) } : {}),
      ...(payload.settings.contact_email ? { contact_email: payload.settings.contact_email.trim() } : {}),
      ...(payload.settings.contact_phone ? { contact_phone: payload.settings.contact_phone.trim() } : {}),
      ...(payload.settings.address ? { address: payload.settings.address.trim() } : {}),
    };
  }

  const roles = payload.roles
    .filter((role) => role.role_name.trim())
    .map((role) => ({
      role_name: role.role_name.trim(),
      permissions: role.permissions.split(',').map((entry) => entry.trim()).filter(Boolean),
      is_system_role: role.is_system_role,
      is_active: role.is_active,
      description: role.description.trim() || undefined,
      context_scope: role.context_scope,
      approval_authority: role.approval_authority,
    }));
  if (roles.length > 0) nextPayload.roles = roles;

  const departments = payload.departments
    .filter((item) => item.code.trim() && item.name.trim())
    .map((item) => ({
      code: item.code.trim(),
      name: item.name.trim(),
      description: item.description.trim() || undefined,
      head_name: item.head_name.trim() || undefined,
      is_active: item.is_active,
    }));
  if (departments.length > 0) nextPayload.departments = departments;

  const designations = payload.designations
    .filter((item) => item.code.trim() && item.name.trim())
    .map((item) => ({
      code: item.code.trim(),
      name: item.name.trim(),
      level: item.level.trim() || undefined,
      department_name: item.department_name.trim() || undefined,
      description: item.description.trim() || undefined,
      is_active: item.is_active,
    }));
  if (designations.length > 0) nextPayload.designations = designations;

  const chartOfAccounts = payload.chart_of_accounts
    .filter((item) => item.account_code.trim() && item.account_name.trim())
    .map((item) => ({
      account_code: item.account_code.trim(),
      account_name: item.account_name.trim(),
      account_type: item.account_type,
      parent_code: item.parent_code.trim() || undefined,
      is_active: item.is_active,
    }));
  if (chartOfAccounts.length > 0) nextPayload.chart_of_accounts = chartOfAccounts;

  const categories = payload.categories
    .filter((item) => item.category_name.trim())
    .map((item) => ({
      template_key: item.template_key.trim() || undefined,
      category_name: item.category_name.trim(),
      category_description: item.category_description.trim() || undefined,
      category_sort_order: toNumber(item.category_sort_order),
      parent_template_key: item.parent_template_key.trim() || undefined,
      is_active: item.is_active,
    }));
  if (categories.length > 0) nextPayload.categories = categories;

  const menuTypes = payload.menu_types
    .filter((item) => item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      code: item.code.trim() || undefined,
      description: item.description.trim() || undefined,
      sort_order: toNumber(item.sort_order),
      is_active: item.is_active,
    }));
  if (menuTypes.length > 0) nextPayload.menu_types = menuTypes;

  const cuisineTypes = payload.cuisine_types
    .filter((item) => item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      code: item.code.trim() || undefined,
      description: item.description.trim() || undefined,
      sort_order: toNumber(item.sort_order),
      is_active: item.is_active,
    }));
  if (cuisineTypes.length > 0) nextPayload.cuisine_types = cuisineTypes;

  const stations = payload.stations
    .filter((item) => item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      code: item.code.trim() || undefined,
      description: item.description.trim() || undefined,
      kitchen_display_order: toNumber(item.kitchen_display_order),
      supports_hot_food: item.supports_hot_food,
      supports_cold_food: item.supports_cold_food,
      is_active: item.is_active,
    }));
  if (stations.length > 0) nextPayload.stations = stations;

  const uoms = payload.uoms
    .filter((item) => item.name.trim() && item.abbreviation.trim())
    .map((item) => ({
      template_key: item.template_key.trim() || undefined,
      name: item.name.trim(),
      abbreviation: item.abbreviation.trim(),
      description: item.description.trim() || undefined,
      is_base_unit: item.is_base_unit,
      is_active: item.is_active,
      base_template_key: item.base_template_key.trim() || undefined,
      conversion_factor: toNumber(item.conversion_factor),
    }));
  if (uoms.length > 0) nextPayload.uoms = uoms;

  return nextPayload;
}

export function fromBlueprintPayload(payload?: any): BlueprintPayloadDraft {
  return {
    settings: {
      currency: payload?.settings?.currency || '',
      timezone: payload?.settings?.timezone || '',
      fiscal_year_start: payload?.settings?.fiscal_year_start ? String(payload.settings.fiscal_year_start) : '',
      contact_email: payload?.settings?.contact_email || '',
      contact_phone: payload?.settings?.contact_phone || '',
      address: payload?.settings?.address || '',
    },
    roles: Array.isArray(payload?.roles) ? payload.roles.map((role: any) => ({
      role_name: role.role_name || '',
      permissions: Array.isArray(role.permissions) ? role.permissions.join(', ') : '',
      is_system_role: Boolean(role.is_system_role),
      is_active: role.is_active !== false,
      description: role.description || '',
      context_scope: role.context_scope || 'hybrid',
      approval_authority: role.approval_authority || 'none',
    })) : [],
    departments: Array.isArray(payload?.departments) ? payload.departments.map((item: any) => ({
      code: item.code || '',
      name: item.name || '',
      description: item.description || '',
      head_name: item.head_name || '',
      is_active: item.is_active !== false,
    })) : [],
    designations: Array.isArray(payload?.designations) ? payload.designations.map((item: any) => ({
      code: item.code || '',
      name: item.name || '',
      level: item.level || '',
      department_name: item.department_name || '',
      description: item.description || '',
      is_active: item.is_active !== false,
    })) : [],
    chart_of_accounts: Array.isArray(payload?.chart_of_accounts) ? payload.chart_of_accounts.map((item: any) => ({
      account_code: item.account_code || '',
      account_name: item.account_name || '',
      account_type: item.account_type || 'asset',
      parent_code: item.parent_code || '',
      is_active: item.is_active !== false,
    })) : [],
    categories: Array.isArray(payload?.categories) ? payload.categories.map((item: any) => ({
      template_key: item.template_key || '',
      category_name: item.category_name || '',
      category_description: item.category_description || '',
      category_sort_order: item.category_sort_order ? String(item.category_sort_order) : '',
      parent_template_key: item.parent_template_key || '',
      is_active: item.is_active !== false,
    })) : [],
    menu_types: Array.isArray(payload?.menu_types) ? payload.menu_types.map((item: any) => ({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      sort_order: item.sort_order ? String(item.sort_order) : '',
      is_active: item.is_active !== false,
    })) : [],
    cuisine_types: Array.isArray(payload?.cuisine_types) ? payload.cuisine_types.map((item: any) => ({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      sort_order: item.sort_order ? String(item.sort_order) : '',
      is_active: item.is_active !== false,
    })) : [],
    stations: Array.isArray(payload?.stations) ? payload.stations.map((item: any) => ({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      kitchen_display_order: item.kitchen_display_order ? String(item.kitchen_display_order) : '',
      supports_hot_food: Boolean(item.supports_hot_food),
      supports_cold_food: Boolean(item.supports_cold_food),
      is_active: item.is_active !== false,
    })) : [],
    uoms: Array.isArray(payload?.uoms) ? payload.uoms.map((item: any) => ({
      template_key: item.template_key || '',
      name: item.name || '',
      abbreviation: item.abbreviation || '',
      description: item.description || '',
      is_base_unit: item.is_base_unit !== false,
      is_active: item.is_active !== false,
      base_template_key: item.base_template_key || '',
      conversion_factor: item.conversion_factor ? String(item.conversion_factor) : '',
    })) : [],
  };
}
