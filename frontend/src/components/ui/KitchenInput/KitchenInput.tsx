import React, { useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import styles from './KitchenInput.module.css';

export interface KitchenInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    /** Text or node rendered as a leading "addon" box (e.g. "@", "https://", "$") */
    addon?: React.ReactNode;
    containerClassName?: string;
    helpText?: React.ReactNode;
}

export const KitchenInput = React.forwardRef<HTMLInputElement, KitchenInputProps>(
    ({ className, containerClassName, label, error, icon, addon, id, helpText, type, ...props }, ref) => {
        const generatedId = React.useId();
        const inputId = id || generatedId;
        const [showPassword, setShowPassword] = useState(false);

        const isPassword = type === 'password';
        const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

        return (
            <div className={clsx(styles.container, containerClassName)}>
                {label && (
                    <label htmlFor={inputId} className={styles.label}>
                        {label}
                        {props.required && <span className={styles.requiredAsterisk}>*</span>}
                    </label>
                )}
                <div className={clsx(styles.inputWrapper, { [styles.hasError]: !!error })}>
                    {/* Addon box (e.g. "@", "$") — sits inside the border */}
                    {addon && <span className={styles.addon}>{addon}</span>}

                    {/* Floating icon — only used when no addon */}
                    {icon && !addon && <div className={styles.iconWrapper}>{icon}</div>}

                    <input
                        id={inputId}
                        ref={ref}
                        type={inputType}
                        className={clsx(
                            styles.input,
                            { [styles.hasIcon]: !!icon && !addon },
                            { [styles.hasToggle]: isPassword },
                            className
                        )}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            className={styles.passwordToggle}
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                            title={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    )}
                </div>
                {helpText && !error && <span className={styles.helpText}>{helpText}</span>}
                {error && (
                    <span className={styles.errorMessage}>
                        {error}
                    </span>
                )}
            </div>
        );
    }
);

KitchenInput.displayName = 'KitchenInput';
