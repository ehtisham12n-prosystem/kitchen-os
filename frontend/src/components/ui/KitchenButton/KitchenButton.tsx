import React from 'react';
import clsx from 'clsx';
import styles from './KitchenButton.module.css';

export type KitchenButtonVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'
    | 'link'
    | 'ghost'
    | 'outline'
    | 'outline-primary'
    | 'outline-secondary'
    | 'outline-success'
    | 'outline-danger'
    | 'outline-warning'
    | 'outline-info'
    | 'outline-dark';

export interface KitchenButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: KitchenButtonVariant;
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    fullWidth?: boolean;
}

export const KitchenButton = React.forwardRef<HTMLButtonElement, KitchenButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading = false, fullWidth = false, children, disabled, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={clsx(
                    styles.button,
                    styles[variant.replace(/-/g, '_') as keyof typeof styles],
                    styles[size],
                    {
                        [styles.loading]: isLoading,
                        [styles.fullWidth]: fullWidth,
                    },
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <span className={styles.spinnerWrapper}>
                        <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading...
                    </span>
                ) : (
                    children
                )}
            </button>
        );
    }
);

KitchenButton.displayName = 'KitchenButton';
