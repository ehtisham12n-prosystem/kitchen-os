import styles from './POSLayout.module.css';

interface POSLayoutProps {
    categoryPane: React.ReactNode;
    gridPane: React.ReactNode;
    cartPane: React.ReactNode;
}

export function POSLayout({ categoryPane, gridPane, cartPane }: POSLayoutProps) {
    // Typical responsive layout: 
    // Desktop/Tablet Landscape: Left pane (Categories + Grid) takes up remaining space, Right pane (Cart) is fixed width (e.g., 380px or 30%)

    return (
        <div className={styles.container}>
            {/* Top minimal header spanning full width for essential status like Network, Current User etc. */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.brand}>KitchenOS POS</h1>
                    <span className={styles.connectionBadge}>Online</span>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.clock}>12:34 PM</div>
                    <div className={styles.user}>Cashier 1</div>
                </div>
            </header>

            <main className={styles.mainArea}>
                {/* Left Side: Navigation and Items */}
                <section className={styles.menuSection}>
                    <div className={styles.categoryWrap}>
                        {categoryPane}
                    </div>
                    <div className={styles.gridWrap}>
                        {gridPane}
                    </div>
                </section>

                {/* Right Side: The Ticket/Cart */}
                <aside className={styles.cartSection}>
                    {cartPane}
                </aside>
            </main>
        </div>
    );
}
