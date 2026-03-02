// local.js — Works for both local dev and Railway production
import { config } from 'dotenv';
config();

import http          from 'http';
import { connectDB } from './src/db/client.js';
import { createBot } from './src/bot/index.js';
import { handleNowPaymentsWebhook } from './src/webhooks/nowpayments.js';

const env  = process.env;
const PORT = env.PORT || 3000;

console.log('🔌 Connecting to MongoDB...');
await connectDB(env.MONGODB_URI);
console.log('✅ MongoDB connected');

const bot = createBot(env);

// Webhook mode (Railway) or long polling (local)
if (env.WEBHOOK_URL) {
  await bot.api.setWebhook(`${env.WEBHOOK_URL}/webhook/telegram`);
  console.log(`✅ Webhook set: ${env.WEBHOOK_URL}/webhook/telegram`);
} else {
  bot.start({ onStart: () => console.log('✅ Bot running locally!') });
}

// HTTP server
const server = http.createServer(async (req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Telegram webhook
  if (req.url === '/webhook/telegram' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        await bot.handleUpdate(JSON.parse(body));
        res.writeHead(200);
        res.end('OK');
      } catch (err) {
        console.error('[TELEGRAM]', err.message);
        res.writeHead(500);
        res.end('Error');
      }
    });
    return;
  }

  // NOWPayments webhook
  if (req.url === '/webhook/nowpayments' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        console.log('[NOWPAYMENTS] Webhook received, body length:', body.length);
        const fakeReq = {
          text:    async () => body,
          json:    async () => JSON.parse(body),
          headers: { get: (key) => req.headers[key.toLowerCase()] },
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

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));