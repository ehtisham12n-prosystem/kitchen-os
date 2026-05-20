import * as fs from 'fs';
import * as path from 'path';

const docsDir = path.join(__dirname, '..', 'docs');

const adr1File = path.join(docsDir, 'ADR-01-naming-conventions.md');
if (fs.existsSync(adr1File)) {
    let content = fs.readFileSync(adr1File, 'utf8');
    content = content.replace(
        /### Primary Keys[\s\S]*?### Standard Columns/g,
        "### Primary Keys\nEvery primary key must be simply named `id`. Prefixing primary keys (like `client_id`, `branch_id`) is strictly banned for the primary key column itself. Foreign keys should still retain the prefix (e.g., `client_id`, `branch_id`).\n\n### Standard Columns"
    );
    // Remove the line "The generic `id` or `name` columns are fully banned"
    content = content.replace("The generic `id` or `name` columns are fully banned", "The generic `name` columns are fully banned");
    fs.writeFileSync(adr1File, content);
}

const dbDocFile = path.join(docsDir, '02-database-schema.md');
if (fs.existsSync(dbDocFile)) {
    let content = fs.readFileSync(dbDocFile, 'utf8');
    const replacements = [
        ['- `client_id` (PK, Auto Increment)', '- `id` (PK, Auto Increment)'],
        ['- `user_id`', '- `id`'],
        ['- `plan_id`', '- `id`'],
        ['- `branch_id` (PK)', '- `id` (PK)'],
        ['- `user_id` (PK)', '- `id` (PK)'],
        ['- `role_id` (PK)', '- `id` (PK)'],
        ['- `product_id`, `client_id`, `category_id`', '- `id`, `client_id`, `category_id`'],
        ['- `config_id`, `product_id`', '- `id`, `product_id`'],
        ['- `order_id` (UUID generated on POS perfectly to avoid offline clashes)', '- `id` (UUID generated on POS perfectly to avoid offline clashes)'],
        ['- `order_item_id`, `order_id`', '- `id`, `order_id`'],
        ['- `account_id`, `client_id`', '- `id`, `client_id`'],
        ['- `ledger_id`, `client_id`', '- `id`, `client_id`'],
        ['- `log_id`, `client_id`', '- `id`, `client_id`']
    ];

    for (const [oldVal, newVal] of replacements) {
        content = content.replace(oldVal, newVal);
    }
    fs.writeFileSync(dbDocFile, content);
}

console.log("Docs updated successfully.");
