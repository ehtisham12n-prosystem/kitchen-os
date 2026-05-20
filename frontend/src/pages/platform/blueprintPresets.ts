import { emptyPayload } from './blueprintPayload';
import type { BlueprintPayloadDraft } from './blueprintPayload';

export interface BlueprintPreset {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  bestFor: string;
  blueprint_code: string;
  blueprint_name: string;
  description: string;
  release_notes: string;
  payload: BlueprintPayloadDraft;
}

const buildCoreUoms = () => ([
  { template_key: 'uom-each', name: 'Each', abbreviation: 'EA', description: 'Base each unit for discrete stock items.', is_base_unit: true, is_active: true, base_template_key: '', conversion_factor: '1' },
  { template_key: 'uom-kilogram', name: 'Kilogram', abbreviation: 'KG', description: 'Base weight unit for bulk food ingredients.', is_base_unit: true, is_active: true, base_template_key: '', conversion_factor: '1' },
  { template_key: 'uom-gram', name: 'Gram', abbreviation: 'G', description: 'Small weight conversion linked to kilogram.', is_base_unit: false, is_active: true, base_template_key: 'uom-kilogram', conversion_factor: '0.001' },
  { template_key: 'uom-liter', name: 'Liter', abbreviation: 'L', description: 'Base liquid unit for beverages and syrups.', is_base_unit: true, is_active: true, base_template_key: '', conversion_factor: '1' },
  { template_key: 'uom-milliliter', name: 'Milliliter', abbreviation: 'ML', description: 'Small liquid conversion linked to liter.', is_base_unit: false, is_active: true, base_template_key: 'uom-liter', conversion_factor: '0.001' },
  { template_key: 'uom-pack', name: 'Pack', abbreviation: 'PK', description: 'Procurement pack unit for vendor purchasing.', is_base_unit: true, is_active: true, base_template_key: '', conversion_factor: '1' },
]) satisfies BlueprintPayloadDraft['uoms'];

const buildCoreAccounts = () => ([
  { account_code: '1100', account_name: 'Cash On Hand', account_type: 'asset', parent_code: '', is_active: true },
  { account_code: '1120', account_name: 'Bank Account', account_type: 'asset', parent_code: '', is_active: true },
  { account_code: '1200', account_name: 'Inventory Asset', account_type: 'asset', parent_code: '', is_active: true },
  { account_code: '2100', account_name: 'Accounts Payable', account_type: 'liability', parent_code: '', is_active: true },
  { account_code: '3100', account_name: 'Owner Equity', account_type: 'equity', parent_code: '', is_active: true },
  { account_code: '4100', account_name: 'Food Sales', account_type: 'revenue', parent_code: '', is_active: true },
  { account_code: '4200', account_name: 'Beverage Sales', account_type: 'revenue', parent_code: '', is_active: true },
  { account_code: '5100', account_name: 'Cost Of Goods Sold', account_type: 'expense', parent_code: '', is_active: true },
  { account_code: '5200', account_name: 'Payroll Expense', account_type: 'expense', parent_code: '', is_active: true },
  { account_code: '5300', account_name: 'Utilities Expense', account_type: 'expense', parent_code: '', is_active: true },
]) satisfies BlueprintPayloadDraft['chart_of_accounts'];

