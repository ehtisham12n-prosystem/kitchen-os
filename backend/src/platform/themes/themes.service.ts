import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Theme, ThemeTokens } from '../entities/theme.entity';

// ─── Token definitions for every preset theme ────────────────────────────────

const DARK_BASE_TOKENS: Partial<ThemeTokens> = {
    bg_app: '#020205', bg_page: '#08090f', bg_section: '#0f111a', divider_color: 'rgba(255,255,255,0.06)',
    text_primary: '#ffffff', text_secondary: '#94a3b8', text_muted: '#475569', text_inverse: '#ffffff', text_heading: '#ffffff',
    nav_bg: '#08090f', nav_item_active: 'rgba(99,102,241,0.15)', nav_item_inactive: 'transparent', nav_item_hover: 'rgba(255,255,255,0.05)',
    header_bg: '#08090f', header_text: '#ffffff', header_icons: '#94a3b8',
    card_bg: 'rgba(15,17,26,0.6)', card_header_bg: 'rgba(255,255,255,0.02)', card_border: 'rgba(255,255,255,0.06)', card_shadow: '0 8px 32px rgba(0,0,0,0.4)', card_hover: 'rgba(255,255,255,0.04)',
    input_bg: 'rgba(255,255,255,0.04)', input_text: '#ffffff', input_placeholder: '#475569', input_border_default: 'rgba(255,255,255,0.1)', input_disabled_bg: 'rgba(255,255,255,0.02)',
    switch_on_bg: '#6366f1', switch_off_bg: 'rgba(255,255,255,0.1)', switch_knob: '#ffffff', switch_disabled: 'rgba(255,255,255,0.05)', focus_ring: 'rgba(99,102,241,0.4)',
    table_bg: 'rgba(15,17,26,0.6)', table_header_bg: 'rgba(15,17,26,0.8)', table_header_text: '#94a3b8', table_row_bg: 'transparent', table_row_hover: 'rgba(255,255,255,0.02)', table_selected_row: 'rgba(99,102,241,0.1)', table_border: 'rgba(255,255,255,0.06)',
    chart_bg: 'transparent', chart_grid: 'rgba(255,255,255,0.05)', chart_axis: '#475569', chart_series_1: '#6366f1', chart_series_2: '#a855f7', chart_series_3: '#06b6d4', chart_series_4: '#10b981', chart_series_5: '#f59e0b', chart_series_6: '#ef4444', chart_tooltip_bg: '#161927', chart_tooltip_text: '#ffffff',
    selected_bg: 'rgba(99,102,241,0.2)', selected_text: '#ffffff', highlight_color: '#6366f1', focus_outline: '#6366f1',
    state_active: '#10b981', state_inactive: '#94a3b8', state_disabled: '#475569', state_skeleton: 'rgba(255,255,255,0.05)', state_overlay: 'rgba(0,0,0,0.85)',
    ambient_1: 'rgba(45,212,191,0.12)', ambient_2: 'rgba(96,165,250,0.10)', ambient_3: 'rgba(251,191,36,0.06)',
    radius_sm: '6px', radius_md: '8px', radius_lg: '8px', radius_xl: '8px',
};

