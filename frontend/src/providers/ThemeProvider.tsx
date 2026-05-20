/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../config/runtime';
import { readAuthSessionItem } from '../auth/storage';
import { FALLBACK_THEMES } from './themePresets';

// ─── Token interface (mirrors backend ThemeTokens) ───────────────────────────
export interface ThemeTokens {
    // 1. Global Layout
    bg_app: string; bg_page: string; bg_section: string; divider_color: string;
    // 2. Typography
    text_primary: string; text_secondary: string; text_muted: string; text_inverse: string; text_heading: string;
    // 3. Navigation
    nav_bg: string; nav_item_active: string; nav_item_inactive: string; nav_item_hover: string;
    header_bg: string; header_text: string; header_icons: string;
    // 4. Cards & Containers
    card_bg: string; card_header_bg: string; card_border: string; card_shadow: string; card_hover: string;
    // 5. Forms & Fields
    input_bg: string; input_text: string; input_placeholder: string;
    input_border_default: string; input_border_focus: string; input_border_error: string; input_border_success: string;
    input_disabled_bg: string;
    // 6. Buttons (Primary)
    btn_primary_bg: string; btn_primary_hover: string; btn_primary_active: string; btn_primary_text: string; btn_primary_border: string; btn_primary_disabled: string;
    // 6. Buttons (Secondary)
    btn_secondary_bg: string; btn_secondary_hover: string; btn_secondary_active: string; btn_secondary_text: string; btn_secondary_border: string; btn_secondary_disabled: string;
    // 6. Buttons (Success)
    btn_success_bg: string; btn_success_hover: string; btn_success_active: string; btn_success_text: string; btn_success_border: string; btn_success_disabled: string;
    // 6. Buttons (Danger)
    btn_danger_bg: string; btn_danger_hover: string; btn_danger_active: string; btn_danger_text: string; btn_danger_border: string; btn_danger_disabled: string;
    // 6. Buttons (Warning)
    btn_warning_bg: string; btn_warning_hover: string; btn_warning_active: string; btn_warning_text: string; btn_warning_border: string; btn_warning_disabled: string;
    // 6. Buttons (Info)
    btn_info_bg: string; btn_info_hover: string; btn_info_active: string; btn_info_text: string; btn_info_border: string; btn_info_disabled: string;
    // 7. Switches
    switch_on_bg: string; switch_off_bg: string; switch_knob: string; switch_disabled: string; focus_ring: string;
    // 8. Tables
    table_bg: string; table_header_bg: string; table_header_text: string; table_row_bg: string; table_row_hover: string; table_selected_row: string; table_border: string;
    // 9. Alerts
    alert_success_bg: string; alert_success_text: string; alert_success_icon: string; alert_success_border: string;
    alert_error_bg: string; alert_error_text: string; alert_error_icon: string; alert_error_border: string;
    alert_warning_bg: string; alert_warning_text: string; alert_warning_icon: string; alert_warning_border: string;
    alert_info_bg: string; alert_info_text: string; alert_info_icon: string; alert_info_border: string;
    // 10. Charts
    chart_bg: string; chart_grid: string; chart_axis: string;
    chart_series_1: string; chart_series_2: string; chart_series_3: string; chart_series_4: string; chart_series_5: string; chart_series_6: string;
    chart_tooltip_bg: string; chart_tooltip_text: string;
    // 11. Highlight
    selected_bg: string; selected_text: string; highlight_color: string; focus_outline: string;
    // 12. System States
    state_active: string; state_inactive: string; state_disabled: string; state_skeleton: string; state_overlay: string;
    // 13. Scrollbar
    scrollbar_track: string; scrollbar_thumb: string; scrollbar_thumb_hover: string;
    // Legacy
    ambient_1: string; ambient_2: string; ambient_3: string;
    radius_sm: string; radius_md: string; radius_lg: string; radius_xl: string;
}

export interface Theme {
    id: string;
    theme_name: string;
    slug: string;
    description: string;
    tokens: ThemeTokens;
    is_active: boolean;
    is_system_default: boolean;
    client_id: number | null;
    created_at: string;
    updated_at: string;
}