const buildCoreRoles = () => ([
  { role_name: 'Operations Manager', permissions: 'ops.dashboard, inventory.read, inventory.write, menu.read, menu.write, hr.read, reports.read', is_system_role: false, is_active: true, description: 'Runs store-level operations, people, and service quality.', context_scope: 'hybrid', approval_authority: 'branch' },
  { role_name: 'Shift Supervisor', permissions: 'pos.open, pos.close, inventory.read, inventory.adjust, floor.read, floor.write', is_system_role: false, is_active: true, description: 'Leads the shift and controls opening and closing routines.', context_scope: 'branch', approval_authority: 'branch' },
  { role_name: 'POS User', permissions: 'pos.open, pos.sale, pos.refund-limited, customer.read', is_system_role: false, is_active: true, description: 'Handles order entry, checkout, and guest billing.', context_scope: 'branch', approval_authority: 'none' },
  { role_name: 'Order Taker', permissions: 'pos.order-taker, pos.sale, customer.read', is_system_role: false, is_active: true, description: 'Captures guest orders from counter and handheld order-taking flows.', context_scope: 'branch', approval_authority: 'none' },
  { role_name: 'Kitchen Lead', permissions: 'kds.read, production.read, production.write, inventory.read', is_system_role: false, is_active: true, description: 'Owns kitchen throughput, prep, and execution standards.', context_scope: 'branch', approval_authority: 'none' },
  { role_name: 'Accountant', permissions: 'accounting.read, accounting.write, reports.read, vendor.read', is_system_role: false, is_active: true, description: 'Maintains ledgers, cost controls, and statutory reporting.', context_scope: 'central', approval_authority: 'central' },
]) satisfies BlueprintPayloadDraft['roles'];

const buildCoreDepartments = () => ([
  { code: 'OPS', name: 'Operations', description: 'Front-of-house and outlet operations.', head_name: 'Operations Manager', is_active: true },
  { code: 'KIT', name: 'Kitchen', description: 'Production, prep, and food quality control.', head_name: 'Kitchen Lead', is_active: true },
  { code: 'ACC', name: 'Accounts', description: 'Finance, reconciliations, and reporting.', head_name: 'Accountant', is_active: true },
  { code: 'HR', name: 'Human Resources', description: 'Hiring, scheduling, and policy administration.', head_name: 'HR Executive', is_active: true },
]) satisfies BlueprintPayloadDraft['departments'];

const buildCoreDesignations = () => ([
  { code: 'MGR', name: 'Outlet Manager', level: 'L3', department_name: 'Operations', description: 'Accountable for outlet performance and compliance.', is_active: true },
  { code: 'SUP', name: 'Shift Supervisor', level: 'L2', department_name: 'Operations', description: 'Runs shifts and supports service recovery.', is_active: true },
  { code: 'CSR', name: 'Cashier', level: 'L1', department_name: 'Operations', description: 'Handles guest orders and counter operations.', is_active: true },
  { code: 'CHEF', name: 'Kitchen Lead', level: 'L2', department_name: 'Kitchen', description: 'Leads prep, line discipline, and recipe adherence.', is_active: true },
  { code: 'ACC', name: 'Accountant', level: 'L2', department_name: 'Accounts', description: 'Maintains daily reconciliations and books.', is_active: true },
]) satisfies BlueprintPayloadDraft['designations'];

const buildPayload = (overrides: Partial<BlueprintPayloadDraft>): BlueprintPayloadDraft => ({
  ...emptyPayload(),
  settings: {
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    fiscal_year_start: '7',
    contact_email: 'ops@example.com',
    contact_phone: '+92-300-0000000',
    address: 'Head Office Address',
    ...(overrides.settings || {}),
  },
  roles: overrides.roles || buildCoreRoles(),
  departments: overrides.departments || buildCoreDepartments(),
  designations: overrides.designations || buildCoreDesignations(),
  chart_of_accounts: overrides.chart_of_accounts || buildCoreAccounts(),
  categories: overrides.categories || [],
  menu_types: overrides.menu_types || [],
  cuisine_types: overrides.cuisine_types || [],
  stations: overrides.stations || [],
  uoms: overrides.uoms || buildCoreUoms(),
});

