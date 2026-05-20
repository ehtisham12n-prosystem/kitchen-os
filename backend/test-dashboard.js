if (process.env.ALLOW_LEGACY_DEV_HELPER !== 'true') {
    console.error('Legacy dev helper disabled. Use the documented release validation flow instead.');
    console.error('To run this local-only helper intentionally, set ALLOW_LEGACY_DEV_HELPER=true and API_BASE_URL.');
    process.exit(1);
}

const apiBaseUrl = (process.env.API_BASE_URL || 'http://localhost:3000/v1').replace(/\/+$/, '');

async function run() {
    const tokenReq = await fetch(`${apiBaseUrl}/auth/system-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'kashif', password: 'test1234' })
    });
    const tokenRes = await tokenReq.json();
    const token = tokenRes.access_token;

    console.log('Testing KPI endpoints with token');

    const req1 = await fetch(`${apiBaseUrl}/platform/dashboard/kpis`, { headers: { Authorization: 'Bearer ' + token } });
    console.log('KPIs:', req1.status, await req1.text());

    const req2 = await fetch(`${apiBaseUrl}/platform/dashboard/revenue-trend?months=6`, { headers: { Authorization: 'Bearer ' + token } });
    console.log('Revenue Trend:', req2.status, await req2.text());

    const req3 = await fetch(`${apiBaseUrl}/platform/dashboard/recent-activity?limit=5`, { headers: { Authorization: 'Bearer ' + token } });
    console.log('Recent Activity:', req3.status, await req3.text());
}
run();