interface ThemeContextType {
    theme: Theme | null;
    allThemes: Theme[];
    isLoading: boolean;
    setPreviewTokens: (tokens: Partial<ThemeTokens> | null) => void;
    activateTheme: (id: string) => Promise<void>;
    refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: null,
    allThemes: [],
    isLoading: true,
    setPreviewTokens: () => { },
    activateTheme: async () => { },
    refreshTheme: async () => { },
});

export const useThemeEngine = () => useContext(ThemeContext);

// ─── Token → CSS Variable mapping ────────────────────────────────────────────
const TOKEN_TO_CSS_VAR: Record<keyof ThemeTokens, string> = {
    bg_app: '--bg-app',
    bg_page: '--bg-page',
    bg_section: '--bg-section',
    divider_color: '--divider-color',
    text_primary: '--text-primary',
    text_secondary: '--text-secondary',
    text_muted: '--text-muted',
    text_inverse: '--text-inverse',
    text_heading: '--text-heading',
    nav_bg: '--nav-bg',
    nav_item_active: '--nav-item-active',
    nav_item_inactive: '--nav-item-inactive',
    nav_item_hover: '--nav-item-hover',
    header_bg: '--header-bg',
    header_text: '--header-text',
    header_icons: '--header-icons',
    card_bg: '--card-bg',
    card_header_bg: '--card-header-bg',
    card_border: '--card-border',
    card_shadow: '--card-shadow',
    card_hover: '--card-hover',
    input_bg: '--input-bg',
    input_text: '--input-text',
    input_placeholder: '--input-placeholder',
    input_border_default: '--input-border-default',
    input_border_focus: '--input-border-focus',
    input_border_error: '--input-border-error',
    input_border_success: '--input-border-success',
    input_disabled_bg: '--input-disabled-bg',
    btn_primary_bg: '--btn-primary-bg',
    btn_primary_hover: '--btn-primary-hover',
    btn_primary_active: '--btn-primary-active',
    btn_primary_text: '--btn-primary-text',
    btn_primary_border: '--btn-primary-border',
    btn_primary_disabled: '--btn-primary-disabled',
    btn_secondary_bg: '--btn-secondary-bg',
    btn_secondary_hover: '--btn-secondary-hover',
    btn_secondary_active: '--btn-secondary-active',
    btn_secondary_text: '--btn-secondary-text',
    btn_secondary_border: '--btn-secondary-border',
    btn_secondary_disabled: '--btn-secondary-disabled',
    btn_success_bg: '--btn-success-bg',
    btn_success_hover: '--btn-success-hover',
    btn_success_active: '--btn-success-active',
    btn_success_text: '--btn-success-text',
    btn_success_border: '--btn-success-border',
    btn_success_disabled: '--btn-success-disabled',
    btn_danger_bg: '--btn-danger-bg',
    btn_danger_hover: '--btn-danger-hover',
    btn_danger_active: '--btn-danger-active',
    btn_danger_text: '--btn-danger-text',
    btn_danger_border: '--btn-danger-border',
    btn_danger_disabled: '--btn-danger-disabled',
    btn_warning_bg: '--btn-warning-bg',
    btn_warning_hover: '--btn-warning-hover',
    btn_warning_active: '--btn-warning-active',
    btn_warning_text: '--btn-warning-text',
    btn_warning_border: '--btn-warning-border',
    btn_warning_disabled: '--btn-warning-disabled',
    btn_info_bg: '--btn-info-bg',
    btn_info_hover: '--btn-info-hover',
    btn_info_active: '--btn-info-active',
    btn_info_text: '--btn-info-text',
    btn_info_border: '--btn-info-border',
    btn_info_disabled: '--btn-info-disabled',
    switch_on_bg: '--switch-on-bg',
    switch_off_bg: '--switch-off-bg',
    switch_knob: '--switch-knob',
    switch_disabled: '--switch-disabled',
    focus_ring: '--focus-ring',
    table_bg: '--table-bg',
    table_header_bg: '--table-header-bg',
    table_header_text: '--table-header-text',
    table_row_bg: '--table-row-bg',
    table_row_hover: '--table-row-hover',
    table_selected_row: '--table-selected-row',
    table_border: '--table-border',
    alert_success_bg: '--alert-success-bg',
    alert_success_text: '--alert-success-text',
    alert_success_icon: '--alert-success-icon',
    alert_success_border: '--alert-success-border',
    alert_error_bg: '--alert-error-bg',
    alert_error_text: '--alert-error-text',
    alert_error_icon: '--alert-error-icon',
    alert_error_border: '--alert-error-border',
    alert_warning_bg: '--alert-warning-bg',
    alert_warning_text: '--alert-warning-text',
    alert_warning_icon: '--alert-warning-icon',
    alert_warning_border: '--alert-warning-border',
    alert_info_bg: '--alert-info-bg',
    alert_info_text: '--alert-info-text',
    alert_info_icon: '--alert-info-icon',
    alert_info_border: '--alert-info-border',
    chart_bg: '--chart-bg',
    chart_grid: '--chart-grid',
    chart_axis: '--chart-axis',
    chart_series_1: '--chart-series-1',
    chart_series_2: '--chart-series-2',
    chart_series_3: '--chart-series-3',
    chart_series_4: '--chart-series-4',
    chart_series_5: '--chart-series-5',
    chart_series_6: '--chart-series-6',
    chart_tooltip_bg: '--chart-tooltip-bg',
    chart_tooltip_text: '--chart-tooltip-text',
    selected_bg: '--selected-bg',
    selected_text: '--selected-text',
    highlight_color: '--highlight-color',
    focus_outline: '--focus-outline',
    state_active: '--state-active',
    state_inactive: '--state-inactive',
    state_disabled: '--state-disabled',
    state_skeleton: '--state-skeleton',
    state_overlay: '--state-overlay',
    scrollbar_track: '--scrollbar-track',
    scrollbar_thumb: '--scrollbar-thumb',
    scrollbar_thumb_hover: '--scrollbar-thumb-hover',
    ambient_1: '--ambient-1',
    ambient_2: '--ambient-2',
    ambient_3: '--ambient-3',
    radius_sm: '--radius-sm',
    radius_md: '--radius-md',
    radius_lg: '--radius-lg',
    radius_xl: '--radius-xl',
};


