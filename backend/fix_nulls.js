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

const controllers = getFiles(path.join(__dirname, 'src'), '.controller.ts');

controllers.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace user.client_id with user.client_id! or UserManagement.client_id!
    content = content.replace(/\((user|UserManagement)\.client_id([,\)])/g, "($1.client_id!$2");
    content = content.replace(/,\s*(user|UserManagement)\.client_id([,\)])/g, ", $1.client_id!$2");

    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
