import { useState } from 'react';
import { KitchenButton } from '../../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../../components/ui/KitchenInput/KitchenInput';
import { ArrowLeft, Save, Boxes, Grid, Layers, Package } from 'lucide-react';
import styles from './InventoryForm.module.css';

interface InventoryFormProps {
    level: 'class' | 'type' | 'subType' | 'item';
    onCancel: () => void;
    onSave: (data: any) => void;
    parentId?: number;
}

export function InventoryForm({ level, onCancel, onSave }: InventoryFormProps) {
    const [isLoading, setIsLoading] = useState(false);

    const getTitle = () => {
        switch (level) {
            case 'class': return 'Create Inventory Class';
            case 'type': return 'Add Inventory Type';
            case 'subType': return 'Add Inventory Sub-Type';
            case 'item': return 'Define Inventory Item (SKU)';
        }
    };

    const getIcon = () => {
        switch (level) {
            case 'class': return <Boxes />;
            case 'type': return <Grid />;
            case 'subType': return <Layers />;
            case 'item': return <Package />;
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Mock save
        setTimeout(() => {
            setIsLoading(false);
            onSave({});
        }, 800);
    };

    return (
        <div className={styles.formOverlay}>
            <div className={styles.formContainer}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.icon}>{getIcon()}</div>
                        <h2>{getTitle()}</h2>
                    </div>
                    <KitchenButton variant="ghost" size="sm" onClick={onCancel}>
                        <ArrowLeft size={20} />
                    </KitchenButton>
                </header>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.fields}>
                        <KitchenInput
                            label={`${level.charAt(0).toUpperCase() + level.slice(1)} Name`}
                            placeholder={`e.g. ${level === 'class' ? 'Raw Materials' : level === 'type' ? 'Proteins' : level === 'subType' ? 'Poultry' : 'Chicken Whole'}`}
                            required
                        />

                        {level === 'class' && (
                            <KitchenInput
                                label="Description"
                                placeholder="Briefly describe this category..."
                            />
                        )}

                        {level === 'item' && (
                            <div className={styles.row}>
                                <KitchenInput label="SKU" placeholder="INV-001" />
                                <KitchenInput label="Base Unit (UoM)" placeholder="e.g. kg, pieces" required />
                            </div>
                        )}
                    </div>

                    <div className={styles.actions}>
                        <KitchenButton variant="outline" onClick={onCancel} type="button">Cancel</KitchenButton>
                        <KitchenButton variant="primary" type="submit" isLoading={isLoading}>
                            <Save size={18} style={{ marginRight: '8px' }} />
                            Save Details
                        </KitchenButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
