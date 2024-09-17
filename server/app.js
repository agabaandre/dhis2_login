require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Enable CORS for your frontend domain (replace BASE_URL with your actual frontend domain)
app.use(cors({ origin: process.env.BASE_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

/**
 * Puppeteer function to login and fetch the session cookies
 */
async function loginToDashboard() {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL } = process.env;

    try {
        // Launch Puppeteer browser
        const browser = await puppeteer.launch({
            headless: true, // Run in background mode
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        // Navigate to the login page
        await page.goto(DHIS2_LOGIN_URL, { waitUntil: 'networkidle2' });

        // Fill in the login form
        await page.type('input[name=j_username]', DHIS2_USERNAME);
        await page.type('input[name=j_password]', DHIS2_PASSWORD);

        // Submit the form and wait for navigation
        await page.click('input[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Get the cookies after login
        const cookies = await page.cookies();

        // Close the browser
        await browser.close();

        return cookies;
    } catch (error) {
        console.error('Login to dashboard failed:', error);
        throw new Error('Login failed');
    }
}

/**
 * Proxy route to fetch authenticated dashboard content
 */
app.get('/node_app/proxy-dashboard', async (req, res) => {
    const { DHIS2_DASHBOARD_URL } = process.env;

    try {
        // Login to the dashboard and get the session cookies
        const cookies = await loginToDashboard();

        // Launch Puppeteer to fetch the dashboard content using the cookies
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        // Set the session cookies
        await page.setCookie(...cookies);

        // Navigate to the dashboard URL
        await page.goto(DHIS2_DASHBOARD_URL, { waitUntil: 'networkidle2' });

        // Get the dashboard content (HTML)
        const content = await page.content();

        // Close the browser
        await browser.close();

        // Send the content to the client
        res.send(content);
    } catch (error) {
        console.error('Failed to fetch authenticated dashboard content:', error.message);
        res.status(500).send({
            message: 'Failed to fetch authenticated dashboard content',
            error: error.message,
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
