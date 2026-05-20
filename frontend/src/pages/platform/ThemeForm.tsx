import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../../components/ui/KitchenCard/KitchenCard';
import { KitchenSelect } from '../../components/ui/KitchenSelect/KitchenSelect';
import { Save, ArrowLeft, Loader2, Info, Layout, Type, Navigation, CreditCard, MousePointer2, Table as TableIcon, Bell, BarChart3, ShieldCheck, ListFilter } from 'lucide-react';
import { themeApi } from '../../api/api';
import { useThemeEngine } from '../../providers/ThemeProvider';
import { toast } from '../../components/ui/KitchenToast/toast';
import { DEFAULT_TOKENS } from './themeConstants';

export function ThemeForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { setPreviewTokens } = useThemeEngine();

    const [isLoading, setIsLoading] = useState(!!id);
    const [isSaving, setIsSaving] = useState(false);
    const [themeName, setThemeName] = useState('New Custom Theme');
    const [clientId, setClientId] = useState('');
    const [tokens, setTokens] = useState<any>(DEFAULT_TOKENS);
    const [activeTab, setActiveTab] = useState('layout');

    useEffect(() => {
        const fetchTheme = async () => {
            if (!id) return;
            try {
                const data = await themeApi.getTheme(id);
                setThemeName(data.theme_name);
                setClientId(data.client_id?.toString() || '');
                setTokens({ ...DEFAULT_TOKENS, ...(data.tokens || {}) });
            } catch (err) {
                console.error(err);
                toast.error('Load Failed', 'Failed to load theme data.');
                navigate('/nexus/themes');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTheme();
    }, [id, navigate]);

    // Live Preview Hook
    useEffect(() => {
        setPreviewTokens(tokens);
        return () => setPreviewTokens(null);
    }, [tokens, setPreviewTokens]);

    const handleTokenChange = (key: string, value: string) => {
        setTokens((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                theme_name: themeName,
                tokens: tokens,
                client_id: clientId ? Number(clientId) : null,
                is_active: false,
                is_system_default: false
            };

            if (id) {
                await themeApi.updateTheme(id, payload);
            } else {
                await themeApi.createTheme(payload);
            }
            toast.success('Theme Saved', 'Theme configuration successfully stored.');
            navigate('/nexus/themes');
        } catch (err: any) {
            toast.error('Save Failed', err.message || 'An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    const sections = [
        { id: 'layout', label: 'Layout', icon: Layout },
        { id: 'type', label: 'Typography', icon: Type },
        { id: 'nav', label: 'Navigation', icon: Navigation },
        { id: 'cards', label: 'Cards', icon: CreditCard },
        { id: 'forms', label: 'Forms', icon: ListFilter },
        { id: 'buttons', label: 'Buttons', icon: MousePointer2 },
        { id: 'tables', label: 'Tables', icon: TableIcon },
        { id: 'alerts', label: 'Alerts', icon: Bell },
        { id: 'charts', label: 'Charts', icon: BarChart3 },
        { id: 'misc', label: 'Misc & States', icon: ShieldCheck },
    ];

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '128px' }}>
                <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <KitchenButton variant="ghost" onClick={() => navigate('/nexus/themes')} type="button">
                        <ArrowLeft size={20} />
                    </KitchenButton>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'var(--font-heading)' }}>
                            {id ? 'Configure Theme' : 'Design New Theme'}
                        </h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Modify design tokens with real-time feedback across the entire portal.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <KitchenButton variant="secondary" onClick={() => navigate('/nexus/themes')} type="button">Discard</KitchenButton>
                    <KitchenButton type="submit" isLoading={isSaving} disabled={!themeName}>
                        <Save size={18} style={{ marginRight: '8px' }} />
                        Persist Changes
                    </KitchenButton>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 380px', gap: '24px', alignItems: 'start' }}>

                {/* 1. Sidebar Navigator */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'sticky', top: '24px' }} className="glass-panel">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--divider-color)', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token Categories</span>
                    </div>
                    {sections.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setActiveTab(s.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                border: 'none',
                                background: activeTab === s.id ? 'var(--nav-item-active)' : 'transparent',
                                color: activeTab === s.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                borderRadius: '0',
                                borderLeft: activeTab === s.id ? '3px solid var(--accent-primary)' : '3px solid transparent'
                            }}
                        >
                            <s.icon size={18} />
                            <span style={{ fontWeight: activeTab === s.id ? 600 : 400 }}>{s.label}</span>
                        </button>
                    ))}
                </div>

                {/* 2. Main Editor Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <KitchenCard title="Identity & Scope">
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 2 }}>
                                <KitchenInput label="Theme Identity Name" required value={themeName} onChange={(e) => setThemeName(e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <KitchenInput label="Client ID (Optional)" type="number" placeholder="Global" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                            </div>
                        </div>
                    </KitchenCard>

                    {activeTab === 'layout' && (
                        <KitchenCard title="Global Page Layout">
                            <ColorInput label="App Background" value={tokens.bg_app} onChange={(v) => handleTokenChange('bg_app', v)} />
                            <ColorInput label="Page Surface" value={tokens.bg_page} onChange={(v) => handleTokenChange('bg_page', v)} />
                            <ColorInput label="Section Surface" value={tokens.bg_section} onChange={(v) => handleTokenChange('bg_section', v)} />
                            <ColorInput label="Divider color" value={tokens.divider_color} onChange={(v) => handleTokenChange('divider_color', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'type' && (
                        <KitchenCard title="Typography & Readability">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <KitchenSelect label="Body Font" value={tokens.font_family_body} onChange={(e) => handleTokenChange('font_family_body', e.target.value)} options={[
                                    { label: 'Inter (Default)', value: "'Inter', sans-serif" },
                                    { label: 'Roboto', value: "'Roboto', sans-serif" },
                                    { label: 'Outfit (Premium)', value: "'Outfit', sans-serif" }
                                ]} />
                                <KitchenSelect label="Heading Font" value={tokens.font_family_heading} onChange={(e) => handleTokenChange('font_family_heading', e.target.value)} options={[
                                    { label: 'Outfit (Modern)', value: "'Outfit', sans-serif" },
                                    { label: 'Inter', value: "'Inter', sans-serif" },
                                    { label: 'Playfair Display', value: "'Playfair Display', serif" }
                                ]} />
                            </div>
                            <ColorInput label="Primary Text" value={tokens.text_primary} onChange={(v) => handleTokenChange('text_primary', v)} />
                            <ColorInput label="Secondary Text" value={tokens.text_secondary} onChange={(v) => handleTokenChange('text_secondary', v)} />
                            <ColorInput label="Muted Text" value={tokens.text_muted} onChange={(v) => handleTokenChange('text_muted', v)} />
                            <ColorInput label="Inverse Text" value={tokens.text_inverse} onChange={(v) => handleTokenChange('text_inverse', v)} />
                            <ColorInput label="Heading Text" value={tokens.text_heading} onChange={(v) => handleTokenChange('text_heading', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'nav' && (
                        <KitchenCard title="Navigation & Branding">
                            <ColorInput label="Sidebar Background" value={tokens.nav_bg} onChange={(v) => handleTokenChange('nav_bg', v)} />
                            <ColorInput label="Nav Item Active" value={tokens.nav_item_active} onChange={(v) => handleTokenChange('nav_item_active', v)} />
                            <ColorInput label="Nav Item Hover" value={tokens.nav_item_hover} onChange={(v) => handleTokenChange('nav_item_hover', v)} />
                            <div style={{ height: '1px', background: 'var(--divider-color)', margin: '16px 0' }} />
                            <ColorInput label="Header Background" value={tokens.header_bg} onChange={(v) => handleTokenChange('header_bg', v)} />
                            <ColorInput label="Header Text" value={tokens.header_text} onChange={(v) => handleTokenChange('header_text', v)} />
                            <ColorInput label="Header Icons" value={tokens.header_icons} onChange={(v) => handleTokenChange('header_icons', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'cards' && (
                        <KitchenCard title="Cards & Surfaces">
                            <ColorInput label="Card Background" value={tokens.card_bg} onChange={(v) => handleTokenChange('card_bg', v)} />
                            <ColorInput label="Card Header BG" value={tokens.card_header_bg} onChange={(v) => handleTokenChange('card_header_bg', v)} />
                            <ColorInput label="Card Border" value={tokens.card_border} onChange={(v) => handleTokenChange('card_border', v)} />
                            <ColorInput label="Card Hover State" value={tokens.card_hover} onChange={(v) => handleTokenChange('card_hover', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'forms' && (
                        <KitchenCard title="Forms & Interaction">
                            <ColorInput label="Input Background" value={tokens.input_bg} onChange={(v) => handleTokenChange('input_bg', v)} />
                            <ColorInput label="Input Text" value={tokens.input_text} onChange={(v) => handleTokenChange('input_text', v)} />
                            <ColorInput label="Placeholder" value={tokens.input_placeholder} onChange={(v) => handleTokenChange('input_placeholder', v)} />
                            <ColorInput label="Border (Default)" value={tokens.input_border_default} onChange={(v) => handleTokenChange('input_border_default', v)} />
                            <ColorInput label="Border (Focus)" value={tokens.input_border_focus} onChange={(v) => handleTokenChange('input_border_focus', v)} />
                            <ColorInput label="Border (Error)" value={tokens.input_border_error} onChange={(v) => handleTokenChange('input_border_error', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'buttons' && (
                        <KitchenCard title="Button Engine">
                            <div style={{ padding: '12px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', fontSize: '12px', marginBottom: '16px', display: 'flex', gap: '8px' }}>
                                <Info size={14} className="text-accent" />
                                <span>Modify the primary action colors. Other buttons derive from secondary/status tokens.</span>
                            </div>
                            <ColorInput label="Primary BG" value={tokens.btn_primary_bg} onChange={(v) => handleTokenChange('btn_primary_bg', v)} />
                            <ColorInput label="Primary Hover" value={tokens.btn_primary_hover} onChange={(v) => handleTokenChange('btn_primary_hover', v)} />
                            <ColorInput label="Primary Text" value={tokens.btn_primary_text} onChange={(v) => handleTokenChange('btn_primary_text', v)} />
                            <div style={{ height: '1px', background: 'var(--divider-color)', margin: '16px 0' }} />
                            <ColorInput label="Secondary BG" value={tokens.btn_secondary_bg} onChange={(v) => handleTokenChange('btn_secondary_bg', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'tables' && (
                        <KitchenCard title="Table & List Views">
                            <ColorInput label="Table Background" value={tokens.table_bg} onChange={(v) => handleTokenChange('table_bg', v)} />
                            <ColorInput label="Header Background" value={tokens.table_header_bg} onChange={(v) => handleTokenChange('table_header_bg', v)} />
                            <ColorInput label="Row Hover BG" value={tokens.table_row_hover} onChange={(v) => handleTokenChange('table_row_hover', v)} />
                            <ColorInput label="Selected Row" value={tokens.table_selected_row} onChange={(v) => handleTokenChange('table_selected_row', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'alerts' && (
                        <KitchenCard title="Semantic Messaging">
                            <ColorInput label="Success Color" value={tokens.alert_success_text} onChange={(v) => handleTokenChange('alert_success_text', v)} />
                            <ColorInput label="Error Color" value={tokens.alert_error_text} onChange={(v) => handleTokenChange('alert_error_text', v)} />
                            <ColorInput label="Warning Color" value={tokens.alert_warning_text} onChange={(v) => handleTokenChange('alert_warning_text', v)} />
                            <ColorInput label="Info Color" value={tokens.alert_info_text} onChange={(v) => handleTokenChange('alert_info_text', v)} />
                        </KitchenCard>
                    )}

                    {activeTab === 'charts' && (
                        <KitchenCard title="Analytics Visualization">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <ColorInput label="Series 1" value={tokens.chart_series_1} onChange={(v) => handleTokenChange('chart_series_1', v)} />
                                <ColorInput label="Series 2" value={tokens.chart_series_2} onChange={(v) => handleTokenChange('chart_series_2', v)} />
                                <ColorInput label="Series 3" value={tokens.chart_series_3} onChange={(v) => handleTokenChange('chart_series_3', v)} />
                                <ColorInput label="Series 4" value={tokens.chart_series_4} onChange={(v) => handleTokenChange('chart_series_4', v)} />
                                <ColorInput label="Series 5" value={tokens.chart_series_5} onChange={(v) => handleTokenChange('chart_series_5', v)} />
                                <ColorInput label="Series 6" value={tokens.chart_series_6} onChange={(v) => handleTokenChange('chart_series_6', v)} />
                            </div>
                        </KitchenCard>
                    )}

                    {activeTab === 'misc' && (
                        <KitchenCard title="System States & Overlays">
                            <ColorInput label="Active Indicator" value={tokens.state_active} onChange={(v) => handleTokenChange('state_active', v)} />
                            <ColorInput label="Skeleton Base" value={tokens.state_skeleton} onChange={(v) => handleTokenChange('state_skeleton', v)} />
                            <ColorInput label="Modal Overlay" value={tokens.state_overlay} onChange={(v) => handleTokenChange('state_overlay', v)} />
                            <div style={{ height: '1px', background: 'var(--divider-color)', margin: '16px 0' }} />
                            <ColorInput label="Scrollbar Thumb" value={tokens.scrollbar_thumb} onChange={(v) => handleTokenChange('scrollbar_thumb', v)} />
                            <ColorInput label="Scrollbar Track" value={tokens.scrollbar_track} onChange={(v) => handleTokenChange('scrollbar_track', v)} />
                        </KitchenCard>
                    )}
                </div>

                {/* 3. Real-time Preview Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '24px' }}>
                    <KitchenCard title="Live Component Lab">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <KitchenButton variant="primary" style={{ flex: 1 }}>Action</KitchenButton>
                                <KitchenButton variant="secondary" style={{ flex: 1 }}>Secondary</KitchenButton>
                            </div>

                            <KitchenInput label="Input Aesthetic" placeholder="Enter text..." />

                            <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px' }}>
                                <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>Card Surface</h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>This is how your surface and text tokens interact.</p>
                            </div>

                            <div style={{
                                padding: '12px',
                                background: 'var(--alert-success-bg)',
                                color: 'var(--alert-success-text)',
                                border: '1px solid var(--alert-success-border)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 500
                            }}>
                                Success Message Example
                            </div>

                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} style={{ flex: 1, height: '30px', borderRadius: '4px', background: (tokens as any)[`chart_series_${i}`] }} />
                                ))}
                            </div>
                        </div>
                    </KitchenCard>

                    <KitchenCard title="Hierarchy Preview">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '20px', fontFamily: tokens.font_family_heading }}>Heading L1</h1>
                            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontFamily: tokens.font_family_heading }}>Heading L2</h2>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', fontFamily: tokens.font_family_body }}>Regular body content goes here.</p>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: tokens.font_family_body }}>Small muted helper text.</span>
                        </div>
                    </KitchenCard>
                </div>
            </div>
        </form>
    );
}

// ─── Shared UI Helper ────────────────────────────────────────────────────────────

const ColorInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        marginBottom: '4px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.05)',
    }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{value?.toUpperCase()}</span>
        </div>
        <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '8px', background: value, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
            <input
                type="color"
                value={value || '#000000'}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0
                }}
            />
        </div>
    </div>
);
