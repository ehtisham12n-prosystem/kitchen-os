import React from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import styles from './KitchenSelect.module.css';

export interface KitchenSelectOption {
    value: string | number;
    label: string;
}

export interface KitchenSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: KitchenSelectOption[];
    error?: string;
    icon?: React.ReactNode;
    helpText?: React.ReactNode;
    containerClassName?: string;
}

export const KitchenSelect = React.forwardRef<HTMLSelectElement, KitchenSelectProps>(
    ({ label, options, error, icon, helpText, className, containerClassName, ...props }, ref) => {
        return (
            <div className={clsx(styles.container, containerClassName || className)}>
                {label && (
                    <label className={styles.label}>
                        {label}
                        {props.required && <span className={styles.requiredAsterisk}>*</span>}
                    </label>
                )}
                <div className={clsx(styles.selectWrapper, { [styles.hasError]: !!error })}>
                    {icon && <div className={styles.icon}>{icon}</div>}
                    <select
                        ref={ref}
                        className={clsx(styles.select, { [styles.hasIcon]: !!icon })}
                        {...props}
                    >
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <div className={styles.chevron}>
                        <ChevronDown size={16} />
                    </div>
                </div>
                {helpText && !error && <span className={styles.helpText}>{helpText}</span>}
                {error && <span className={styles.errorText}>{error}</span>}
            </div>
        );
    }
);

KitchenSelect.displayName = 'KitchenSelect';