const LIGHT_BASE_TOKENS: Partial<ThemeTokens> = {
    bg_app: '#f8fafc', bg_page: '#ffffff', bg_section: '#f1f5f9', divider_color: '#e2e8f0',
    text_primary: '#1e293b', text_secondary: '#64748b', text_muted: '#94a3b8', text_inverse: '#ffffff', text_heading: '#0f172a',
    nav_bg: '#ffffff', nav_item_active: 'rgba(99,102,241,0.1)', nav_item_inactive: 'transparent', nav_item_hover: '#f8fafc',
    header_bg: '#ffffff', header_text: '#1e293b', header_icons: '#64748b',
    card_bg: '#ffffff', card_header_bg: '#f8fafc', card_border: '#e2e8f0', card_shadow: '0 2px 12px rgba(15,23,42,0.06)', card_hover: '#fcfcfc',
    input_bg: '#ffffff', input_text: '#1e293b', input_placeholder: '#94a3b8', input_border_default: '#e2e8f0', input_disabled_bg: '#f8fafc',
    switch_on_bg: '#4f46e5', switch_off_bg: '#e2e8f0', switch_knob: '#ffffff', switch_disabled: '#f1f5f9', focus_ring: 'rgba(79,70,229,0.2)',
    table_bg: '#ffffff', table_header_bg: '#f8fafc', table_header_text: '#64748b', table_row_bg: '#ffffff', table_row_hover: '#f8fafc', table_selected_row: 'rgba(79,70,229,0.05)', table_border: '#e2e8f0',
    chart_bg: 'transparent', chart_grid: '#f1f5f9', chart_axis: '#94a3b8', chart_series_1: '#4f46e5', chart_series_2: '#7c3aed', chart_series_3: '#0891b2', chart_series_4: '#059669', chart_series_5: '#d97706', chart_series_6: '#dc2626', chart_tooltip_bg: '#ffffff', chart_tooltip_text: '#1e293b',
    selected_bg: 'rgba(79,70,229,0.1)', selected_text: '#4f46e5', highlight_color: '#4f46e5', focus_outline: '#4f46e5',
    state_active: '#059669', state_inactive: '#94a3b8', state_disabled: '#cbd5e1', state_skeleton: '#f1f5f9', state_overlay: 'rgba(15,23,42,0.6)',
    ambient_1: 'rgba(37,99,235,0.06)', ambient_2: 'rgba(15,118,110,0.05)', ambient_3: 'rgba(217,119,6,0.04)',
    radius_sm: '6px', radius_md: '8px', radius_lg: '8px', radius_xl: '8px',
};

// ─── Theme Helper: Apply standard button/alert states ────────────────────────

function withStates(base: Partial<ThemeTokens>, primary: string, success: string, danger: string, warning: string, info: string): ThemeTokens {
    const isDark = (base.bg_app as string).startsWith('#0');
    return {
        ...base,
        // Buttons
        btn_primary_bg: primary, btn_primary_hover: `${primary}ee`, btn_primary_active: `${primary}dd`, btn_primary_text: '#ffffff', btn_primary_border: 'transparent', btn_primary_disabled: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        btn_secondary_bg: base.text_muted as string, btn_secondary_hover: base.text_secondary as string, btn_secondary_active: base.text_primary as string, btn_secondary_text: '#ffffff', btn_secondary_border: 'transparent', btn_secondary_disabled: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        btn_success_bg: success, btn_success_hover: `${success}ee`, btn_success_active: `${success}dd`, btn_success_text: '#ffffff', btn_success_border: 'transparent', btn_success_disabled: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        btn_danger_bg: danger, btn_danger_hover: `${danger}ee`, btn_danger_active: `${danger}dd`, btn_danger_text: '#ffffff', btn_danger_border: 'transparent', btn_danger_disabled: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        btn_warning_bg: warning, btn_warning_hover: `${warning}ee`, btn_warning_active: `${warning}dd`, btn_warning_text: isDark ? '#1a1a1a' : '#ffffff', btn_warning_border: 'transparent', btn_warning_disabled: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        btn_info_bg: info, btn_info_hover: `${info}ee`, btn_info_active: `${info}dd`, btn_info_text: '#ffffff', btn_info_border: 'transparent', btn_info_disabled: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        // Alerts
        alert_success_bg: `${success}15`, alert_success_text: success, alert_success_icon: success, alert_success_border: `${success}30`,
        alert_error_bg: `${danger}15`, alert_error_text: danger, alert_error_icon: danger, alert_error_border: `${danger}30`,
        alert_warning_bg: `${warning}15`, alert_warning_text: warning, alert_warning_icon: warning, alert_warning_border: `${warning}30`,
        alert_info_bg: `${info}15`, alert_info_text: info, alert_info_icon: info, alert_info_border: `${info}30`,
        // Input overrides
        input_border_focus: primary, input_border_error: danger, input_border_success: success,
        // Scrollbar
        scrollbar_track: base.bg_app as string,
        scrollbar_thumb: base.bg_section as string,
        scrollbar_thumb_hover: base.text_muted as string,
    } as ThemeTokens;
}

