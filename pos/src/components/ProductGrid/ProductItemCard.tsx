import styles from './ProductItemCard.module.css';

export interface Product {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    color?: string; // Fallback background color if no image
}

interface ProductItemCardProps {
    product: Product;
    onClick: () => void;
}

export function ProductItemCard({ product, onClick }: ProductItemCardProps) {
    // Format price helper
    const formattedPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(product.price);

    return (
        <div className={styles.card} onClick={onClick}>
            <div
                className={styles.imageArea}
                style={{
                    backgroundColor: product.color || 'var(--color-primary-light)',
                    backgroundImage: product.imageUrl ? `url(${product.imageUrl})` : 'none'
                }}
            >
                {/* If no image, we could show an icon or just rely on the color block */}
            </div>
            <div className={styles.infoArea}>
                <h4 className={styles.name}>{product.name}</h4>
                <span className={styles.price}>{formattedPrice}</span>
            </div>
        </div>
    );
}
