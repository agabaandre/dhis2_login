require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const cors = require('cors');
const morgan = require('morgan'); // Import morgan

const app = express();
const port = 3000;

app.use(cors({
    origin: process.env.DHIS2_LOGIN_URL, // Adjust according to your frontend URL
    credentials: true
}));

app.use(express.json());
app.use(morgan('dev')); // Log requests to the console in 'dev' format

// Login route
app.post('/login', async (req, res) => {
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

        if (loginResponse.headers['set-cookie']) {
            const dashboardUrl = process.env.DHIS2_DASHBOARD_URL;
            res.setHeader('Set-Cookie', loginResponse.headers['set-cookie']);
            res.json({
                message: 'Login successful',
                dashboardUrl: dashboardUrl
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
