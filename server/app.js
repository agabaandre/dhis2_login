require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Function to perform login and take screenshots
async function loginAndTakeScreenshots() {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, MAP_URL, BASE_URL, DEFAULT_DASHBOARD } = process.env;
    const dashUrl = `${DHIS2_DASHBOARD_URL.replace(/\/$/, '')}/${DEFAULT_DASHBOARD}`;
    const mapUrl = MAP_URL;

    try {
        console.log('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true, // Run in the background
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        console.log('Browser launched.');

        // Set desktop view size
        await page.setViewport({ width: 1920, height: 1080 });
        console.log('Set viewport to desktop width.');

        // Navigate to DHIS2 login page and clear cookies
        await page.goto(DHIS2_LOGIN_URL, { waitUntil: 'networkidle2' });

        // Delete existing cookies
        const cookies = await page.cookies();
        await Promise.all(cookies.map(async (cookie) => {
            await page.deleteCookie({ name: cookie.name });
        }));
        console.log('Cookies cleared.');

        // Log in
        await page.type('input[name=j_username]', DHIS2_USERNAME);
        await page.type('input[name=j_password]', DHIS2_PASSWORD);
        await page.click('input[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Take dashboard screenshot
        await page.goto(dashUrl, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(60000); // Wait 1 minute
        const dashboardScreenshotPath = path.join(__dirname, 'dashboard_screenshot.png');
        await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
        console.log('Dashboard screenshot saved.');

        // Take map screenshot
        await page.goto(mapUrl, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(60000); // Wait 1 minute
        const mapScreenshotPath = path.join(__dirname, 'map_screenshot.png');
        await page.screenshot({ path: mapScreenshotPath, fullPage: true });
        console.log('Map screenshot saved.');

        await browser.close();
        console.log('Browser closed.');

    } catch (error) {
        console.error('Error occurred:', error);
    }
}

// Set interval to take screenshots every 30 minutes
const THIRTY_MINUTES = 30 * 60 * 1000; // 30 minutes in milliseconds

setInterval(async () => {
    try {
        console.log('Starting automatic login and screenshot process...');
        await loginAndTakeScreenshots();
        console.log('Screenshots taken and saved.');
    } catch (error) {
        console.error('Error during automatic screenshot process:', error);
    }
}, THIRTY_MINUTES);

// Initial screenshot process when server starts
loginAndTakeScreenshots().then(() => {
    console.log('Initial screenshots taken and saved.');
}).catch((error) => {
    console.error('Error during the initial screenshot process:', error);
});
