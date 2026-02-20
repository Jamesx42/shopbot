// setup-webhook.js — Run after deploying to Cloudflare
// Usage: node setup-webhook.js

import { config } from 'dotenv';
config();

const BOT_TOKEN  = process.env.BOT_TOKEN;
const WORKER_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN || !WORKER_URL) {
  console.error('❌ BOT_TOKEN and WEBHOOK_URL must be set in .env');
  process.exit(1);
}

const webhookUrl = `${WORKER_URL}/webhook/telegram`;

const res  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({
    url:                  webhookUrl,
    allowed_updates:      ['message', 'callback_query'],
    drop_pending_updates: true,
  }),
});

const data = await res.json();

if (data.ok) {
  console.log(`✅ Webhook set successfully!`);
  console.log(`   URL: ${webhookUrl}`);
} else {
  console.error(`❌ Failed: ${data.description}`);
}
