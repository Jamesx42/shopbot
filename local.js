import { config } from 'dotenv';
config();

import http from 'http';
import { connectDB } from './src/db/client.js';
import { createBot } from './src/bot/index.js';
import { handleNowPaymentsWebhook } from './src/webhooks/nowpayments.js';

const env = process.env;
const PORT = env.PORT || 3000;

// 1. Connect DB
console.log('🔌 Connecting to MongoDB...');
await connectDB(env.MONGODB_URI);
console.log('✅ MongoDB connected');

// 2. Create bot
const bot = createBot(env);

// 3. Delete any existing webhook — ensure long polling works cleanly
await bot.api.deleteWebhook();
console.log('✅ Webhook deleted — using long polling');

// 4. Start long polling for Telegram (keeps process alive)
bot.start({ onStart: () => console.log('✅ Bot running!') });

// 5. HTTP server — only for NOWPayments webhook
const server = http.createServer(async (req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // NOWPayments webhook
  if (req.url === '/webhook/nowpayments' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        console.log('[NOWPAYMENTS] Webhook received');
        const fakeReq = {
          text: async () => body,
          json: async () => JSON.parse(body),
          headers: { get: (k) => req.headers[k.toLowerCase()] },
        };
        const response = await handleNowPaymentsWebhook(fakeReq, env, bot);
        const text = await response.text();
        console.log('[NOWPAYMENTS] Response:', response.status, text);
        res.writeHead(response.status || 200);
        res.end(text);
      } catch (err) {
        console.error('[NOWPAYMENTS] Error:', err.message);
        res.writeHead(500);
        res.end('Error');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => console.log(`🚀 HTTP server running on port ${PORT}`));