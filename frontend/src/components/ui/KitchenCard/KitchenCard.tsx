import React from 'react';
import clsx from 'clsx';
import styles from './KitchenCard.module.css';

export interface KitchenCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: React.ReactNode;
    footer?: React.ReactNode;
    extra?: React.ReactNode;
    noPadding?: boolean;
}

export const KitchenCard = React.forwardRef<HTMLDivElement, KitchenCardProps>(
    ({ className, children, title, footer, extra, noPadding = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={clsx(styles.card, className)}
                {...props}
            >
                {title && (
                    <div className={styles.header}>
                        <div className={styles.titleContainer}>
                            {typeof title === 'string' ? <h3 className={styles.title}>{title}</h3> : title}
                        </div>
                        {extra && <div className={styles.extra}>{extra}</div>}
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
