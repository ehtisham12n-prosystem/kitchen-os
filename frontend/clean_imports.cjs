const fs = require('fs');
const glob = require('glob');
const path = require('path');

const dir = path.join(__dirname, 'src/pages');
const tsconfigPaths = glob.sync(dir + '/**/*.{ts,tsx}');

tsconfigPaths.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    const unusedVars = [
        'Globe', 'AlertCircle', 'CreditCard', 'Zap', 'ZapOff', 'Cpu', 'UserPlus', 'RefreshCw',
        'Bell', 'ChevronRight', 'PieChartIcon', 'Layers', 'Shield', 'AreaChart', 'Area', 'Cell',
        'PieChart', 'Pie', 'BarChart', 'Bar', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip',
        'ResponsiveContainer', 'KitchenTable', 'KitchenSelect', 'KitchenInput', 'LineChart',
        'Line', 'Legend', 'Filter', 'Download', 'Play', 'MoreVertical', 'TrendingUp',
        'TrendingDown', 'Activity', 'Clock', 'CheckCircle', 'XCircle', 'AlertTriangle',
        'UserCheck', 'Settings', 'Database', 'Server', 'Trash2', 'Edit', 'Plus', 'Search',
        'ArrowRight', 'CheckCircle2', 'Copy', 'Fingerprint', 'User', 'LayoutGrid', 'Package',
        'Briefcase', 'Building2', 'Bell'
    ];

    let modified = false;
    unusedVars.forEach(v => {
        const regex = new RegExp('\\b' + v + '\\b,?\\s*', 'g');
        const newContent = content.replace(regex, '');
        if (content !== newContent) {
            content = newContent;
            modified = true;
        }
    });

    if (modified) {
        // Clean up empty braces if any like import { } from 'lucide-react'
        content = content.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');

        // Fix trailing commas in imports left by regex: import { A, }
        content = content.replace(/,\s*\}/g, ' }');

        fs.writeFileSync(file, content);
    }
});
console.log('Done cleaning imports');
