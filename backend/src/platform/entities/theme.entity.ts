import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Client } from './client.entity';

// ─── Token Keys ─────────────────────────────────────────────────────────────
// This interface documents every token key stored in the `tokens` JSONB column.
// All frontend CSS variables MUST map 1:1 to these keys.
export interface ThemeTokens {
    // ── 1. Global Layout ──────────────────────────────────────────────────
    bg_app: string;             // --bg-app
    bg_page: string;            // --bg-page
    bg_section: string;         // --bg-section
    divider_color: string;      // --divider-color

    // ── 2. Typography ─────────────────────────────────────────────────────
    text_primary: string;       // --text-primary
    text_secondary: string;     // --text-secondary
    text_muted: string;         // --text-muted
    text_inverse: string;       // --text-inverse
    text_heading: string;       // --text-heading (H1-H6)

    // ── 3. Navigation ─────────────────────────────────────────────────────
    nav_bg: string;             // --nav-bg
    nav_item_active: string;    // --nav-item-active
    nav_item_inactive: string;  // --nav-item-inactive
    nav_item_hover: string;     // --nav-item-hover
    header_bg: string;          // --header-bg
    header_text: string;        // --header-text
    header_icons: string;       // --header-icons

    // ── 4. Cards & Containers ─────────────────────────────────────────────
    card_bg: string;            // --card-bg
    card_header_bg: string;     // --card-header-bg
    card_border: string;        // --card-border
    card_shadow: string;        // --card-shadow
    card_hover: string;         // --card-hover

    // ── 5. Forms & Fields ─────────────────────────────────────────────────
    input_bg: string;           // --input-bg
    input_text: string;         // --input-text
    input_placeholder: string;  // --input-placeholder
    input_border_default: string; // --input-border-default
    input_border_focus: string; // --input-border-focus
    input_border_error: string; // --input-border-error
    input_border_success: string; // --input-border-success
    input_disabled_bg: string;  // --input-disabled-bg

    // ── 6. Buttons (Primary) ──────────────────────────────────────────────
    btn_primary_bg: string;      // --btn-primary-bg
    btn_primary_hover: string;   // --btn-primary-hover
    btn_primary_active: string;  // --btn-primary-active
    btn_primary_text: string;    // --btn-primary-text
    btn_primary_border: string;  // --btn-primary-border
    btn_primary_disabled: string;// --btn-primary-disabled

    // ── 6. Buttons (Secondary) ────────────────────────────────────────────
    btn_secondary_bg: string;
    btn_secondary_hover: string;
    btn_secondary_active: string;
    btn_secondary_text: string;
    btn_secondary_border: string;
    btn_secondary_disabled: string;

    // ── 6. Buttons (Success) ──────────────────────────────────────────────
    btn_success_bg: string;
    btn_success_hover: string;
    btn_success_active: string;
    btn_success_text: string;
    btn_success_border: string;
    btn_success_disabled: string;

    // ── 6. Buttons (Danger) ───────────────────────────────────────────────
    btn_danger_bg: string;
    btn_danger_hover: string;
    btn_danger_active: string;
    btn_danger_text: string;
    btn_danger_border: string;
    btn_danger_disabled: string;

    // ── 6. Buttons (Warning) ──────────────────────────────────────────────
    btn_warning_bg: string;
    btn_warning_hover: string;
    btn_warning_active: string;
    btn_warning_text: string;
    btn_warning_border: string;
    btn_warning_disabled: string;

    // ── 6. Buttons (Info) ─────────────────────────────────────────────────
    btn_info_bg: string;
    btn_info_hover: string;
    btn_info_active: string;
    btn_info_text: string;
    btn_info_border: string;
    btn_info_disabled: string;

    // ── 7. Switches / Toggles / Pills ─────────────────────────────────────
    switch_on_bg: string;       // --switch-on-bg
    switch_off_bg: string;      // --switch-off-bg
    switch_knob: string;        // --switch-knob
    switch_disabled: string;    // --switch-disabled
    focus_ring: string;         // --focus-ring

