require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
// Enable CORS for all routes
//Change to the DHIS2_LOGIN_URL if not testing on local host
app.use(cors({ origin: process.env.DHIS2_LOGIN_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.post('/login', async (req, res) => {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, BASE_URL } = process.env;

    try {
        // Launch Puppeteer browser in headless mode (background)
        console.log('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true, // Run in the background
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        console.log('Browser launched.');

        // Navigate to the DHIS2 login page
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
        await page.goto(DHIS2_DASHBOARD_URL, { waitUntil: 'networkidle2' });

        console.log('Login and dashboard access successful.');

        // Get the session cookies from Puppeteer
        const cookies = await page.cookies();

        // Send the cookies back to the client with the correct domain
        cookies.forEach(cookie => {
            res.cookie(cookie.name, cookie.value, {
                domain: BASE_URL, // Set the correct domain
                path: cookie.path,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: 'Lax'
            });
        });

        // Get the final URL after login, this is the URL the iframe will use
        const dashboardUrl = page.url();

        // Close Puppeteer browser
        await browser.close();

        // Send the dashboard URL to the client
        res.send({ message: 'Login successful', dashboardUrl });

    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).send({ message: 'Login failed', error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
