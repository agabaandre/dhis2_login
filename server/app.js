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

app.post('/node_app/login', async (req, res) => {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, EMS_URL, BASE_URL, DEFAULT_DASHBOARD } = process.env;
    const dashUrl = `${DHIS2_DASHBOARD_URL.replace(/\/$/, '')}/${DEFAULT_DASHBOARD}`;
    const mapUrl = `${EMS_URL}/dhis-web-maps/#/YVrdOLoeF0K`; // Full map URL

    try {
        // Launch Puppeteer browser in headless mode (background)
        console.log('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true, // Run in the background
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        console.log('Browser launched.');

        // Set viewport width to desktop size, but the height will be dynamically set later
        await page.setViewport({ width: 1920, height: 1080 });
        console.log('Set viewport to desktop width.');

        // Go to the base URL to check for existing cookies
        console.log(`Navigating to ${DHIS2_LOGIN_URL} to check and clear cookies...`);
        await page.goto(DHIS2_LOGIN_URL, { waitUntil: 'networkidle2' });

        // Retrieve and delete existing cookies
        const cookies = await page.cookies(DHIS2_LOGIN_URL);
        console.log('Cookies to clear:', cookies);

        if (cookies.length > 0) {
            await Promise.all(cookies.map(async (cookie) => {
                console.log(`Deleting cookie: ${cookie.name}`);
                await page.deleteCookie({ name: 'JSESSIONID', domain: BASE_URL, path: '/' });
                await page.deleteCookie({ name: cookie.name, domain: cookie.domain, path: cookie.path });
            }));
            console.log('Cookies cleared.');
        } else {
            console.log('No cookies to clear.');
        }

        // Navigate to the DHIS2 login page
        console.log('Navigating to login page...');
        await page.goto(DHIS2_LOGIN_URL, { waitUntil: 'networkidle2' });

        // Fill the login form
        console.log('Filling in login form...');
        await page.type('input[name=j_username]', DHIS2_USERNAME);
        await page.type('input[name=j_password]', DHIS2_PASSWORD);

        // Submit the login form
        console.log('Submitting login form...');
        await page.click('input[type="submit"][value="Sign in"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Check if login was successful by navigating to the dashboard
        console.log('Navigating to the dashboard...');
        await page.goto(dashUrl, { waitUntil: 'networkidle2' });

        // Scroll the page to ensure all content is loaded
        async function autoScroll(page) {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100; // Scroll by 100px each step
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 200); // Wait 200ms between scrolls to allow content to load
                });
            });
        }

        // Scroll down the page to make sure all contents are loaded
        console.log('Scrolling down the dashboard page...');
        await autoScroll(page);

        // Scroll back to the top of the page
        console.log('Scrolling back to the top...');
        await page.evaluate(() => window.scrollTo(0, 0));

        // Remove unwanted elements before taking a screenshot (applies to both dashboard and map)
        await page.evaluate(() => {
            const header = document.querySelector('header'); // Adjust this selector as needed
            if (header) {
                header.remove(); // Remove the header element from the DOM
            }

            const nav = document.querySelector('.DashboardsBar_bar__0l1F7'); // Adjust this selector as needed
            if (nav) {
                nav.remove(); // Remove the nav element from the DOM
            }
        });
        console.log('Header and navigation removed.');

        // Set viewport height based on the page content's height
        const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.setViewport({ width: 1920, height: 2200 });
        console.log(`Viewport height adjusted to: ${bodyHeight}px`);

        // Take dashboard screenshot
        const dashboardScreenshotPath = path.join(__dirname, 'dashboard_screenshot.png');
        console.log('Taking dashboard screenshot...');
        await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
        console.log(`Dashboard screenshot saved at ${dashboardScreenshotPath}`);

        // Now, navigate to the map URL and take a screenshot of the map
        console.log('Navigating to the map page...');
        await page.goto(mapUrl, { waitUntil: 'networkidle2' });

        // Scroll down the map page to ensure all content is loaded
        console.log('Scrolling down the map page...');
        await autoScroll(page);

        // Remove unwanted elements from the map page
        await page.evaluate(() => {
            const header = document.querySelector('header'); // Adjust the selector for the map page
            if (header) {
                header.remove(); // Remove the header element from the DOM
            }

            const nav = document.querySelector('.DashboardsBar_bar__0l1F7'); // Adjust this selector for the map page
            if (nav) {
                nav.remove(); // Remove the nav element from the DOM
            }
        });
        console.log('Unwanted elements removed from the map.');

        // Take the full map screenshot
        const mapScreenshotPath = path.join(__dirname, 'map_screenshot.png');
        console.log('Taking map screenshot...');
        await page.screenshot({ path: mapScreenshotPath, fullPage: true });
        console.log(`Map screenshot saved at ${mapScreenshotPath}`);

        // Send both screenshots back to the client
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

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
