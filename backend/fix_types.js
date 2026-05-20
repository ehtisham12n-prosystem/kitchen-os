const fs = require('fs');
const path = require('path');

function getFiles(dir, filter) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(fullPath, filter));
        } else {
            if (fullPath.endsWith(filter)) results.push(fullPath);
        }
    });
    return results;
}

const services = getFiles(path.join(__dirname, 'src'), '.service.ts');

services.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace clientId: number with clientId: string
    content = content.replace(/clientId:\s*number/g, 'clientId: string');
    content = content.replace(/client_id:\s*number/g, 'client_id: string');

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
