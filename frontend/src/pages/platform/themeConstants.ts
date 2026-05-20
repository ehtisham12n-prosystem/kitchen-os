// ─── Default tokens for new themes (matches the KitchenOS Dark preset) ─────
// Used as the base when creating a new custom theme via ThemeForm.
// Every key must mirror ThemeTokens in ThemeProvider.tsx.

export const DEFAULT_TOKENS: Record<string, string> = {
    // 1. Global Layout
    bg_app: '#020205',
    bg_page: '#08090f',
    bg_section: '#0f111a',
    divider_color: 'rgba(255,255,255,0.06)',

    // 2. Typography
    text_primary: '#ffffff',
    text_secondary: '#94a3b8',
    text_muted: '#475569',
    text_inverse: '#ffffff',
    text_heading: '#ffffff',

    // 3. Navigation
    nav_bg: '#08090f',
    nav_item_active: 'rgba(99,102,241,0.15)',
    nav_item_inactive: 'transparent',
    nav_item_hover: 'rgba(255,255,255,0.05)',
    header_bg: '#08090f',
    header_text: '#ffffff',
    header_icons: '#94a3b8',

    // 4. Cards
    card_bg: 'rgba(15,17,26,0.6)',
    card_header_bg: 'rgba(255,255,255,0.02)',
    card_border: 'rgba(255,255,255,0.06)',
    card_shadow: '0 8px 32px rgba(0,0,0,0.4)',
    card_hover: 'rgba(255,255,255,0.04)',

    // 5. Forms
    input_bg: 'rgba(255,255,255,0.04)',
    input_text: '#ffffff',
    input_placeholder: '#475569',
    input_border_default: 'rgba(255,255,255,0.1)',
    input_border_focus: '#6366f1',
    input_border_error: '#ef4444',
    input_border_success: '#10b981',
    input_disabled_bg: 'rgba(255,255,255,0.02)',

    // 6. Buttons – Primary
    btn_primary_bg: '#6366f1',
    btn_primary_hover: '#4f46e5',
    btn_primary_active: '#4338ca',
    btn_primary_text: '#ffffff',
    btn_primary_border: 'transparent',
    btn_primary_disabled: 'rgba(255,255,255,0.1)',

    // 6. Buttons – Secondary
    btn_secondary_bg: '#475569',
    btn_secondary_hover: '#334155',
    btn_secondary_active: '#1e293b',
    btn_secondary_text: '#ffffff',
    btn_secondary_border: 'transparent',
    btn_secondary_disabled: 'rgba(255,255,255,0.1)',

    // 6. Buttons – Success
    btn_success_bg: '#10b981',
    btn_success_hover: '#059669',
    btn_success_active: '#047857',
    btn_success_text: '#ffffff',
    btn_success_border: 'transparent',
    btn_success_disabled: 'rgba(255,255,255,0.1)',

    // 6. Buttons – Danger
    btn_danger_bg: '#ef4444',
    btn_danger_hover: '#dc2626',
    btn_danger_active: '#b91c1c',
    btn_danger_text: '#ffffff',
    btn_danger_border: 'transparent',
    btn_danger_disabled: 'rgba(255,255,255,0.1)',

    // 6. Buttons – Warning
    btn_warning_bg: '#f59e0b',
    btn_warning_hover: '#d97706',
    btn_warning_active: '#b45309',
    btn_warning_text: '#0a0a0a',
    btn_warning_border: 'transparent',
    btn_warning_disabled: 'rgba(255,255,255,0.1)',

    // 6. Buttons – Info
    btn_info_bg: '#0ea5e9',
    btn_info_hover: '#0284c7',
    btn_info_active: '#0369a1',
    btn_info_text: '#ffffff',
    btn_info_border: 'transparent',
    btn_info_disabled: 'rgba(255,255,255,0.1)',

    // 7. Switches / Toggles
    switch_on_bg: '#6366f1',
    switch_off_bg: 'rgba(255,255,255,0.1)',
    switch_knob: '#ffffff',
    switch_disabled: 'rgba(255,255,255,0.05)',
    focus_ring: 'rgba(99,102,241,0.4)',

    // 8. Tables
    table_bg: 'rgba(15,17,26,0.6)',
    table_header_bg: 'rgba(15,17,26,0.8)',
    table_header_text: '#94a3b8',
    table_row_bg: 'transparent',
    table_row_hover: 'rgba(255,255,255,0.02)',
    table_selected_row: 'rgba(99,102,241,0.1)',
    table_border: 'rgba(255,255,255,0.06)',

    // 9. Alerts
    alert_success_bg: 'rgba(5,150,105,0.14)',
    alert_success_text: '#047857',
    alert_success_icon: '#059669',
    alert_success_border: 'rgba(5,150,105,0.28)',

    alert_error_bg: 'rgba(220,38,38,0.14)',
    alert_error_text: '#b91c1c',
    alert_error_icon: '#dc2626',
    alert_error_border: 'rgba(220,38,38,0.28)',

    alert_warning_bg: 'rgba(217,119,6,0.14)',
    alert_warning_text: '#b45309',
    alert_warning_icon: '#d97706',
    alert_warning_border: 'rgba(217,119,6,0.3)',

    alert_info_bg: 'rgba(2,132,199,0.14)',
    alert_info_text: '#0369a1',
    alert_info_icon: '#0284c7',
    alert_info_border: 'rgba(2,132,199,0.28)',

    // 10. Charts
    chart_bg: 'transparent',
    chart_grid: 'rgba(255,255,255,0.05)',
    chart_axis: '#475569',
    chart_series_1: '#6366f1',
    chart_series_2: '#a855f7',
    chart_series_3: '#06b6d4',
    chart_series_4: '#10b981',
    chart_series_5: '#f59e0b',
    chart_series_6: '#ef4444',
    chart_tooltip_bg: '#161927',
    chart_tooltip_text: '#ffffff',

    // 11. Highlight & Selection
    selected_bg: 'rgba(99,102,241,0.2)',
    selected_text: '#ffffff',
    highlight_color: '#6366f1',
    focus_outline: '#6366f1',

    // 12. System States
    state_active: '#10b981',
    state_inactive: '#94a3b8',
    state_disabled: '#475569',
    state_skeleton: 'rgba(255,255,255,0.05)',
    state_overlay: 'rgba(0,0,0,0.85)',

    // 13. Scrollbar
    scrollbar_track: '#020205',
    scrollbar_thumb: '#0f111a',
    scrollbar_thumb_hover: '#475569',

    // 14. Decorative
    ambient_1: 'rgba(99,102,241,0.4)',
    ambient_2: 'rgba(168,85,247,0.3)',
    ambient_3: 'rgba(6,182,212,0.15)',
    radius_sm: '8px',
    radius_md: '14px',
    radius_lg: '24px',
    radius_xl: '32px',
};
