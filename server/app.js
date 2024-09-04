require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const port = 3000;

// Create a variable to store cookies
let cookies = null;

// Setup axios interceptors
axios.interceptors.request.use(config => {
    if (cookies) {
        config.headers.Cookie = cookies;
    }
    return config;
});

axios.interceptors.response.use(response => {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
        cookies = setCookieHeader.join(';');
    }
    return response;
});

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
            withCredentials: true,
            maxRedirects: 0, // Do not follow redirects
            validateStatus: status => status >= 200 && status < 400 // Accept all 2xx and 3xx statuses
        });

        console.log('Login response:', loginResponse.status, loginResponse.headers);

        if (cookies) {
            res.setHeader('Set-Cookie', cookies); // Forward cookies to the client
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
