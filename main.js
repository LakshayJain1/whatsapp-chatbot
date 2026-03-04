const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    }
});

const N8N_WEBHOOK_URL = 'https://n8n-deployment-1-ifpu.onrender.com/webhook/whatsapp-bot';

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Client is ready!');
});

// When the client received QR-Code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR RECEIVED', qr);
});

// Message listener (triggers for all messages, including ones sent by you)
client.on('message_create', async (msg) => {
    // ONLY respond in the "Message Yourself" chat for testing.
    // In the "Message Yourself" chat, the sender and receiver are the same.
    if (msg.to !== msg.from) {
        return;
    }

    // Prevent infinite loop in "Message Yourself" chat.
    // We append a hidden zero-width space to the bot's replies.
    // If a message ends with this invisible character, we know the bot sent it, so we ignore it.
    if (msg.body.endsWith('\u200B')) {
        return;
    }
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
            // Append a zero-width space to the reply so we can filter it out and avoid infinite loops
            await client.sendMessage(msg.from, replyText.trim() + '\u200B');
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

