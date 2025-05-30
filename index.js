const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');

const app = express();
const PORT = 3000;
const VALID_TOKEN = '12345678';

let currentQR = null;
let isClientReady = false;

app.use(cors());
app.use(express.json());

// WhatsApp client setup
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'whatsapp-session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// QR Code received
client.on('qr', async (qr) => {
  console.log('📸 New QR Code received');
  isClientReady = false;
  currentQR = await qrcode.toDataURL(qr);
});

// WhatsApp is ready
client.on('ready', () => {
  console.log('✅ WhatsApp client is ready!');
  isClientReady = true;
  currentQR = null; // No QR needed anymore
});

// Authentication failed
client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
  isClientReady = false;
});

// Disconnected
client.on('disconnected', (reason) => {
  console.log('🔌 WhatsApp disconnected:', reason);
  isClientReady = false;
});

client.initialize();


// === Login Route ===
app.post('/login', (req, res) => {
  const { token } = req.body;
  if (token === VALID_TOKEN) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: 'Invalid token' });
});


// === Get QR Route ===
app.get('/qr', (req, res) => {
  const token = req.headers.authorization;
  if (token !== VALID_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (isClientReady) {
    return res.json({ status: 'authenticated' });
  }

  if (currentQR) {
    return res.json({ qr: currentQR });
  }

  res.status(503).json({ error: 'QR not ready yet' });
});


// === Regenerate QR ===
app.get('/regenerate-qr', async (req, res) => {
  const token = req.headers.authorization;
  if (token !== VALID_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await client.destroy();
    currentQR = null;
    isClientReady = false;
    await client.initialize();
    res.json({ success: true, message: 'QR regenerated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// === Send Message ===
app.post('/send-message', async (req, res) => {
  const token = req.headers.authorization;
  if (token !== VALID_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isClientReady) {
    return res.status(503).json({ error: 'WhatsApp client not ready' });
  }

  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: 'Number and message are required.' });
  }

  const numbers = Array.isArray(number) ? number : [number];
  const results = [];

  for (let raw of numbers) {
    let cleaned = raw.replace(/[^\d]/g, '');

    if (!cleaned.startsWith('91')) {
      cleaned = '91' + cleaned;
    }

    const chatId = `${cleaned}@c.us`;

    try {
      const isRegistered = await client.isRegisteredUser(chatId);
      if (!isRegistered) {
        results.push({ number: cleaned, status: 'failed', error: 'Not a WhatsApp number' });
        continue;
      }

      await client.sendMessage(chatId, message);
      results.push({ number: cleaned, status: 'sent' });

    } catch (err) {
      results.push({ number: cleaned, status: 'failed', error: err.message });
    }
  }

  res.json({ results });
});


// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
