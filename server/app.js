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

        console.log('Login and dashboard access successful.');

        // Take a screenshot of the dashboard
        const screenshotPath = path.join(__dirname, 'dashboard_screenshot.png');
        console.log(`Screenshot path: ${screenshotPath}`);

        try {
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved at ${screenshotPath}`);
        } catch (error) {
            console.error('Failed to save screenshot:', error);
        }

        // Get the session cookies from Puppeteer
        const newCookies = await page.cookies();

        // Send the cookies back to the client with the correct domain
        newCookies.forEach(cookie => {
            res.cookie(cookie.name, cookie.value, {
                domain: BASE_URL, // Set the correct domain
                path: cookie.path,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: 'None',
            });
        });

        // Get the final URL after login, this is the URL the iframe will use
        const dashboardUrl = page.url();

        // Close Puppeteer browser
        await browser.close();

        // Send the screenshot file and dashboard URL to the client
        res.sendFile(screenshotPath, () => {
            console.log('Screenshot sent to client');
            // Optionally, you can delete the screenshot file after sending
            // Commenting this line out to ensure the file is saved
            // fs.unlinkSync(screenshotPath);
        });

    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).send({ message: 'Login failed', error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
