const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const replacers = [
    { from: /MenuType/g, to: 'PriceProfile' },
    { from: /menu_type_id/g, to: 'price_profile_id' },
    { from: /menu_types/g, to: 'price_profiles' },
    { from: /menu_type/g, to: 'price_profile' },
    { from: /menu-type\.entity/g, to: 'price-profile.entity' },
    { from: /"Menu Type"/g, to: '"Price Profile"' },
    { from: /'Menu Type'/g, to: "'Price Profile'" }
];

walkDir('src', (filePath) => {
    if (filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        replacers.forEach(r => {
            content = content.replace(r.from, r.to);
        });

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated: ${filePath}`);
        }
    }
});
