import { useState } from 'react';
import { KitchenButton } from '../components/ui/KitchenButton/KitchenButton';
import { KitchenInput } from '../components/ui/KitchenInput/KitchenInput';
import { KitchenCard } from '../components/ui/KitchenCard/KitchenCard';
import { KitchenTable } from '../components/ui/KitchenTable/KitchenTable';
import type { ColumnDef } from '../components/ui/KitchenTable/KitchenTable';
import { Search, Mail, Key } from 'lucide-react';

// Example Data for Table
interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
}

const tableData: UserData[] = [
    { id: '1', name: 'Alice Admin', email: 'alice@kitchenos.com', role: 'System Admin', status: 'Active' },
    { id: '2', name: 'Bob Manager', email: 'bob@example.com', role: 'Branch Manager', status: 'Active' },
    { id: '3', name: 'Charlie Chef', email: 'charlie@example.com', role: 'Kitchen Staff', status: 'Inactive' },
];

export function DesignSystemPreview() {
    const [themeColor, setThemeColor] = useState('#10b981'); // Default Green

    // Demonstrate White-labeling via CSS Variable overrides
    const applyTheme = (color: string) => {
        setThemeColor(color);
        document.documentElement.style.setProperty('--color-primary', color);

        // Simplistic derivation of hover colors for demonstration
        document.documentElement.style.setProperty('--color-primary-hover', color);
    };

    const columns: ColumnDef<UserData>[] = [
        { key: 'name', header: 'Name', cell: (row) => <strong>{row.name}</strong> },
        { key: 'email', header: 'Email', cell: (row) => row.email },
        { key: 'role', header: 'Role', cell: (row) => row.role },
        {
            key: 'status',
            header: 'Status',
            cell: (row) => (
                <span style={{ color: row.status === 'Active' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    {row.status}
                </span>
            )
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            cell: () => <KitchenButton variant="ghost" size="sm">Edit</KitchenButton>
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
                <h1>Design System Preview</h1>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    A live demonstration of the KitchenOS core styling, tokens, and UI wrappers.
                </p>
            </div>

            <KitchenCard title="Theme Dynamic Overrides (White-labeling)">
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                    Because we use CSS Variables for our design system, we can instantly re-theme the entire application
                    by overriding variables on the <code>:root</code> element. Try it below:
                </p>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                    <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => applyTheme(e.target.value)}
                        style={{ width: '50px', height: '40px', padding: '0', border: 'none' }}
                    />
                    <span>Current Primary: <strong>{themeColor}</strong></span>
                    <KitchenButton onClick={() => applyTheme('#10b981')} variant="outline" size="sm">Reset to Default</KitchenButton>
                    <KitchenButton onClick={() => applyTheme('#e11d48')} variant="outline" size="sm">Try Rose</KitchenButton>
                    <KitchenButton onClick={() => applyTheme('#4f46e5')} variant="outline" size="sm">Try Indigo</KitchenButton>
                </div>
            </KitchenCard>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

                {/* Buttons */}
                <KitchenCard title="Buttons">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <KitchenButton variant="primary">Primary</KitchenButton>
                            <KitchenButton variant="secondary">Secondary</KitchenButton>
                            <KitchenButton variant="danger">Danger</KitchenButton>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <KitchenButton variant="outline">Outline</KitchenButton>
                            <KitchenButton variant="ghost">Ghost</KitchenButton>
                            <KitchenButton variant="primary" isLoading>Loading</KitchenButton>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <KitchenButton size="sm">Small</KitchenButton>
                            <KitchenButton size="md">Medium</KitchenButton>
                            <KitchenButton size="lg">Large</KitchenButton>
                            <KitchenButton disabled>Disabled</KitchenButton>
                        </div>
                    </div>
                </KitchenCard>

                {/* Inputs */}
                <KitchenCard title="Inputs & Form Fields">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <KitchenInput label="Standard Input" placeholder="Type something..." />
                        <KitchenInput label="With Icon" placeholder="Search users" icon={<Search />} />
                        <KitchenInput label="Email Address" type="email" placeholder="name@company.com" icon={<Mail />} required />
                        <KitchenInput label="Password" type="password" placeholder="••••••••" icon={<Key />} error="Password is incorrectly formatted." />
                        <KitchenInput label="Disabled" disabled placeholder="Can't touch this" />
                    </div>
                </KitchenCard>
            </div>

            {/* Tables */}
            <KitchenCard title="Data Tables" noPadding>
                <KitchenTable
                    columns={columns}
                    data={tableData}
                    onRowClick={(row) => console.log('Clicked row', row)}
                />
            </KitchenCard>

        </div>
    );
}

