import React from 'react';
import clsx from 'clsx';
import styles from './KitchenInput.module.css';

export interface KitchenInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    containerClassName?: string;
}

export const KitchenInput = React.forwardRef<HTMLInputElement, KitchenInputProps>(
    ({ className, containerClassName, label, error, icon, id, ...props }, ref) => {
        // Generate a unique ID if not provided, for binding label to input
        const generatedId = React.useId();
        const inputId = id || generatedId;

        return (
            <div className={clsx(styles.container, containerClassName)}>
                {label && (
                    <label htmlFor={inputId} className={styles.label}>
                        {label}
                        {props.required && <span className={styles.requiredAsterisk}>*</span>}
                    </label>
                )}
                <div className={styles.inputWrapper}>
                    {icon && <div className={styles.iconWrapper}>{icon}</div>}
                    <input
                        id={inputId}
                        ref={ref}
                        className={clsx(
                            styles.input,
                            {
                                [styles.hasIcon]: !!icon,
                                [styles.hasError]: !!error,
                            },
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && <span className={styles.errorMessage}>{error}</span>}
            </div>
        );
    }
);

KitchenInput.displayName = 'KitchenInput';
