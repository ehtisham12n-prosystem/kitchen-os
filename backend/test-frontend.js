const pw = require('playwright');

(async () => {
    try {
        const browser = await pw.chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('BROWSER ERROR:', msg.text());
            } else {
                console.log('BROWSER LOG:', msg.text());
            }
        });

        console.log('Navigating to login page...');
        await page.goto('http://localhost:5173/admin-login');

        console.log('Filling form...');
        await page.fill('input[type="text"]', 'kashif');
        await page.fill('input[type="password"]', 'test1234');

        console.log('Submitting login...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }).catch(e => console.log('Navigation timeout or error:', e.message)),
            page.click('button[type="submit"]')
        ]);

        // wait another second for react to render
        await page.waitForTimeout(2000);

        console.log('Checking current URL...');
        console.log('URL after login:', page.url());

        const bodyContent = await page.textContent('body');
        console.log('Body Text:', bodyContent.substring(0, 500));

        await browser.close();
    } catch (err) {
        console.error('Playwright script error:', err);
    }
})();
