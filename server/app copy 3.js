require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
// Enable CORS for all routes
app.use(cors({ origin: process.env.DHIS2_LOGIN_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.post('/node_app/login', async (req, res) => {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, BASE_URL, DEFAULT_DASHBOARD } = process.env;

    try {
        // Check if the session cookie already exists on the client
        if (req.cookies.JSESSIONID) {
            console.log('Client has a session cookie. Verifying validity...');

            // Launch Puppeteer browser in headless mode (background)
            const browser = await puppeteer.launch({
                headless: true, // Use the latest headless mode for stability
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });

            const page = await browser.newPage();
            console.log('Browser launched for session validation.');

            // Set the JSESSIONID cookie in Puppeteer's page
            await page.setCookie({
                name: 'JSESSIONID',
                value: req.cookies.JSESSIONID,
                domain: new URL(DHIS2_DASHBOARD_URL).hostname, // Extract hostname dynamically
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax'
            });

            // Try to navigate to the dashboard URL
            const response = await page.goto(DHIS2_DASHBOARD_URL + DEFAULT_DASHBOARD, { waitUntil: 'networkidle2' });
            const urlAfterNavigation = page.url();
            if (urlAfterNavigation.includes('login.action')) {
                console.log('Failed to navigate to the dashboard URL.');
               // Close browser to retry login
            } else {
                const urlAfterNavigation = page.url();
                const statusCode = response.status();

                console.log(`Navigated to URL: ${urlAfterNavigation}, Status Code: ${statusCode}`);
                    // Send the dashboard URL to the client
                await browser.close();
                return res.send({ message: 'Already authenticated', dashboardUrl: urlAfterNavigation });
                
                
                }
            }
            else{

        console.log('No valid session found or session is invalid, proceeding with login.');

        // Launch Puppeteer browser in headless mode for login
            // Launch Puppeteer browser in headless mode (background)
            console.log('Launching Puppeteer...');
            const browser = await puppeteer.launch({
                headless: false, // Run in the background
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            console.log('Browser launched.');

            const authenticated = await page.goto(DHIS2_DASHBOARD_URL + DEFAULT_DASHBOARD, { waitUntil: 'networkidle2' });


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
            await page.goto(DHIS2_DASHBOARD_URL + DEFAULT_DASHBOARD, { waitUntil: 'networkidle2' });

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
    }

    } catch (error) {
        console.error('Login failed:', error);
        return res.status(500).send({ message: 'Login failed', error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
