import type { Theme, ThemeTokens } from './ThemeProvider';

type TokenSeed = Partial<ThemeTokens>;

const LIGHT_BASE: TokenSeed = {
    bg_app: '#f4f7fb', bg_page: '#fbfdff', bg_section: '#ffffff', divider_color: '#dbe3ee',
    text_primary: '#172033', text_secondary: '#526176', text_muted: '#8794a8', text_inverse: '#ffffff', text_heading: '#111827',
    nav_bg: '#eaf1fb', nav_item_active: 'rgba(37, 99, 235, 0.14)', nav_item_inactive: 'transparent', nav_item_hover: '#dfeafb',
    header_bg: '#ffffff', header_text: '#172033', header_icons: '#526176',
    card_bg: '#ffffff', card_header_bg: '#f7f9fc', card_border: '#dbe3ee', card_shadow: '0 8px 24px rgba(15, 23, 42, 0.08)', card_hover: '#f8fafc',
    input_bg: '#ffffff', input_text: '#172033', input_placeholder: '#8794a8', input_border_default: '#cfd8e6', input_disabled_bg: '#edf2f7',
    switch_off_bg: '#cfd8e6', switch_knob: '#ffffff', switch_disabled: '#edf2f7',
    table_bg: '#ffffff', table_header_bg: '#f1f5f9', table_header_text: '#526176', table_row_bg: '#ffffff', table_row_hover: '#f6f9fd', table_border: '#dbe3ee',
    state_inactive: '#8794a8', state_disabled: '#cfd8e6', state_skeleton: '#edf2f7', state_overlay: 'rgba(15,23,42,0.55)',
    radius_sm: '6px', radius_md: '8px', radius_lg: '8px', radius_xl: '8px',
};

const DARK_BASE: TokenSeed = {
    bg_app: '#0b0f17', bg_page: '#111827', bg_section: '#151d2b', divider_color: 'rgba(226,232,240,0.12)',
    text_primary: '#edf2f7', text_secondary: '#a6b1c2', text_muted: '#748196', text_inverse: '#0b0f17', text_heading: '#ffffff',
    nav_bg: '#0f1623', nav_item_active: 'rgba(45, 212, 191, 0.14)', nav_item_inactive: 'transparent', nav_item_hover: 'rgba(226,232,240,0.08)',
    header_bg: '#111827', header_text: '#edf2f7', header_icons: '#a6b1c2',
    card_bg: '#151d2b', card_header_bg: '#111827', card_border: 'rgba(226,232,240,0.12)', card_shadow: '0 12px 30px rgba(0,0,0,0.32)', card_hover: '#1b2535',
    input_bg: '#0f1623', input_text: '#edf2f7', input_placeholder: '#748196', input_border_default: 'rgba(226,232,240,0.16)', input_disabled_bg: '#111827',
    switch_off_bg: '#2a3445', switch_knob: '#ffffff', switch_disabled: '#1b2535',
    table_bg: '#151d2b', table_header_bg: '#101722', table_header_text: '#a6b1c2', table_row_bg: '#151d2b', table_row_hover: '#1b2535', table_border: 'rgba(226,232,240,0.10)',
    state_inactive: '#748196', state_disabled: '#3d4858', state_skeleton: 'rgba(226,232,240,0.08)', state_overlay: 'rgba(0,0,0,0.72)',
    radius_sm: '6px', radius_md: '8px', radius_lg: '8px', radius_xl: '8px',
};

