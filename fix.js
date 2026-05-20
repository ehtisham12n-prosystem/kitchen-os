const fs = require('fs');
let lines = fs.readFileSync('d:/Antigravity/KitchenOS/frontend/src/pages/client-portal/UserEditor.tsx', 'utf8').split(/\r?\n/);
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('name="forcePasswordChange"') && lines[i-2] && lines[i-2].includes('styles.fullWidth')) {
        startIndex = i - 2;
        for (let j = i; j < lines.length; j++) {
            if (lines[j].includes('</section>')) {
                endIndex = j;
                break;
            }
        }
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    const posPinsCode = `                        </div>
                        
                        <div className={styles.sectionHeader} style={{ marginTop: '24px' }}>
                            <div className={styles.sectionTitleIcon}><Key size={20} /></div>
                            <div className={styles.sectionTitleText}>
                                <h3>POS Authorization Pins</h3>
                                <p>Set up Pins for sensitive POS operations. Available for users with Sale Return or Cancel Order permissions.</p>
                            </div>
                        </div>
                        <div className={styles.grid}>
                            <div className={styles.field}>
                                <label>Sale Return PIN</label>
                                <div className={styles.inputIconWrap}>
                                    <Key size={14} />
                                    <input type="text" name="posReturnPin" value={formData.posReturnPin} onChange={handleInputChange} className={styles.input} placeholder="e.g. 1234" maxLength={8} />
                                </div>
                            </div>
                            <div className={styles.field}>
                                <label>Cancel Order PIN</label>
                                <div className={styles.inputIconWrap}>
                                    <Key size={14} />
                                    <input type="text" name="posCancelPin" value={formData.posCancelPin} onChange={handleInputChange} className={styles.input} placeholder="e.g. 9876" maxLength={8} />
                                </div>
                            </div>
                        </div>
                    </section>`;
    lines.splice(startIndex, endIndex - startIndex + 1, posPinsCode);
    console.log('Replaced posPins block');
}

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// 7. Bank Account')) {
        lines.splice(i, 0, `        // POS Execution Pins\n        posReturnPin: '',\n        posCancelPin: '',\n`);
        console.log('Added posReturnPin to formData');
        break;
    }
}

fs.writeFileSync('d:/Antigravity/KitchenOS/frontend/src/pages/client-portal/UserEditor.tsx', lines.join('\\n'));
console.log('Done');
