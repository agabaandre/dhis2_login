require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const cors = require('cors');
const morgan = require('morgan'); // For logging requests
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const { CookieJar } = require('tough-cookie');

axiosCookieJarSupport(axios);

const app = express();
const port = 3000;
const cookieJar = new CookieJar();

app.use(cors({
    origin: process.env.FRONTEND_URL, // Ensure this matches exactly the client's origin
    credentials: true // Essential for cookies to be accepted on cross-origin requests
}));

app.use(express.json());
app.use(morgan('dev')); // Log requests to the console in 'dev' format

// Login route
app.post('/node_app/login', async (req, res) => {
    try {
        const credentials = {
            j_username: process.env.DHIS2_USERNAME,
            j_password: process.env.DHIS2_PASSWORD
        };

        const loginResponse = await axios.post(process.env.DHIS2_LOGIN_URL + 'dhis-web-commons/security/login.action', qs.stringify(credentials), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            jar: cookieJar,  // Use the cookie jar to store and send cookies
            withCredentials: true,
            maxRedirects: 0, // Do not follow redirects
            validateStatus: status => status >= 200 && status < 400 // Accept all 2xx and 3xx statuses
        });

        console.log('Login response:', loginResponse.status, loginResponse.headers);

        // Check if cookies are available and forward them correctly
        if (loginResponse.headers['set-cookie']) {
            // Parse and forward only the necessary cookies if specific handling is needed
            // Here we just forward all received cookies
            res.setHeader('Set-Cookie', loginResponse.headers['set-cookie']);
            res.json({
                message: 'Login successful',
                dashboardUrl: process.env.DHIS2_DASHBOARD_URL
            });
        } else {
            res.status(401).json({ message: 'Login failed' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
