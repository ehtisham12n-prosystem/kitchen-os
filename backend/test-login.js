if (process.env.ALLOW_LEGACY_DEV_HELPER !== 'true') {
    console.error('Legacy dev helper disabled. Use the documented release bootstrap/login flow instead.');
    console.error('To run this local-only helper intentionally, set ALLOW_LEGACY_DEV_HELPER=true and API_BASE_URL.');
    process.exit(1);
}

const apiBaseUrl = (process.env.API_BASE_URL || 'http://localhost:3000/v1').replace(/\/+$/, '');

async function testLogin() {
    try {
        const res = await fetch(`${apiBaseUrl}/auth/system-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'kashif', password: 'test1234' })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (err) {
        console.error(err);
    }
}
testLogin();
