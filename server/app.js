require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const cors = require('cors');
const morgan = require('morgan'); // For logging requests

const app = express();
const port = 3000;

// CORS configuration: adjust "origin" to match your client's URL
app.use(cors({
    origin: 'http://localhost:8080', // Change this to your client's actual URL
    credentials: true // This is crucial for cookies to be sent and received
}));

app.use(express.json());
app.use(morgan('dev')); // Log requests to the console

// Login route
app.post('/login', async (req, res) => {
    try {
        const credentials = {
            j_username: process.env.DHIS2_USERNAME,
            j_password: process.env.DHIS2_PASSWORD
        };

        // Make a POST request to the DHIS2 login action
        const loginResponse = await axios.post(`${process.env.DHIS2_LOGIN_URL}dhis-web-commons/security/login.action`, qs.stringify(credentials), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            withCredentials: true,
            maxRedirects: 0, // Do not follow redirects automatically
            validateStatus: status => status >= 200 && status < 400 // Accept all 2xx and 3xx statuses
        });

        console.log('Login response:', loginResponse.status, loginResponse.headers);

        // Check if the session cookie was set by DHIS2
        if (loginResponse.headers['set-cookie']) {
            // Forward the Set-Cookie header to the client
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
