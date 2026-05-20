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

const allTsFiles = getFiles(path.join(__dirname, 'src'), '.ts');

allTsFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Robust replacement for clientId/client_id types
    content = content.replace(/clientId\??:\s*number/g, (match) => match.replace('number', 'string'));
    content = content.replace(/client_id\??:\s*number/g, (match) => match.replace('number', 'string'));

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
