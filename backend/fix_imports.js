const fs = require('fs');
const path = require('path');

const files = [
    'src\\vendor\\vendor.controller.ts',
    'src\\setup\\roles\\roles.controller.ts',
    'src\\setup\\designations\\designations.controller.ts',
    'src\\setup\\branches\\branches.controller.ts',
    'src\\production\\production.controller.ts',
    'src\\recipe\\recipe.controller.ts',
    'src\\platform\\tenant-groups\\tenant-groups.controller.ts',
    'src\\platform\\security\\registry\\registry.controller.ts',
    'src\\platform\\platform.controller.ts',
    'src\\platform\\communication\\support\\support.controller.ts',
    'src\\pos\\pos.controller.ts',
    'src\\platform\\communication\\announcements\\announcements.controller.ts',
    'src\\inventory\\inventory.controller.ts',
    'src\\inventory-op\\purchase-orders\\purchase-orders.controller.ts',
    'src\\inventory\\vendors\\vendors.controller.ts',
    'src\\inventory\\inventory-op.controller.ts',
    'src\\inventory-op\\inventory-op.controller.ts',
    'src\\deals\\deals.controller.ts',
    'src\\customers\\customers.controller.ts',
    'src\\catalog\\catalog.controller.ts',
    'src\\ai\\ai-analytics.controller.ts',
    'src\\accounting\\accounting.controller.ts'
];

files.forEach(file => {
    const fullPath = path.resolve(__dirname, file);
    if (!fs.existsSync(fullPath)) {
        console.log(`File not found: ${fullPath}`);
        return;
    }
    let content = fs.readFileSync(fullPath, 'utf8');

    // Replace import
    let original = content;
    content = content.replace(/from\s+['"](.+)\/UserManagement\.decorator['"]/g, "from '$1/user.decorator'");
    content = content.replace(/RequestUserManagement/g, 'RequestUser');

    if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
    } else {
        console.log(`No changes for ${fullPath}`);
    }
});