const DARK_TOKENS = withStates(DARK_BASE_TOKENS, '#6366f1', '#10b981', '#ef4444', '#f59e0b', '#0ea5e9');
const LIGHT_TOKENS = withStates(LIGHT_BASE_TOKENS, '#2563eb', '#0f8f6f', '#dc2626', '#b7791f', '#0284c7');

const BLUE_TOKENS = withStates(
    { ...LIGHT_BASE_TOKENS, bg_app: '#f3f6fb', bg_page: '#f9fbff', bg_section: '#ffffff' },
    '#1d4ed8', '#0f766e', '#be123c', '#b45309', '#0369a1'
);

const PURPLE_TOKENS = withStates(
    {
        ...DARK_BASE_TOKENS,
        bg_app: '#111315', bg_page: '#171a1d', bg_section: '#1d2227', nav_bg: '#15181b',
        nav_item_active: 'rgba(52,211,153,0.14)', nav_item_hover: 'rgba(226,232,240,0.08)',
        chart_series_1: '#34d399', chart_series_2: '#67e8f9', chart_series_3: '#93c5fd',
        highlight_color: '#34d399'
    },
    '#34d399', '#22c55e', '#fb7185', '#fbbf24', '#67e8f9'
);

const ZINC_TOKENS = withStates(
    { ...LIGHT_BASE_TOKENS, bg_app: '#f1f5f9', bg_page: '#f8fafc', bg_section: '#ffffff' },
    '#64748b', '#10b981', '#ef4444', '#f59e0b', '#0ea5e9'
);

const DIM_TOKENS = withStates(
    { ...DARK_BASE_TOKENS, bg_app: '#0f111a', bg_page: '#161927', bg_section: '#1f2937' },
    '#6366f1', '#10b981', '#ef4444', '#f59e0b', '#0ea5e9'
);

const NORDIC_TOKENS = withStates(
    { ...LIGHT_BASE_TOKENS, bg_app: '#f3f7f4', bg_page: '#fbfdfb', bg_section: '#ffffff', divider_color: '#d7e3da' },
    '#2f6f5e', '#138a63', '#c2413b', '#a16207', '#287c96'
);

const LEGACY_SEED_THEMES = [
    {
        theme_name: 'Operations Dark',
        slug: 'dark',
        description: 'Deep Space Dark — Professional dark mode.',
        tokens: DARK_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Executive Light',
        slug: 'light',
        description: 'Clean Indigo — Professional high-contrast light theme.',
        tokens: LIGHT_TOKENS,
        is_system_default: true,
        is_active: true,
    },
    {
        theme_name: 'Cobalt Copper',
        slug: 'cobalt-copper',
        description: 'Ocean Professional — Clean light blue interface.',
        tokens: BLUE_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Slate Console',
        slug: 'slate-console',
        description: 'Atmospheric Dim — Balanced between light and dark.',
        tokens: DIM_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Industrial Zinc',
        slug: 'industrial-zinc',
        description: 'Clean Neutral — Professional gray-scale balanced aesthetic.',
        tokens: ZINC_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Sage Ledger',
        slug: 'sage-ledger',
        description: 'Arctic Soft — Cool gray mid-tone interface.',
        tokens: NORDIC_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Graphite Mint',
        slug: 'graphite-mint',
        description: 'Regal Dark — Deep purple tones.',
        tokens: PURPLE_TOKENS,
        is_system_default: true,
        is_active: false,
    },
];

