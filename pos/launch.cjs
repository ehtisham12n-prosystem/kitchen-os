delete process.env.ELECTRON_RUN_AS_NODE;
process.env.NODE_ENV = 'development';
const { spawnSync } = require('child_process');
console.log('Clearing ELECTRON_RUN_AS_NODE and launching Electron CLI...');
const result = spawnSync('npx', ['electron', '.'], { stdio: 'inherit', shell: true });
process.exit(result.status || 0);