function withStates(base: TokenSeed, colors: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    secondary: string;
    success: string;
    danger: string;
    warning: string;
    info: string;
    chart: string[];
    ambient: string[];
    selectedText?: string;
}): ThemeTokens {
    const warningText = base.bg_app?.startsWith('#0') || base.bg_app?.startsWith('#1') ? '#111827' : '#ffffff';
    return {
        ...base,
        input_border_focus: colors.primary, input_border_error: colors.danger, input_border_success: colors.success,
        btn_primary_bg: colors.primary, btn_primary_hover: colors.primaryHover, btn_primary_active: colors.primaryActive, btn_primary_text: '#ffffff', btn_primary_border: 'transparent', btn_primary_disabled: base.input_disabled_bg ?? '#e2e8f0',
        btn_secondary_bg: colors.secondary, btn_secondary_hover: colors.secondary, btn_secondary_active: colors.secondary, btn_secondary_text: '#ffffff', btn_secondary_border: 'transparent', btn_secondary_disabled: base.input_disabled_bg ?? '#e2e8f0',
        btn_success_bg: colors.success, btn_success_hover: colors.success, btn_success_active: colors.success, btn_success_text: '#ffffff', btn_success_border: 'transparent', btn_success_disabled: base.input_disabled_bg ?? '#e2e8f0',
        btn_danger_bg: colors.danger, btn_danger_hover: colors.danger, btn_danger_active: colors.danger, btn_danger_text: '#ffffff', btn_danger_border: 'transparent', btn_danger_disabled: base.input_disabled_bg ?? '#e2e8f0',
        btn_warning_bg: colors.warning, btn_warning_hover: colors.warning, btn_warning_active: colors.warning, btn_warning_text: warningText, btn_warning_border: 'transparent', btn_warning_disabled: base.input_disabled_bg ?? '#e2e8f0',
        btn_info_bg: colors.info, btn_info_hover: colors.info, btn_info_active: colors.info, btn_info_text: '#ffffff', btn_info_border: 'transparent', btn_info_disabled: base.input_disabled_bg ?? '#e2e8f0',
        switch_on_bg: colors.primary, focus_ring: `${colors.primary}40`,
        table_selected_row: `${colors.primary}14`,
        alert_success_bg: `${colors.success}18`, alert_success_text: colors.success, alert_success_icon: colors.success, alert_success_border: `${colors.success}36`,
        alert_error_bg: `${colors.danger}18`, alert_error_text: colors.danger, alert_error_icon: colors.danger, alert_error_border: `${colors.danger}36`,
        alert_warning_bg: `${colors.warning}20`, alert_warning_text: colors.warning, alert_warning_icon: colors.warning, alert_warning_border: `${colors.warning}40`,
        alert_info_bg: `${colors.info}18`, alert_info_text: colors.info, alert_info_icon: colors.info, alert_info_border: `${colors.info}36`,
        chart_bg: 'transparent', chart_grid: base.divider_color ?? '#dbe3ee', chart_axis: base.text_muted ?? '#8794a8',
        chart_series_1: colors.chart[0], chart_series_2: colors.chart[1], chart_series_3: colors.chart[2], chart_series_4: colors.chart[3], chart_series_5: colors.chart[4], chart_series_6: colors.chart[5],
        chart_tooltip_bg: base.card_bg ?? '#ffffff', chart_tooltip_text: base.text_primary ?? '#172033',
        selected_bg: `${colors.primary}24`, selected_text: colors.selectedText ?? colors.primary, highlight_color: colors.primary, focus_outline: colors.primary,
        state_active: colors.success,
        scrollbar_track: base.bg_app ?? '#f4f7fb', scrollbar_thumb: base.bg_section ?? '#ffffff', scrollbar_thumb_hover: base.text_muted ?? '#8794a8',
        ambient_1: colors.ambient[0], ambient_2: colors.ambient[1], ambient_3: colors.ambient[2],
    } as ThemeTokens;
}