const CURATED_SEED_THEMES = [
    {
        theme_name: 'Executive Light',
        slug: 'light',
        description: 'Neutral light workspace with cobalt action accents.',
        tokens: LIGHT_TOKENS,
        is_system_default: true,
        is_active: true,
    },
    {
        theme_name: 'Operations Dark',
        slug: 'dark',
        description: 'Low-glare dark theme with teal and blue accents.',
        tokens: DARK_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Cobalt Copper',
        slug: 'cobalt-copper',
        description: 'Crisp cobalt base with restrained warm operational highlights.',
        tokens: BLUE_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Sage Ledger',
        slug: 'sage-ledger',
        description: 'Calm green-gray palette for finance and back office screens.',
        tokens: NORDIC_TOKENS,
        is_system_default: true,
        is_active: false,
    },
    {
        theme_name: 'Graphite Mint',
        slug: 'graphite-mint',
        description: 'Graphite dark mode with fresh mint signals.',
        tokens: PURPLE_TOKENS,
        is_system_default: true,
        is_active: false,
    },
];


@Injectable()
export class ThemesService {
    constructor(
        @InjectRepository(Theme)
        private readonly themeRepository: Repository<Theme>,
    ) { }

    async findAll(client_id?: string): Promise<Theme[]> {
        const query = this.themeRepository.createQueryBuilder('theme');
        if (client_id) {
            query.where('theme.client_id = :client_id', { client_id })
                .orWhere('theme.client_id IS NULL');
        } else {
            query.where('theme.client_id IS NULL');
        }
        return query.orderBy('theme.is_active', 'DESC').addOrderBy('theme.theme_name', 'ASC').getMany();
    }

    async findActive(client_id?: string): Promise<Theme | null> {
        const active = await this.themeRepository.findOne({
            where: client_id ? { client_id, is_active: true } : { is_active: true },
        });

        if (active) return active;

        // Fallback to system default 'light' if nothing else is active
        return this.themeRepository.findOne({ where: { slug: 'light' } });
    }

    async findOne(id: string): Promise<Theme> {
        const theme = await this.themeRepository.findOne({ where: { id } });
        if (!theme) throw new NotFoundException(`Theme with ID ${id} not found`);
        return theme;
    }

    async create(createThemeDto: Partial<Theme>, sysuserId?: number): Promise<Theme> {
        const theme = this.themeRepository.create({ ...createThemeDto, created_by: sysuserId });
        return this.themeRepository.save(theme);
    }

    async update(id: string, updateThemeDto: Partial<Theme>): Promise<Theme> {
        const theme = await this.findOne(id);
        Object.assign(theme, updateThemeDto);
        return this.themeRepository.save(theme);
    }

    async remove(id: string): Promise<void> {
        const theme = await this.findOne(id);
        if (theme.is_active || theme.is_system_default) {
            throw new Error('Cannot delete an active or system-default theme.');
        }
        await this.themeRepository.remove(theme);
    }

    async activateTheme(id: string, client_id?: string): Promise<Theme> {
        const theme = await this.findOne(id);
        const currentActive = await this.themeRepository.findOne({
            where: client_id ? { client_id, is_active: true } : { is_active: true },
        });
        if (currentActive && currentActive.id !== id) {
            currentActive.is_active = false;
            await this.themeRepository.save(currentActive);
        }
        theme.is_active = true;
        return this.themeRepository.save(theme);
    }

    /**
     * Seeds the 5 default system themes.
     * Safe to call multiple times — skips existing slugs.
     */
    // Replace the global system theme library. Client-specific themes are untouched.
    private async replaceSystemThemes(): Promise<string[]> {
        await this.themeRepository.delete({ client_id: IsNull() });
        for (const preset of CURATED_SEED_THEMES) {
            await this.themeRepository.save(this.themeRepository.create(preset as any));
        }
        return CURATED_SEED_THEMES.map((preset) => preset.slug);
    }

    async seedDefaults(): Promise<{ seeded: string[]; skipped: string[] }> {
        const seeded = await this.replaceSystemThemes();
        return { seeded, skipped: [] };
    }

    /**
     * Force re-seed — overwrites existing system defaults with latest token values.
     * Only for Nexus admins. Non-system themes are untouched.
     */
    async reseedDefaults(): Promise<{ updated: string[] }> {
        const updated = await this.replaceSystemThemes();
        return { updated };
    }
}
