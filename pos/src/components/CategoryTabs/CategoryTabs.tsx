import clsx from 'clsx';
import styles from './CategoryTabs.module.css';

interface Category {
    id: string;
    name: string;
}

interface CategoryTabsProps {
    categories: Category[];
    activeCategoryId: string;
    onSelectCategory: (id: string) => void;
}

export function CategoryTabs({ categories, activeCategoryId, onSelectCategory }: CategoryTabsProps) {
    return (
        <div className={styles.scrollContainer}>
            <div className={styles.tabList}>
                <button
                    className={clsx(styles.tab, { [styles.active]: activeCategoryId === 'all' })}
                    onClick={() => onSelectCategory('all')}
                >
                    All Items
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={clsx(styles.tab, { [styles.active]: activeCategoryId === cat.id })}
                        onClick={() => onSelectCategory(cat.id)}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>
        </div>
    );
}
