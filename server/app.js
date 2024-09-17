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
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, BASE_URL, DEFAULT_DASHBOARD } = process.env;
    const dashUrl = `${DHIS2_DASHBOARD_URL.replace(/\/$/, '')}/${DEFAULT_DASHBOARD}`;

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
        console.log('Scrolling down the page to ensure all content is loaded...');
        await autoScroll(page);

        // Scroll back to the top of the page
        console.log('Scrolling back to the top...');
        await page.evaluate(() => window.scrollTo(0, 0));

        // Set viewport height based on the page content's height to ensure all content is captured
        const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
        await page.setViewport({ width: 1920, height: bodyHeight });
        console.log(`Viewport height adjusted to: ${bodyHeight}px`);

        // Function to take and save a full-page screenshot
        const screenshotPath = path.join(__dirname, 'dashboard_screenshot.png');

        async function takeScreenshot() {
            try {
                // Take a full-page screenshot (automatic height based on page content)
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`Full-page screenshot saved at ${screenshotPath}`);
                // Send the screenshot file to the client
                res.sendFile(screenshotPath, () => {
                    console.log('Screenshot sent to client');
                    // Optionally delete the screenshot after sending
                    // fs.unlinkSync(screenshotPath);
                });
            } catch (error) {
                console.error('Failed to save screenshot:', error);
            }
        }

        // Wait for 2 minutes to ensure all content is loaded
        console.log('Waiting for 2 minutes to ensure the dashboard is fully loaded...');
        await page.waitForTimeout(120000); // Wait for 2 minutes (120,000 milliseconds)

        // Scroll down and ensure all content is loaded
        await autoScroll(page);

        // Scroll back up and take a screenshot
        console.log('Taking screenshot...');
        await takeScreenshot();

        // Set an interval to take a screenshot every 5 minutes (300,000 milliseconds)
        setInterval(async () => {
            console.log('Taking screenshot every 5 minutes...');
            await takeScreenshot();
        }, 300000); // 300,000 ms = 5 minutes

    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).send({ message: 'Login failed', error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
