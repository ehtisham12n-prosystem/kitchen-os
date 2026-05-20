import React from 'react';
import clsx from 'clsx';
import styles from './KitchenTable.module.css';

export interface ColumnDef<T> {
    key: string;
    header: React.ReactNode;
    cell: (row: T) => React.ReactNode;
    align?: 'left' | 'center' | 'right';
    width?: string;
}

export interface KitchenTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
    className?: string;
    emptyMessage?: React.ReactNode;
    compact?: boolean;
}

export function KitchenTable<T>({
    columns,
    data,
    onRowClick,
    className,
    emptyMessage = "No data available",
    compact = false
}: KitchenTableProps<T>) {
    return (
        <div className={clsx(styles.tableOuter, className, { [styles.compact]: compact })}>
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead className={styles.thead}>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={clsx(styles.th, {
                                        [styles.alignLeft]: col.align === 'left' || !col.align,
                                        [styles.alignCenter]: col.align === 'center',
                                        [styles.alignRight]: col.align === 'right',
                                    })}
                                    style={{ width: col.width }}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className={styles.emptyCell}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, rowIndex) => (
                                <tr
                                    key={rowIndex}
                                    className={clsx(styles.tr, { [styles.clickable]: !!onRowClick })}
                                    onClick={() => onRowClick && onRowClick(row)}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={clsx(styles.td, {
                                                [styles.alignLeft]: col.align === 'left' || !col.align,
                                                [styles.alignCenter]: col.align === 'center',
                                                [styles.alignRight]: col.align === 'right',
                                            })}
                                        >
                                            {col.cell(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
