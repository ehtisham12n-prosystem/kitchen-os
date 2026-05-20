import React from 'react';
import clsx from 'clsx';
import styles from './KitchenCard.module.css';

export interface KitchenCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: React.ReactNode;
    footer?: React.ReactNode;
    noPadding?: boolean;
}

export const KitchenCard = React.forwardRef<HTMLDivElement, KitchenCardProps>(
    ({ className, children, title, footer, noPadding = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={clsx(styles.card, className)}
                {...props}
            >
                {title && (
                    <div className={styles.header}>
                        {typeof title === 'string' ? <h3 className={styles.title}>{title}</h3> : title}
                    </div>
                )}

                <div className={clsx(styles.body, { [styles.noPadding]: noPadding })}>
                    {children}
                </div>

                {footer && <div className={styles.footer}>{footer}</div>}
            </div>
        );
    }
);

KitchenCard.displayName = 'KitchenCard';
