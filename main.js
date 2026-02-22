const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // executablePath: '/usr/bin/google-chrome-stable', // Often needed on Linux hosts
    }
});

const N8N_WEBHOOK_URL = 'https://n8n-deployment-1-ifpu.onrender.com/webhook/058e10c5-a47e-4b5e-b5d6-2c46ee209020';

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Client is ready!');
});

// When the client received QR-Code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR RECEIVED', qr);
});

// Message listener
client.on('message', async (msg) => {
    try {
        console.log(`Message received from ${msg.from}: ${msg.body}`);

        // Send payload to n8n
        const response = await axios.post(N8N_WEBHOOK_URL, {
            from: msg.from,
            body: msg.body,
            timestamp: msg.timestamp,
            notifyName: msg._data.notifyName || 'User'
        });

        // Debug: Log the response content
        console.log('n8n response data:', response.data);

        // Handle various n8n response formats
        let replyText = '';

        if (typeof response.data === 'string') {
            replyText = response.data;
        } else if (response.data) {
            // Check common keys used in n8n Respond to Webhook nodes
            replyText = response.data.reply ||
                response.data.output ||
                response.data.text ||
                response.data.response ||
                response.data.message;

            // If it's an array (sometimes n8n returns lists), take the first item's relevant field
            if (!replyText && Array.isArray(response.data) && response.data.length > 0) {
                const first = response.data[0];
                replyText = first.reply || first.output || first.text || (typeof first === 'string' ? first : '');
            }
        }

        if (replyText && replyText.trim() !== '') {
            await client.sendMessage(msg.from, replyText.trim());
            console.log(`Replied to ${msg.from}`);
        } else {
            console.log('No reply content found in n8n response.');
        }

    } catch (error) {
        if (error.response) {
            console.error(`Error sending to n8n (Status ${error.response.status}):`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error sending to n8n:', error.message);
        }
    }
});

// Start your client
client.initialize();

