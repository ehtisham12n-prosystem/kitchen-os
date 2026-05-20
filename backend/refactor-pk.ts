import { Project, SyntaxKind, PropertyDeclaration } from 'ts-morph';

const project = new Project({
    tsConfigFilePath: './tsconfig.json',
});

const entityFiles = project.getSourceFiles('src/**/*.entity.ts');

let count = 0;

for (const file of entityFiles) {
    const classes = file.getClasses();
    for (const cls of classes) {
        const properties = cls.getProperties();

        for (const prop of properties) {
            const hasPkDecorator = prop.getDecorator('PrimaryGeneratedColumn') || prop.getDecorator('PrimaryColumn');

            if (hasPkDecorator) {
                const propName = prop.getName();

                // If it's already 'id', skip
                if (propName === 'id') continue;

                // If it ends with '_id' or is some other custom key and isn't 'id'
                console.log(`Renaming ${propName} to id in ${cls.getName()}`);

                // Rename property using Language Service (this updates all references in the project)
                prop.rename('id');
                count++;

                // Now clean up the decorator arguments if they contain `name: '...'`
                // because we want the database column to also be 'id' by default
                const decorators = prop.getDecorators();
                for (const dec of decorators) {
                    const callExpr = dec.getCallExpression();
                    if (callExpr) {
                        const args = callExpr.getArguments();
                        if (args.length > 0) {
                            const firstArg = args[0];
                            if (firstArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
                                const objLiteral = firstArg.asKind(SyntaxKind.ObjectLiteralExpression);
                                if (objLiteral) {
                                    const nameProp = objLiteral.getProperty('name');
                                    if (nameProp) {
                                        nameProp.remove();
                                    }

                                    // If empty object, remove it entirely
                                    if (objLiteral.getProperties().length === 0) {
                                        callExpr.removeArgument(firstArg);
                                    }
                                }
                            } else if (firstArg.getKind() === SyntaxKind.StringLiteral) {
                                // e.g. @PrimaryGeneratedColumn('uuid')
                                // Don't remove this, it's just the type
                            }
                        }
                    }
                }
            }
        }
    }
}

console.log(`Renamed ${count} primary keys. Saving files...`);
project.saveSync();
console.log('Done.');
