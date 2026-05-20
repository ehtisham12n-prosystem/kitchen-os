import React, { useState, useRef, useEffect } from 'react';
import { useThemeEngine } from '../../../providers/ThemeProvider';
import { Palette, Check, Monitor, Moon, Sun, Brush, Sparkles } from 'lucide-react';
import { readAuthSessionItem } from '../../../auth/storage';
import styles from './ThemePicker.module.css';

export const ThemePicker: React.FC = () => {
    const { theme, allThemes, activateTheme, isLoading } = useThemeEngine();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isSystemUser = (readAuthSessionItem('user_type') || 'client') === 'system';

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getIconForTheme = (slug: string) => {
        const s = slug?.toLowerCase() || '';
        if (s.includes('dark')) return <Moon size={14} />;
        if (s.includes('light')) return <Sun size={14} />;
        if (s.includes('blue')) return <Palette size={14} style={{ color: '#38bdf8' }} />;
        if (s.includes('purple')) return <Brush size={14} style={{ color: '#a855f7' }} />;
        if (s.includes('red')) return <Sparkles size={14} style={{ color: '#ef4444' }} />;
        return <Palette size={14} />;
    };

    if (isLoading) return null;

    return (
        <div className={styles.container} ref={dropdownRef}>
            <button
                className={styles.trigger}
                onClick={() => setIsOpen(!isOpen)}
                title="Personalize Nexus Experience"
            >
                <Palette size={20} />
            </button>

            {isOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.header}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className={styles.headerIcon}>
                                <Palette size={12} />
                            </div>
                            <h3>Theme Library</h3>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{allThemes.length} AVAILABLE</span>
                    </div>
                    <div className={styles.themeList}>
                        {allThemes.map((t) => {
                            const tok = (t.tokens || {}) as unknown as Record<string, string>;
                            const bg = tok.bg_app || tok.bg_primary || '#010814';
                            const primary = tok.btn_primary_bg || tok.accent_primary || '#6366f1';

                            return (
                                <button
                                    key={t.id}
                                    className={`${styles.themeItem} ${theme?.id === t.id ? styles.active : ''}`}
                                    onClick={() => {
                                        activateTheme(t.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div
                                        className={styles.preview}
                                        style={{
                                            backgroundColor: bg,
                                            borderColor: `${primary}30`
                                        }}
                                    >
                                        <div className={styles.iconOverlay}>
                                            {getIconForTheme(t.slug || t.theme_name)}
                                        </div>
                                        <div
                                            className={styles.swatch}
                                            style={{
                                                backgroundColor: primary,
                                                boxShadow: `0 0 10px ${primary}40`
                                            }}
                                        />
                                    </div>
                                    <div className={styles.info}>
                                        <span className={styles.name}>{t.theme_name}</span>
                                        <span className={styles.description}>{t.description || 'System professional theme'}</span>
                                    </div>
                                    {theme?.id === t.id && (
                                        <div className={styles.activeBadge}>
                                            <Check size={12} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {isSystemUser && (
                        <div className={styles.footer} onClick={() => { setIsOpen(false); window.location.href = '/nexus/themes'; }}>
                            <Monitor size={12} />
                            Manage Experience in Nexus
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
