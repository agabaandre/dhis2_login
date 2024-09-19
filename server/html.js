require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs'); // To save files locally
const path = require('path');
const axios = require('axios'); // To download CSS and JS files

const app = express();
// Enable CORS for all routes
app.use(cors({ origin: process.env.DHIS2_LOGIN_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Function to ensure directory exists
function ensureDirectoryExistence(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Directory created: ${dirPath}`);
    }
}

// Function to download CSS and JS files
async function downloadFile(url, savePath) {
    try {
        const response = await axios.get(url);

        // Ensure the directory exists before writing the file
        const dir = path.dirname(savePath);
        ensureDirectoryExistence(dir);

        // Write the file
        fs.writeFileSync(savePath, response.data);
        console.log(`File downloaded to ${savePath}`);
    } catch (error) {
        console.error(`Error downloading file from ${url}:`, error);
    }
}

// Function to scrape the DHIS2 dashboard and map
async function scrapePages() {
    const { DHIS2_USERNAME, DHIS2_PASSWORD, DHIS2_LOGIN_URL, DHIS2_DASHBOARD_URL, MAP_URL, BASE_URL, DEFAULT_DASHBOARD } = process.env;
    const dashUrl = `${DHIS2_DASHBOARD_URL.replace(/\/$/, '')}/${DEFAULT_DASHBOARD}`;
    const mapUrl = MAP_URL;

    try {
        console.log('Launching Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        console.log('Browser launched.');

        // Set viewport size
        await page.setViewport({ width: 1920, height: 1080 });

        // Go to the base URL and clear cookies
        await page.goto(DHIS2_LOGIN_URL, { waitUntil: 'networkidle2' });

        // Delete existing cookies
        const cookies = await page.cookies();
        await Promise.all(cookies.map(async (cookie) => {
            await page.deleteCookie({ name: cookie.name });
        }));
        console.log('Cookies cleared.');

        // Log in to DHIS2
        await page.type('input[name=j_username]', DHIS2_USERNAME);
        await page.type('input[name=j_password]', DHIS2_PASSWORD);
        await page.click('input[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Scrape dashboard page
        console.log('Navigating to dashboard...');
        await page.goto(dashUrl, { waitUntil: 'networkidle2' });

        // Wait for dynamic content to fully load
        await page.waitForTimeout(180000); // 3 minutes

        // Remove unwanted elements (header, navigation bar, etc.)
        await page.evaluate(() => {
            const header = document.querySelector('header');
            if (header) header.remove();

            const nav = document.querySelector('.DashboardsBar_bar__0l1F7');
            if (nav) nav.remove();
        });

        // Get the HTML content of the page
        const dashboardHTML = await page.content();

        // Find and download CSS and JS files
        const cssLinks = await page.$$eval('link[rel="stylesheet"]', links => links.map(link => link.href));
        const jsLinks = await page.$$eval('script[src]', scripts => scripts.map(script => script.src));

        for (const link of cssLinks) {
            const cssFileName = path.basename(link);
            const cssFilePath = path.join(__dirname, 'dashboard_css', cssFileName);
            await downloadFile(link, cssFilePath);
        }

        for (const jsLink of jsLinks) {
            const jsFileName = path.basename(jsLink);
            const jsFilePath = path.join(__dirname, 'dashboard_js', jsFileName);
            await downloadFile(jsLink, jsFilePath);
        }

        // Save the dashboard HTML
        const dashboardHTMLPath = path.join(__dirname, 'dashboard.html');
        fs.writeFileSync(dashboardHTMLPath, dashboardHTML);
        console.log(`Dashboard HTML saved to ${dashboardHTMLPath}`);

        // Scrape map page
        console.log('Navigating to map...');
        await page.goto(mapUrl, { waitUntil: 'networkidle2' });

        // Wait for the map page's dynamic content to fully load
        await page.waitForTimeout(180000); // 3 minutes

        // Remove unwanted elements from the map page
        await page.evaluate(() => {
            const header = document.querySelector('header');
            if (header) header.remove();

            const nav = document.querySelector('.DashboardsBar_bar__0l1F7');
            if (nav) nav.remove();
        });

        // Get the HTML content of the map page
        const mapHTML = await page.content();

        // Find and download CSS and JS files for the map page
        const mapCssLinks = await page.$$eval('link[rel="stylesheet"]', links => links.map(link => link.href));
        const mapJsLinks = await page.$$eval('script[src]', scripts => scripts.map(script => script.src));

        for (const link of mapCssLinks) {
            const cssFileName = path.basename(link);
            const cssFilePath = path.join(__dirname, 'map_css', cssFileName);
            await downloadFile(link, cssFilePath);
        }

        for (const jsLink of mapJsLinks) {
            const jsFileName = path.basename(jsLink);
            const jsFilePath = path.join(__dirname, 'map_js', jsFileName);
            await downloadFile(jsLink, jsFilePath);
        }

        // Save the map HTML
        const mapHTMLPath = path.join(__dirname, 'map.html');
        fs.writeFileSync(mapHTMLPath, mapHTML);
        console.log(`Map HTML saved to ${mapHTMLPath}`);

        // Close the browser
        await browser.close();

        console.log('Scraping completed successfully.');

    } catch (error) {
        console.error('Error occurred during scraping:', error);
    }
}
scrapePages();
// Schedule the scraping task to run every 30 minutes
setInterval(scrapePages, 1800000); // 12 seconds for testing (change to 1800000 for 30 minutes)

// Start the server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