const PRESETS: BlueprintPreset[] = [
  {
    id: 'qsr',
    title: 'Quick Service Restaurant',
    subtitle: 'High volume counter service',
    summary: 'Built for fast-moving QSR operations with strong counter, fryer, grill, and dispatch coverage.',
    bestFor: 'Burgers, fried chicken, shawarma, pizza slices, and mall outlets.',
    blueprint_code: 'BP-QSR-STD',
    blueprint_name: 'QSR Standard Blueprint',
    description: 'Industry-standard starting point for quick service restaurants with counter sales, fast kitchen handoff, and delivery dispatch.',
    release_notes: 'Seeded with standard QSR roles, departments, menu taxonomy, stations, and inventory UOMs.',
    payload: buildPayload({
      categories: [
        { template_key: 'cat-burgers', category_name: 'Burgers', category_description: 'Core burger menu family.', category_sort_order: '10', parent_template_key: '', is_active: true },
        { template_key: 'cat-wraps', category_name: 'Wraps & Sandwiches', category_description: 'Fast handheld meal options.', category_sort_order: '20', parent_template_key: '', is_active: true },
        { template_key: 'cat-fried', category_name: 'Fried Items', category_description: 'Chicken, fries, and sides from fryer station.', category_sort_order: '30', parent_template_key: '', is_active: true },
        { template_key: 'cat-combos', category_name: 'Combo Meals', category_description: 'Bundled meal deals with drink and side.', category_sort_order: '40', parent_template_key: '', is_active: true },
        { template_key: 'cat-bev', category_name: 'Beverages', category_description: 'Soft drinks and quick-serve beverages.', category_sort_order: '50', parent_template_key: '', is_active: true },
      ],
      menu_types: [
        { name: 'Dine In', code: 'DINEIN', description: 'In-store guest dining orders.', sort_order: '10', is_active: true },
        { name: 'Takeaway', code: 'TAKEAWAY', description: 'Counter pickup takeout orders.', sort_order: '20', is_active: true },
        { name: 'Delivery', code: 'DELIVERY', description: 'Third-party and direct delivery orders.', sort_order: '30', is_active: true },
      ],
      cuisine_types: [
        { name: 'American Fast Food', code: 'AFF', description: 'Core QSR American menu profile.', sort_order: '10', is_active: true },
        { name: 'Street Fusion', code: 'SFN', description: 'Localized fast-food flavor extensions.', sort_order: '20', is_active: true },
      ],
      stations: [
        { name: 'Order Counter', code: 'COUNTER', description: 'Front counter order taking and cash handling.', kitchen_display_order: '10', supports_hot_food: false, supports_cold_food: false, is_active: true },
        { name: 'Grill', code: 'GRILL', description: 'Burger patties and hot sandwiches.', kitchen_display_order: '20', supports_hot_food: true, supports_cold_food: false, is_active: true },
        { name: 'Fryer', code: 'FRYER', description: 'Fries, fried chicken, and crispy sides.', kitchen_display_order: '30', supports_hot_food: true, supports_cold_food: false, is_active: true },
        { name: 'Assembly', code: 'ASM', description: 'Final sandwich assembly and packaging.', kitchen_display_order: '40', supports_hot_food: true, supports_cold_food: true, is_active: true },
        { name: 'Dispatch', code: 'DSP', description: 'Order handoff for takeaway and delivery riders.', kitchen_display_order: '50', supports_hot_food: true, supports_cold_food: true, is_active: true },
      ],
    }),
  },
  {
    id: 'casual-dining',
    title: 'Casual Dining',
    subtitle: 'Balanced dine-in service',
    summary: 'Covers table service, mixed kitchen production, and a broader menu structure for family restaurants.',
    bestFor: 'Family restaurants, neighborhood grills, and all-day dining concepts.',
    blueprint_code: 'BP-CDR-STD',
    blueprint_name: 'Casual Dining Blueprint',
    description: 'Industry-standard setup for casual dining operations with table service, balanced production flow, and a wider menu mix.',
    release_notes: 'Includes table-service roles, dining-room friendly categories, and stations for hot line, pantry, and beverage.',
    payload: buildPayload({
      categories: [
        { template_key: 'cat-apps', category_name: 'Appetizers', category_description: 'Starter items for dine-in guests.', category_sort_order: '10', parent_template_key: '', is_active: true },
        { template_key: 'cat-mains', category_name: 'Main Course', category_description: 'Core entrees and signature plates.', category_sort_order: '20', parent_template_key: '', is_active: true },
        { template_key: 'cat-grill', category_name: 'Grill Specials', category_description: 'Steaks, kebabs, and grilled proteins.', category_sort_order: '30', parent_template_key: '', is_active: true },
        { template_key: 'cat-dessert', category_name: 'Desserts', category_description: 'Post-meal sweet options.', category_sort_order: '40', parent_template_key: '', is_active: true },
        { template_key: 'cat-drinks', category_name: 'Mocktails & Beverages', category_description: 'Non-alcoholic beverage program.', category_sort_order: '50', parent_template_key: '', is_active: true },
      ],
      menu_types: [
        { name: 'Lunch', code: 'LUNCH', description: 'Midday service menu.', sort_order: '10', is_active: true },
        { name: 'Dinner', code: 'DINNER', description: 'Evening prime service menu.', sort_order: '20', is_active: true },
        { name: 'Weekend Specials', code: 'WKND', description: 'Special menu used on peak days.', sort_order: '30', is_active: true },
      ],
      cuisine_types: [
        { name: 'Continental', code: 'CONT', description: 'Broad international casual dining profile.', sort_order: '10', is_active: true },
        { name: 'BBQ & Grill', code: 'BBQ', description: 'Flame-grilled and barbecue offerings.', sort_order: '20', is_active: true },
      ],
      stations: [
        { name: 'Hot Line', code: 'HOT', description: 'Main hot production line for entrees.', kitchen_display_order: '10', supports_hot_food: true, supports_cold_food: false, is_active: true },
        { name: 'Pantry', code: 'PANTRY', description: 'Salads, desserts, and cold plate prep.', kitchen_display_order: '20', supports_hot_food: false, supports_cold_food: true, is_active: true },
        { name: 'Beverage Bar', code: 'BAR', description: 'Drinks, mocktails, and service beverages.', kitchen_display_order: '30', supports_hot_food: false, supports_cold_food: true, is_active: true },
        { name: 'Expo', code: 'EXPO', description: 'Final quality check and table dispatch.', kitchen_display_order: '40', supports_hot_food: true, supports_cold_food: true, is_active: true },
      ],
    }),
  },
  {
    id: 'fine-dining',
    title: 'Fine Dining',
    subtitle: 'Course-led premium service',
    summary: 'Adds stronger role clarity, pantry/expo discipline, and menu taxonomy suited to premium service execution.',
    bestFor: 'Chef-led venues, premium grills, and occasion dining concepts.',
    blueprint_code: 'BP-FDN-STD',
    blueprint_name: 'Fine Dining Blueprint',
    description: 'Premium-service blueprint for formal dining rooms with paced service, kitchen brigade structure, and curated menu design.',
    release_notes: 'Prepared with course-based categories, expo discipline, and premium guest-service role alignment.',
    payload: buildPayload({
      roles: [
        ...buildCoreRoles(),
        { role_name: 'Restaurant Manager', permissions: 'ops.dashboard, floor.read, floor.write, reports.read, customer.read', is_system_role: false, is_active: true, description: 'Owns guest experience, reservations, and service standards.', context_scope: 'branch', approval_authority: 'branch' },
      ],
      categories: [
        { template_key: 'cat-course1', category_name: 'Amuse Bouche & Starters', category_description: 'Opening and tasting items.', category_sort_order: '10', parent_template_key: '', is_active: true },
        { template_key: 'cat-course2', category_name: 'Soups & Salads', category_description: 'Refined light courses.', category_sort_order: '20', parent_template_key: '', is_active: true },
        { template_key: 'cat-course3', category_name: 'Signature Mains', category_description: 'Premium core entrees.', category_sort_order: '30', parent_template_key: '', is_active: true },
        { template_key: 'cat-course4', category_name: 'Chef Specials', category_description: 'Rotating limited-availability dishes.', category_sort_order: '40', parent_template_key: '', is_active: true },
        { template_key: 'cat-course5', category_name: 'Dessert & Coffee', category_description: 'Final course and after-dinner offerings.', category_sort_order: '50', parent_template_key: '', is_active: true },
      ],
      menu_types: [
        { name: 'A La Carte', code: 'ALC', description: 'Standard individual course menu.', sort_order: '10', is_active: true },
        { name: 'Tasting Menu', code: 'TASTING', description: 'Multi-course chef tasting program.', sort_order: '20', is_active: true },
        { name: 'Seasonal Menu', code: 'SEASONAL', description: 'Limited seasonal menu rotation.', sort_order: '30', is_active: true },
      ],
      cuisine_types: [
        { name: 'Modern European', code: 'MEU', description: 'Refined plated cuisine profile.', sort_order: '10', is_active: true },
        { name: 'Steakhouse', code: 'STK', description: 'Premium grill and steak-forward profile.', sort_order: '20', is_active: true },
      ],
      stations: [
        { name: 'Garde Manger', code: 'GM', description: 'Cold appetizers, salads, and garnish prep.', kitchen_display_order: '10', supports_hot_food: false, supports_cold_food: true, is_active: true },
        { name: 'Saute', code: 'SAUTE', description: 'Pan-finished entrees and sauces.', kitchen_display_order: '20', supports_hot_food: true, supports_cold_food: false, is_active: true },
        { name: 'Grill', code: 'GRILL', description: 'Premium grill and charbroil production.', kitchen_display_order: '30', supports_hot_food: true, supports_cold_food: false, is_active: true },
        { name: 'Pastry', code: 'PSTRY', description: 'Dessert plating and baked items.', kitchen_display_order: '40', supports_hot_food: false, supports_cold_food: true, is_active: true },
        { name: 'Expo', code: 'EXPO', description: 'Final pass, plating standards, and synchronized dispatch.', kitchen_display_order: '50', supports_hot_food: true, supports_cold_food: true, is_active: true },
      ],
    }),
  },
  {
    id: 'cafe-bakery',
    title: 'Cafe & Bakery',
    subtitle: 'Coffee, pastries, and light meals',
    summary: 'Optimized for beverage-led counters, bakery prep, and compact menus with strong takeaway velocity.',
    bestFor: 'Coffee chains, dessert bars, bakeries, and grab-and-go formats.',
    blueprint_code: 'BP-CAF-STD',
    blueprint_name: 'Cafe Bakery Blueprint',
    description: 'Cafe-first operating model with beverage prep, pastry display, quick service, and light kitchen support.',
    release_notes: 'Seeded with beverage and bakery categories, barista-ready stations, and takeaway menu types.',
    payload: buildPayload({
      categories: [
        { template_key: 'cat-coffee', category_name: 'Coffee', category_description: 'Espresso and brewed coffee menu.', category_sort_order: '10', parent_template_key: '', is_active: true },
        { template_key: 'cat-tea', category_name: 'Tea & Refreshers', category_description: 'Tea-based drinks and cold refreshers.', category_sort_order: '20', parent_template_key: '', is_active: true },
        { template_key: 'cat-pastry', category_name: 'Pastries', category_description: 'Displayed baked goods and quick desserts.', category_sort_order: '30', parent_template_key: '', is_active: true },
        { template_key: 'cat-bread', category_name: 'Breads & Cakes', category_description: 'Whole cakes and bakery retail items.', category_sort_order: '40', parent_template_key: '', is_active: true },
        { template_key: 'cat-light', category_name: 'Sandwiches & Light Bites', category_description: 'Light savory menu for all-day trade.', category_sort_order: '50', parent_template_key: '', is_active: true },
      ],
      menu_types: [
        { name: 'Counter Menu', code: 'COUNTER', description: 'Standard in-cafe order menu.', sort_order: '10', is_active: true },
        { name: 'Takeaway Menu', code: 'TKAWY', description: 'Fast pickup and grab-and-go menu.', sort_order: '20', is_active: true },
        { name: 'Breakfast Menu', code: 'BRKFST', description: 'Morning-focused light meal set.', sort_order: '30', is_active: true },
      ],
      cuisine_types: [
        { name: 'Cafe', code: 'CAFE', description: 'Cafe beverage and pastry-oriented assortment.', sort_order: '10', is_active: true },
        { name: 'Bakery', code: 'BAKE', description: 'Baked goods and dessert retail profile.', sort_order: '20', is_active: true },
      ],
      stations: [
        { name: 'Espresso Bar', code: 'ESP', description: 'Coffee extraction and hot beverage prep.', kitchen_display_order: '10', supports_hot_food: false, supports_cold_food: true, is_active: true },
        { name: 'Bakery Counter', code: 'BAKERY', description: 'Pastry display, slicing, and packaging.', kitchen_display_order: '20', supports_hot_food: false, supports_cold_food: true, is_active: true },
        { name: 'Sandwich Prep', code: 'PREP', description: 'Cold and light savory assembly.', kitchen_display_order: '30', supports_hot_food: false, supports_cold_food: true, is_active: true },
      ],
    }),
  },
  {
    id: 'cloud-kitchen',
    title: 'Cloud Kitchen',
    subtitle: 'Delivery-first production',
    summary: 'Designed for digital orders, fast packaging, and multi-channel dispatch with minimal dine-in assumptions.',
    bestFor: 'Delivery-only brands, virtual restaurants, and shared kitchens.',
    blueprint_code: 'BP-CLK-STD',
    blueprint_name: 'Cloud Kitchen Blueprint',
    description: 'Delivery-centric blueprint with optimized kitchen workflow, dispatch control, and compact front-of-house requirements.',
    release_notes: 'Includes delivery menu structure, packaging-aware stations, and dispatch-friendly role design.',
    payload: buildPayload({
      categories: [
        { template_key: 'cat-signature', category_name: 'Signature Boxes', category_description: 'Core delivery hero products.', category_sort_order: '10', parent_template_key: '', is_active: true },
        { template_key: 'cat-bowls', category_name: 'Rice & Bowl Meals', category_description: 'Delivery-stable bowl and meal formats.', category_sort_order: '20', parent_template_key: '', is_active: true },
        { template_key: 'cat-sides', category_name: 'Sides', category_description: 'Add-on snacks and quick extras.', category_sort_order: '30', parent_template_key: '', is_active: true },
        { template_key: 'cat-sauces', category_name: 'Dips & Sauces', category_description: 'Incremental attach-rate items.', category_sort_order: '40', parent_template_key: '', is_active: true },
        { template_key: 'cat-beverages', category_name: 'Beverages', category_description: 'Bottled and canned drinks.', category_sort_order: '50', parent_template_key: '', is_active: true },
      ],
      menu_types: [
        { name: 'Aggregator Delivery', code: 'AGG', description: 'Marketplace delivery channels.', sort_order: '10', is_active: true },
        { name: 'Direct Delivery', code: 'DIRECT', description: 'Brand-owned ordering channels.', sort_order: '20', is_active: true },
        { name: 'Pickup', code: 'PICKUP', description: 'Customer self-pickup orders.', sort_order: '30', is_active: true },
      ],
      cuisine_types: [
        { name: 'Delivery Comfort Food', code: 'DCF', description: 'Food styles that travel well.', sort_order: '10', is_active: true },
        { name: 'Asian Fusion', code: 'ASF', description: 'Wok, rice bowl, and sauce-led digital menu.', sort_order: '20', is_active: true },
      ],
      stations: [
        { name: 'Hot Production', code: 'HPROD', description: 'Primary line for cooked mains.', kitchen_display_order: '10', supports_hot_food: true, supports_cold_food: false, is_active: true },
        { name: 'Assembly & Packing', code: 'PACK', description: 'Portioning, boxing, and seal checks.', kitchen_display_order: '20', supports_hot_food: true, supports_cold_food: true, is_active: true },
        { name: 'Dispatch Shelf', code: 'DISP', description: 'Rider pickup staging and order verification.', kitchen_display_order: '30', supports_hot_food: true, supports_cold_food: true, is_active: true },
      ],
    }),
  },
];

export const blueprintPresets = PRESETS;

export const clonePreset = (preset: BlueprintPreset): BlueprintPreset => JSON.parse(JSON.stringify(preset)) as BlueprintPreset;