    // ── 8. Tables ─────────────────────────────────────────────────────────
    table_bg: string;            // --table-bg
    table_header_bg: string;     // --table-header-bg
    table_header_text: string;   // --table-header-text
    table_row_bg: string;        // --table-row-bg
    table_row_hover: string;     // --table-row-hover
    table_selected_row: string;  // --table-selected-row
    table_border: string;        // --table-border

    // ── 9. Alerts (Success) ───────────────────────────────────────────────
    alert_success_bg: string;    // --alert-success-bg
    alert_success_text: string;  // --alert-success-text
    alert_success_icon: string;  // --alert-success-icon
    alert_success_border: string;// --alert-success-border

    // ── 9. Alerts (Error) ─────────────────────────────────────────────────
    alert_error_bg: string;
    alert_error_text: string;
    alert_error_icon: string;
    alert_error_border: string;

    // ── 9. Alerts (Warning) ───────────────────────────────────────────────
    alert_warning_bg: string;
    alert_warning_text: string;
    alert_warning_icon: string;
    alert_warning_border: string;

    // ── 9. Alerts (Info) ──────────────────────────────────────────────────
    alert_info_bg: string;
    alert_info_text: string;
    alert_info_icon: string;
    alert_info_border: string;

    // ── 10. Charts & Infographics ─────────────────────────────────────────
    chart_bg: string;            // --chart-bg
    chart_grid: string;          // --chart-grid
    chart_axis: string;          // --chart-axis
    chart_series_1: string;      // --chart-series-1
    chart_series_2: string;
    chart_series_3: string;
    chart_series_4: string;
    chart_series_5: string;
    chart_series_6: string;
    chart_tooltip_bg: string;    // --chart-tooltip-bg
    chart_tooltip_text: string;  // --chart-tooltip-text

    // ── 11. Highlight & Selection ─────────────────────────────────────────
    selected_bg: string;         // --selected-bg
    selected_text: string;       // --selected-text
    highlight_color: string;     // --highlight-color
    focus_outline: string;       // --focus-outline

    // ── 12. System States ─────────────────────────────────────────────────
    state_active: string;        // --state-active
    state_inactive: string;      // --state-inactive
    state_disabled: string;      // --state-disabled
    state_skeleton: string;      // --state-skeleton
    state_overlay: string;       // --state-overlay

    // ── 13. Scrollbar ─────────────────────────────────────────────────────
    scrollbar_track: string;     // --scrollbar-track
    scrollbar_thumb: string;     // --scrollbar-thumb
    scrollbar_thumb_hover: string;// --scrollbar-thumb-hover

    // ── Legacy / Transitions / Misc ───────────────────────────────────────
    ambient_1: string;
    ambient_2: string;
    ambient_3: string;
    radius_sm: string;
    radius_md: string;
    radius_lg: string;
    radius_xl: string;
}


@Entity('themes')
@Index(['client_id'])
export class Theme {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'theme_name', length: 150 })
    theme_name: string;

    @Column({ name: 'slug', length: 80, unique: true, nullable: true })
    slug: string; // e.g. 'blue', 'dark', 'light', 'purple', 'orange'

    @Column({ name: 'description', length: 255, nullable: true })
    description: string;

    // ── Full token map (JSONB) ───────────────────────────────────────────
    @Column({ name: 'tokens', type: 'json', nullable: false })
    tokens: ThemeTokens;

    // ── Metadata ────────────────────────────────────────────────────────
    @Column({ name: 'is_active', default: false })
    is_active: boolean;

    @Column({ name: 'is_system_default', default: false })
    is_system_default: boolean;

    // null = global theme; set = client-branded override
    @ManyToOne(() => Client, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'client_id', referencedColumnName: 'client_code' })
    client: Client;

    @Column({ name: 'client_id', nullable: true })
    client_id: string;

    @Column({ name: 'created_by', nullable: true })
    created_by: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

