const express = require('express');
const path = require('path');
const fs = require('fs');
const UAParser = require('ua-parser-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ YOUR SECRET PASSWORD
const ADMIN_PIN = '3266Jayson_!';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Data storage
const DATA_FILE = path.join(__dirname, 'messages.json');

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

function getMessages() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch {
        return [];
    }
}

function saveMessages(messages) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
}

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'Unknown';
}

function parseUserAgent(userAgent) {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    return {
        browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
        os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
        device: result.device.type || 'desktop',
        deviceModel: result.device.model || '',
        deviceVendor: result.device.vendor || ''
    };
}

// ============== ROUTES ==============

// Main page (send messages)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin login page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Verify password
app.post('/admin/verify', (req, res) => {
    const { pin } = req.body;
    if (pin === ADMIN_PIN) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// Admin dashboard
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: Submit a message
app.post('/api/send', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        const ip = getClientIP(req);
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const deviceInfo = parseUserAgent(userAgent);
        
        let location = { city: 'Unknown', region: 'Unknown', country: 'Unknown' };
        try {
            const fetch = (await import('node-fetch')).default;
            const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                location = {
                    city: geoData.city || 'Unknown',
                    region: geoData.regionName || 'Unknown',
                    country: geoData.country || 'Unknown'
                };
            }
        } catch (e) {
            console.log('Could not fetch location:', e.message);
        }

        const messageData = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            message: message.trim(),
            timestamp: new Date().toISOString(),
            metadata: {
                ip,
                userAgent,
                browser: deviceInfo.browser,
                os: deviceInfo.os,
                deviceType: deviceInfo.device,
                deviceModel: deviceInfo.deviceModel,
                deviceVendor: deviceInfo.deviceVendor,
                location,
                referer: req.headers['referer'] || 'Direct',
                language: req.headers['accept-language']?.split(',')[0] || 'Unknown'
            }
        };

        const messages = getMessages();
        messages.unshift(messageData);
        saveMessages(messages);

        res.json({ success: true, message: 'Message sent!' });
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// API: Get all messages
app.get('/api/messages', (req, res) => {
    const messages = getMessages();
    res.json(messages);
});

// API: Delete a message
app.delete('/api/messages/:id', (req, res) => {
    const { id } = req.params;
    let messages = getMessages();
    messages = messages.filter(m => m.id !== id);
    saveMessages(messages);
    res.json({ success: true });
});

// API: Clear all messages
app.delete('/api/messages', (req, res) => {
    saveMessages([]);
    res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║  🔥 NGL Clone Server Running!             ║
    ║                                           ║
    ║  📨 Share:  http://localhost:${PORT}         ║
    ║  🔐 Admin:  http://localhost:${PORT}/admin   ║
    ╚═══════════════════════════════════════════╝
    `);
});
