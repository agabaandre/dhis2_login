require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs'); // To save the file locally
const path = require('path');

const app = express();
// Enable CORS for all routes
app.use(cors({ origin: process.env.DHIS2_LOGIN_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

app.post('/node_app/login', async (req, res) => {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, EMS_URL, BASE_URL, DEFAULT_DASHBOARD } = process.env;
    const dashUrl = `${DHIS2_DASHBOARD_URL.replace(/\/$/, '')}/${DEFAULT_DASHBOARD}`;
    const mapUrl = `${EMS_URL}/dhis-web-maps/#/YVrdOLoeF0K`; // Correct string concatenation

    try {
        console.log('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        console.log('Browser launched.');
        await page.setViewport({ width: 1920, height: 1080 });
        console.log('Set viewport to desktop width.');

        // Login to DHIS2
        console.log(`Navigating to ${DHIS2_LOGIN_URL} to check and clear cookies...`);
        await page.goto(DHIS2_LOGIN_URL, { waitUntil: 'networkidle2' });

        // Clear cookies if necessary
        const cookies = await page.cookies(DHIS2_LOGIN_URL);
        if (cookies.length > 0) {
            await Promise.all(cookies.map(async (cookie) => {
                await page.deleteCookie({ name: 'JSESSIONID', domain: BASE_URL, path: '/' });
                await page.deleteCookie({ name: cookie.name, domain: cookie.domain, path: cookie.path });
            }));
            console.log('Cookies cleared.');
        }

        // Navigate to the login page and log in
        console.log('Filling in login form...');
        await page.type('input[name=j_username]', DHIS2_USERNAME);
        await page.type('input[name=j_password]', DHIS2_PASSWORD);
        await page.click('input[type="submit"][value="Sign in"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Navigate to the dashboard
        console.log('Navigating to the dashboard...');
        await page.goto(dashUrl, { waitUntil: 'networkidle2' });
        await autoScroll(page); // Scroll to ensure all content loads

        console.log('Taking dashboard screenshot...');
        const dashboardScreenshotPath = path.join(__dirname, 'dashboard_screenshot.png');
        await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
        console.log(`Dashboard screenshot saved at ${dashboardScreenshotPath}`);

        // Now, navigate to the full map URL and take a screenshot of the map
        console.log('Navigating to the full map page...');
        await page.goto(mapUrl, { waitUntil: 'networkidle2' });

        // Scroll down to ensure all map content is loaded
        await autoScroll(page);

        // Take the full map screenshot
        console.log('Taking map screenshot...');
        const mapScreenshotPath = path.join(__dirname, 'map_screenshot.png');
        await page.screenshot({ path: mapScreenshotPath, fullPage: true });
        console.log(`Full map screenshot saved at ${mapScreenshotPath}`);

        // Send the image paths as response (to be rendered at the root)
        res.json({
            dashboardImageUrl: `/dashboard_screenshot.png`,
            mapImageUrl: `/map_screenshot.png`
        });

        // Optionally close the browser
        await browser.close();

    } catch (error) {
        console.error('Error occurred:', error);
        res.status(500).send({ message: 'An error occurred', error: error.message });
    }
});

// Function to auto-scroll down the page
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
    });
}

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