export const FALLBACK_THEMES: Theme[] = [
    {
        id: 'fallback-light',
        theme_name: 'Executive Light',
        slug: 'light',
        description: 'Neutral light workspace with cobalt action accents.',
        tokens: withStates(LIGHT_BASE, {
            primary: '#2563eb', primaryHover: '#1d4ed8', primaryActive: '#1e40af', secondary: '#475569',
            success: '#0f8f6f', danger: '#dc2626', warning: '#b7791f', info: '#0284c7',
            chart: ['#2563eb', '#0f766e', '#7c3aed', '#d97706', '#0891b2', '#dc2626'],
            ambient: ['rgba(37,99,235,0.06)', 'rgba(15,118,110,0.05)', 'rgba(217,119,6,0.04)'],
        }),
        is_active: true, is_system_default: true, client_id: null, created_at: '', updated_at: '',
    },
    {
        id: 'fallback-dark',
        theme_name: 'Operations Dark',
        slug: 'dark',
        description: 'Low-glare dark theme with teal and blue accents.',
        tokens: withStates(DARK_BASE, {
            primary: '#2dd4bf', primaryHover: '#14b8a6', primaryActive: '#0f766e', secondary: '#64748b',
            success: '#22c55e', danger: '#f87171', warning: '#fbbf24', info: '#38bdf8',
            chart: ['#2dd4bf', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171'],
            ambient: ['rgba(45,212,191,0.12)', 'rgba(96,165,250,0.10)', 'rgba(251,191,36,0.06)'],
            selectedText: '#ffffff',
        }),
        is_active: false, is_system_default: true, client_id: null, created_at: '', updated_at: '',
    },
    {
        id: 'fallback-sage',
        theme_name: 'Sage Ledger',
        slug: 'sage-ledger',
        description: 'Calm green-gray palette for finance and back office screens.',
        tokens: withStates({ ...LIGHT_BASE, bg_app: '#f3f7f4', bg_page: '#fbfdfb', divider_color: '#d7e3da', nav_bg: '#e5efe9', nav_item_hover: '#d9e8df' }, {
            primary: '#2f6f5e', primaryHover: '#285f51', primaryActive: '#214f44', secondary: '#596b63',
            success: '#138a63', danger: '#c2413b', warning: '#a16207', info: '#287c96',
            chart: ['#2f6f5e', '#287c96', '#8a6f36', '#138a63', '#a16207', '#c2413b'],
            ambient: ['rgba(47,111,94,0.06)', 'rgba(40,124,150,0.05)', 'rgba(161,98,7,0.04)'],
        }),
        is_active: false, is_system_default: true, client_id: null, created_at: '', updated_at: '',
    },
    {
        id: 'fallback-cobalt',
        theme_name: 'Cobalt Copper',
        slug: 'cobalt-copper',
        description: 'Crisp cobalt base with restrained warm operational highlights.',
        tokens: withStates({ ...LIGHT_BASE, bg_app: '#f3f6fb', bg_page: '#f9fbff', nav_bg: '#e6eefc', nav_item_hover: '#dbe6fb' }, {
            primary: '#1d4ed8', primaryHover: '#1e40af', primaryActive: '#1e3a8a', secondary: '#475569',
            success: '#0f766e', danger: '#be123c', warning: '#b45309', info: '#0369a1',
            chart: ['#1d4ed8', '#0f766e', '#b45309', '#64748b', '#0369a1', '#be123c'],
            ambient: ['rgba(29,78,216,0.06)', 'rgba(180,83,9,0.05)', 'rgba(15,118,110,0.04)'],
        }),
        is_active: false, is_system_default: true, client_id: null, created_at: '', updated_at: '',
    },
    {
        id: 'fallback-graphite',
        theme_name: 'Graphite Mint',
        slug: 'graphite-mint',
        description: 'Graphite dark mode with fresh mint signals.',
        tokens: withStates({ ...DARK_BASE, bg_app: '#111315', bg_page: '#171a1d', bg_section: '#1d2227', nav_bg: '#15181b' }, {
            primary: '#34d399', primaryHover: '#10b981', primaryActive: '#059669', secondary: '#6b7280',
            success: '#22c55e', danger: '#fb7185', warning: '#fbbf24', info: '#67e8f9',
            chart: ['#34d399', '#67e8f9', '#93c5fd', '#a3e635', '#fbbf24', '#fb7185'],
            ambient: ['rgba(52,211,153,0.10)', 'rgba(103,232,249,0.08)', 'rgba(251,191,36,0.05)'],
            selectedText: '#ffffff',
        }),
        is_active: false, is_system_default: true, client_id: null, created_at: '', updated_at: '',
    },
];
