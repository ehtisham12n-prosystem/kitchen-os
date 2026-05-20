import styles from './ProductGrid.module.css';
import { ProductItemCard } from './ProductItemCard';
import type { Product } from './ProductItemCard';

interface ProductGridProps {
    products: Product[];
    onAddToCart: (product: Product) => void;
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
    if (products.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>No products found in this category.</p>
            </div>
        );
    }

    return (
        <div className={styles.grid}>
            {products.map(product => (
                <ProductItemCard
                    key={product.id}
                    product={product}
                    onClick={() => onAddToCart(product)}
                />
            ))}
        </div>
    );
}
