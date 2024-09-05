require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Enable CORS for all routes, using the DHIS2_LOGIN_URL from environment variables
app.use(cors({ origin: process.env.DHIS2_LOGIN_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.post('/node_app/login', async (req, res) => {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, BASE_URL, DEFAULT_DASHBOARD } = process.env;
    const fullUrl = `${DHIS2_LOGIN_URL}${DEFAULT_DASHBOARD}`;

    try {
        // Log environment settings for debugging purposes
        console.log(`DHIS2_LOGIN_URL: ${DHIS2_LOGIN_URL}`);
        console.log(`Navigating to: ${fullUrl}`);

        // Launch Puppeteer browser with enhanced settings to avoid bot detection
        console.log('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true, // Run in the background
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            defaultViewport: null // Use full-screen as a regular user would
        });

        const page = await browser.newPage();

        // Set user agent and headers to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9'
        });

        console.log('Browser launched. Navigating to the DHIS2 login page...');

        // Navigate to the DHIS2 login page
        await page.goto(`${DHIS2_LOGIN_URL}${DEFAULT_DASHBOARD}`, { waitUntil: 'networkidle2' });

        // Fill the login form
        console.log('Filling in login form...');
        await page.type('input[name=j_username]', DHIS2_USERNAME);
        await page.type('input[name=j_password]', DHIS2_PASSWORD);

        // Submit the login form
        console.log('Submitting login form...');
        await page.click('input[type="submit"][value="Sign in"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Check the current page to ensure successful login
        const currentUrl = page.url();
        console.log(`Current page URL after login: ${currentUrl}`);

        // Debugging: Log page content to see if the login succeeded
        const pageContent = await page.content();
        if (pageContent.includes('Login failed') || currentUrl.includes('login')) {
            throw new Error('Login failed, staying on login page.');
        }

        // Navigate to the dashboard to verify successful login
        console.log('Navigating to the dashboard...');
        await page.goto(fullUrl, { waitUntil: 'networkidle2' });

        // Get the session cookies from Puppeteer
        const cookies = await page.cookies();
        console.log('Session cookies:', cookies);

        // Send the cookies back to the client with the correct domain
        cookies.forEach(cookie => {
            res.cookie(cookie.name, cookie.value, {
                domain: BASE_URL, // Use correct domain for your environment
                path: cookie.path,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: 'Lax'
            });
        });

        // Get the final URL after login
        const dashboardUrl = page.url();

        console.log('Login and dashboard access successful.');
        console.log(`Dashboard URL: ${dashboardUrl}`);

        // Close Puppeteer browser
        await browser.close();

        // Send the dashboard URL to the client
        res.send({ message: 'Login successful', dashboardUrl });

    } catch (error) {
        // Enhanced error logging
        console.error('Login failed:', error.message);
        console.log(error.stack);

        // Respond with detailed error message
        res.status(500).send({ message: 'Login failed', error: error.message });
    }
});

// Start the Express server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