function applyDerivedAliases(root: HTMLElement, tokens: Partial<ThemeTokens>) {
    // ── 1. Global Layout ────────────────────────────────────────────────
    if (tokens.bg_app) { root.style.setProperty('--bg-app', tokens.bg_app); root.style.setProperty('--bg-primary', tokens.bg_app); root.style.setProperty('--bg-deep', tokens.bg_app); root.style.setProperty('--color-background', tokens.bg_app); }
    if (tokens.bg_page) { root.style.setProperty('--bg-page', tokens.bg_page); }
    if (tokens.bg_section) { root.style.setProperty('--bg-section', tokens.bg_section); root.style.setProperty('--bg-secondary', tokens.bg_section); root.style.setProperty('--bg-tertiary', tokens.bg_section); root.style.setProperty('--color-surface', tokens.bg_section); root.style.setProperty('--bg-surface', tokens.bg_section); root.style.setProperty('--dropdown-bg', tokens.bg_section); root.style.setProperty('--modal-bg', tokens.bg_section); }
    if (tokens.divider_color) { root.style.setProperty('--color-border', tokens.divider_color); root.style.setProperty('--border-color', tokens.divider_color); root.style.setProperty('--nav-border', tokens.divider_color); root.style.setProperty('--header-border', tokens.divider_color); }

    // ── 2. Typography ───────────────────────────────────────────────────
    if (tokens.text_primary) { root.style.setProperty('--color-text', tokens.text_primary); root.style.setProperty('--text-primary', tokens.text_primary); root.style.setProperty('--color-text-primary', tokens.text_primary); root.style.setProperty('--nav-item-text-hover', tokens.text_primary); }
    if (tokens.text_secondary) { root.style.setProperty('--text-secondary', tokens.text_secondary); root.style.setProperty('--color-text-secondary', tokens.text_secondary); root.style.setProperty('--color-text-muted', tokens.text_secondary); root.style.setProperty('--nav-item-text', tokens.text_secondary); root.style.setProperty('--dropdown-item-text', tokens.text_secondary); }
    if (tokens.text_muted) { root.style.setProperty('--text-muted', tokens.text_muted); root.style.setProperty('--text-tertiary', tokens.text_muted); root.style.setProperty('--nav-section-label', tokens.text_muted); }
    if (tokens.text_inverse) { root.style.setProperty('--text-inverse', tokens.text_inverse); root.style.setProperty('--color-text-inverse', tokens.text_inverse); }
    if (tokens.text_heading) { root.style.setProperty('--text-heading', tokens.text_heading); }

    // ── 3. Navigation ───────────────────────────────────────────────────
    if (tokens.nav_bg) { root.style.setProperty('--nav-bg', tokens.nav_bg); root.style.setProperty('--nav-header-bg', tokens.nav_bg); }
    if (tokens.nav_item_active) { root.style.setProperty('--nav-item-active', tokens.nav_item_active); root.style.setProperty('--nav-item-bg-active', tokens.nav_item_active); root.style.setProperty('--tab-active-bg', tokens.nav_item_active); }
    if (tokens.nav_item_hover) { root.style.setProperty('--nav-item-hover', tokens.nav_item_hover); root.style.setProperty('--color-surface-hover', tokens.nav_item_hover); root.style.setProperty('--dropdown-item-hover-bg', tokens.nav_item_hover); root.style.setProperty('--btn-ghost-bg-hover', tokens.nav_item_hover); root.style.setProperty('--mode-switcher-bg', tokens.nav_item_hover); }
    if (tokens.header_bg) { root.style.setProperty('--header-bg', tokens.header_bg); }
    if (tokens.header_text) { root.style.setProperty('--header-text', tokens.header_text); }
    if (tokens.header_icons) { root.style.setProperty('--header-icons', tokens.header_icons); root.style.setProperty('--btn-ghost-text', tokens.header_icons); }

    // ── 4. Cards ────────────────────────────────────────────────────────
    if (tokens.card_bg) { root.style.setProperty('--card-bg', tokens.card_bg); root.style.setProperty('--glass-bg', tokens.card_bg); root.style.setProperty('--table-container-bg', tokens.card_bg); }
    if (tokens.card_header_bg) { root.style.setProperty('--card-header-bg', tokens.card_header_bg); }
    if (tokens.card_border) { root.style.setProperty('--card-border', tokens.card_border); root.style.setProperty('--glass-border', tokens.card_border); root.style.setProperty('--dropdown-border', tokens.card_border); root.style.setProperty('--modal-border', tokens.card_border); root.style.setProperty('--tab-border', tokens.card_border); }
    if (tokens.card_shadow) { root.style.setProperty('--card-shadow', tokens.card_shadow); root.style.setProperty('--glass-shadow', tokens.card_shadow); root.style.setProperty('--shadow-card', tokens.card_shadow); }
    if (tokens.card_hover) { root.style.setProperty('--card-hover', tokens.card_hover); root.style.setProperty('--glass-bg-hover', tokens.card_hover); }
    if (tokens.text_muted) { root.style.setProperty('--badge-neutral-bg', tokens.state_skeleton || tokens.card_header_bg || tokens.nav_item_hover || 'rgba(148, 163, 184, 0.14)'); root.style.setProperty('--badge-neutral-text', tokens.text_muted); }

    // ── 5. Forms ────────────────────────────────────────────────────────
    if (tokens.input_bg) { root.style.setProperty('--input-bg', tokens.input_bg); }
    if (tokens.input_text) { root.style.setProperty('--input-text', tokens.input_text); root.style.setProperty('--modal-header-text', tokens.input_text); }
    if (tokens.input_placeholder) { root.style.setProperty('--input-placeholder', tokens.input_placeholder); root.style.setProperty('--input-label', tokens.input_placeholder); }
    if (tokens.input_border_default) { root.style.setProperty('--input-border-default', tokens.input_border_default); root.style.setProperty('--input-border', tokens.input_border_default); root.style.setProperty('--btn-outline-border', tokens.input_border_default); root.style.setProperty('--checkbox-border', tokens.input_border_default); root.style.setProperty('--radio-border', tokens.input_border_default); }
    if (tokens.input_border_focus) { root.style.setProperty('--input-border-focus', tokens.input_border_focus); root.style.setProperty('--color-border-focus', tokens.input_border_focus); root.style.setProperty('--tab-active-text', tokens.input_border_focus); root.style.setProperty('--nav-item-text-active', tokens.input_border_focus); }
    if (tokens.input_border_error) { root.style.setProperty('--input-border-error', tokens.input_border_error); root.style.setProperty('--input-error-border', tokens.input_border_error); root.style.setProperty('--input-error-text', tokens.input_border_error); }
    if (tokens.input_disabled_bg) { root.style.setProperty('--input-disabled-bg', tokens.input_disabled_bg); }

    // ── 6. Buttons ──────────────────────────────────────────────────────
    if (tokens.btn_primary_bg) { root.style.setProperty('--btn-primary-bg', tokens.btn_primary_bg); root.style.setProperty('--color-primary', tokens.btn_primary_bg); root.style.setProperty('--accent-primary', tokens.btn_primary_bg); root.style.setProperty('--checkbox-checked-bg', tokens.btn_primary_bg); root.style.setProperty('--checkbox-checked-border', tokens.btn_primary_bg); root.style.setProperty('--radio-checked-bg', tokens.btn_primary_bg); root.style.setProperty('--switch-on-bg', tokens.switch_on_bg || tokens.btn_primary_bg); }
    if (tokens.btn_primary_hover) { root.style.setProperty('--btn-primary-hover', tokens.btn_primary_hover); root.style.setProperty('--color-primary-hover', tokens.btn_primary_hover); }
    if (tokens.btn_secondary_bg) { root.style.setProperty('--btn-secondary-bg', tokens.btn_secondary_bg); root.style.setProperty('--color-secondary', tokens.btn_secondary_bg); root.style.setProperty('--accent-secondary', tokens.btn_secondary_bg); }

    // Brand gradient
    if (tokens.btn_primary_bg) {
        root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${tokens.btn_primary_bg} 0%, ${tokens.chart_series_3 ?? tokens.btn_primary_bg} 100%)`);
    }

    // ── 7. Switches ──────────────────────────────────────────────────────
    if (tokens.switch_on_bg) { root.style.setProperty('--switch-on-bg', tokens.switch_on_bg); }
    if (tokens.switch_off_bg) { root.style.setProperty('--switch-off-bg', tokens.switch_off_bg); }
    if (tokens.switch_knob) { root.style.setProperty('--switch-knob', tokens.switch_knob); root.style.setProperty('--switch-thumb', tokens.switch_knob); }
    if (tokens.focus_ring) { root.style.setProperty('--focus-ring', tokens.focus_ring); root.style.setProperty('--focus-outline', tokens.focus_ring); }

    // ── 8. Tables ────────────────────────────────────────────────────────
    if (tokens.table_header_bg) { root.style.setProperty('--table-header-bg', tokens.table_header_bg); }
    if (tokens.table_header_text) { root.style.setProperty('--table-header-text', tokens.table_header_text); }
    if (tokens.table_row_hover) { root.style.setProperty('--table-row-hover', tokens.table_row_hover); root.style.setProperty('--table-row-hover-bg', tokens.table_row_hover); }
    if (tokens.table_border) { root.style.setProperty('--table-border', tokens.table_border); }

    // ── 9. Alerts → Semantic & Badge aliases ─────────────────────────────
    if (tokens.alert_success_text) { root.style.setProperty('--color-success', tokens.alert_success_text); root.style.setProperty('--success', tokens.alert_success_text); root.style.setProperty('--badge-success-text', tokens.alert_success_text); root.style.setProperty('--badge-active-text', tokens.alert_success_text); root.style.setProperty('--chart-profit', tokens.alert_success_text); }
    if (tokens.alert_success_bg) { root.style.setProperty('--badge-success-bg', tokens.alert_success_bg); root.style.setProperty('--badge-active-bg', tokens.alert_success_bg); }
    if (tokens.alert_warning_text) { root.style.setProperty('--color-warning', tokens.alert_warning_text); root.style.setProperty('--warning', tokens.alert_warning_text); root.style.setProperty('--badge-warning-text', tokens.alert_warning_text); }
    if (tokens.alert_warning_bg) { root.style.setProperty('--badge-warning-bg', tokens.alert_warning_bg); }
    if (tokens.alert_error_text) { root.style.setProperty('--color-danger', tokens.alert_error_text); root.style.setProperty('--danger', tokens.alert_error_text); root.style.setProperty('--badge-danger-text', tokens.alert_error_text); root.style.setProperty('--badge-pending-text', tokens.alert_error_text); root.style.setProperty('--chart-loss', tokens.alert_error_text); }
    if (tokens.alert_error_bg) { root.style.setProperty('--badge-danger-bg', tokens.alert_error_bg); root.style.setProperty('--color-danger-light', tokens.alert_error_bg); }
    if (tokens.alert_info_text) { root.style.setProperty('--color-info', tokens.alert_info_text); root.style.setProperty('--info', tokens.alert_info_text); root.style.setProperty('--badge-info-text', tokens.alert_info_text); root.style.setProperty('--badge-branch-text', tokens.alert_info_text); }
    if (tokens.alert_info_bg) { root.style.setProperty('--badge-info-bg', tokens.alert_info_bg); root.style.setProperty('--badge-branch-bg', tokens.alert_info_bg); }
    if (tokens.nav_item_active) { root.style.setProperty('--badge-system-bg', tokens.nav_item_active); root.style.setProperty('--badge-admin-bg', tokens.nav_item_active); root.style.setProperty('--mode-btn-admin-bg', tokens.nav_item_active); }
    if (tokens.input_border_focus) { root.style.setProperty('--badge-system-text', tokens.input_border_focus); root.style.setProperty('--badge-admin-text', tokens.input_border_focus); root.style.setProperty('--mode-btn-admin-text', tokens.input_border_focus); }
    if (tokens.alert_info_bg) { root.style.setProperty('--mode-btn-branch-bg', tokens.alert_info_bg); }
    if (tokens.alert_info_text) { root.style.setProperty('--mode-btn-branch-text', tokens.alert_info_text); }
    if (tokens.alert_warning_bg) { root.style.setProperty('--badge-pending-bg', tokens.alert_warning_bg); }
    if (tokens.alert_warning_text) { root.style.setProperty('--badge-pending-text', tokens.alert_warning_text); }

    // ── 10. Charts ────────────────────────────────────────────────────────
    if (tokens.chart_series_1) { root.style.setProperty('--accent-tertiary', tokens.chart_series_1); root.style.setProperty('--chart-sales', tokens.chart_series_1); }
    if (tokens.chart_tooltip_bg) { root.style.setProperty('--chart-tooltip-bg', tokens.chart_tooltip_bg); }
    if (tokens.chart_tooltip_text) { root.style.setProperty('--chart-tooltip-text', tokens.chart_tooltip_text); }
    if (tokens.chart_grid) { root.style.setProperty('--analytics-border', tokens.chart_grid); }

    // ── 11. Selection & Focus ─────────────────────────────────────────────
    if (tokens.selected_bg) { root.style.setProperty('--selected-bg', tokens.selected_bg); }
    if (tokens.highlight_color) { root.style.setProperty('--highlight-color', tokens.highlight_color); root.style.setProperty('--focus-outline', tokens.highlight_color); }

    // ── 12. System States ─────────────────────────────────────────────────
    if (tokens.state_overlay) { root.style.setProperty('--state-overlay', tokens.state_overlay); root.style.setProperty('--modal-overlay-bg', tokens.state_overlay); root.style.setProperty('--bg-overlay', tokens.state_overlay); }
    if (tokens.state_skeleton) { root.style.setProperty('--state-skeleton', tokens.state_skeleton); }

    // ── 13. Scrollbar ─────────────────────────────────────────────────────
    if (tokens.scrollbar_track) { root.style.setProperty('--scrollbar-track', tokens.scrollbar_track); }
    if (tokens.scrollbar_thumb) { root.style.setProperty('--scrollbar-thumb', tokens.scrollbar_thumb); }
    if (tokens.scrollbar_thumb_hover) { root.style.setProperty('--scrollbar-thumb-hover', tokens.scrollbar_thumb_hover); }

    // ── 14. Ambient decorative ───────────────────────────────────────────
    if (tokens.ambient_1) root.style.setProperty('--ambient-1', tokens.ambient_1);
    if (tokens.ambient_2) root.style.setProperty('--ambient-2', tokens.ambient_2);
    if (tokens.ambient_3) root.style.setProperty('--ambient-3', tokens.ambient_3);
}


function applyCssVariables(tokens: Partial<ThemeTokens>) {
    const root = document.documentElement;
    (Object.entries(tokens) as [keyof ThemeTokens, string][]).forEach(([key, value]) => {
        const cssVar = TOKEN_TO_CSS_VAR[key];
        if (cssVar && value) root.style.setProperty(cssVar, value);
    });
    applyDerivedAliases(root, tokens);
}

// ─── Provider ────────────────────────────────────────────────────────────────
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme | null>(FALLBACK_THEMES.find((t) => t.is_active) ?? FALLBACK_THEMES[0]);
    const [allThemes, setAllThemes] = useState<Theme[]>(FALLBACK_THEMES);
    const [previewTokens, setPreviewTokensState] = useState<Partial<ThemeTokens> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshTheme = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = readAuthSessionItem('access_token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const [activeRes, allRes] = await Promise.all([
                fetch(apiUrl('/platform/themes/active'), { headers }),
                fetch(apiUrl('/platform/themes'), { headers }),
            ]);
            const active: Theme | null = activeRes.ok ? await activeRes.json().catch(() => null) : null;
            const all: Theme[] = allRes.ok ? await allRes.json().catch(() => []) : [];
            const nextThemes = Array.isArray(all) && all.length > 0 ? all : FALLBACK_THEMES;
            setAllThemes(nextThemes);
            if (active && !previewTokens) {
                setTheme(active);
                applyCssVariables(active.tokens);
            } else if (!active && !previewTokens) {
                const fallback = nextThemes.find((t) => t.is_active) ?? nextThemes[0];
                setTheme(fallback);
                applyCssVariables(fallback.tokens);
            }
        } catch {
            const fallback = FALLBACK_THEMES.find((t) => t.is_active) ?? FALLBACK_THEMES[0];
            setAllThemes(FALLBACK_THEMES);
            setTheme(fallback);
            applyCssVariables(fallback.tokens);
            // Backend unreachable — index.css fallbacks stay applied
        } finally {
            setIsLoading(false);
        }
    }, [previewTokens]);

    useEffect(() => { void refreshTheme(); }, [refreshTheme]);

    useEffect(() => {
        if (theme?.slug === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const updateTokens = () => {
                const isDark = mediaQuery.matches;
                const systemLight = allThemes.find(t => t.slug === 'light')?.tokens;
                const systemDark = allThemes.find(t => t.slug === 'dark')?.tokens;

                if (isDark && systemDark) applyCssVariables(systemDark);
                else if (!isDark && systemLight) applyCssVariables(systemLight);
            };

            updateTokens(); // Initial check
            mediaQuery.addEventListener('change', updateTokens);
            return () => mediaQuery.removeEventListener('change', updateTokens);
        } else if (previewTokens) {
            applyCssVariables({ ...theme?.tokens, ...previewTokens });
        } else if (theme) {
            applyCssVariables(theme.tokens);
        }
    }, [previewTokens, theme, allThemes]);

    const setPreviewTokens = (tokens: Partial<ThemeTokens> | null) => setPreviewTokensState(tokens);

    const activateTheme = async (id: string) => {
        // Optimistic update: Find the theme in our current list and apply its tokens immediately
        const selected = allThemes.find(t => t.id === id);
        if (selected) {
            setTheme(selected);
            if (selected.slug !== 'system') {
                applyCssVariables(selected.tokens);
            } else {
                // Trigger immediate system re-evaluation
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const sysTokens = allThemes.find(t => t.slug === (isDark ? 'dark' : 'light'))?.tokens;
                if (sysTokens) applyCssVariables(sysTokens);
            }
        }

        try {
            if (id.startsWith('fallback-')) {
                return;
            }
            const token = readAuthSessionItem('access_token');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Note: We might want to pass client_id here if we have it in context later
            await fetch(apiUrl(`/platform/themes/${id}/activate`), {
                method: 'POST',
                headers,
            });
            await refreshTheme();
        } catch (error) {
            console.error('Failed to activate theme on server:', error);
            // Revert or refresh if it failed
            await refreshTheme();
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, allThemes, isLoading, setPreviewTokens, activateTheme, refreshTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
