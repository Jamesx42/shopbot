// local.js — Run locally with long polling (no webhook needed)
// Usage: node local.js

import http from 'http';
import { config } from 'dotenv';
config(); // loads .env file

import { connectDB } from './src/db/client.js';
import { createBot } from './src/bot/index.js';

const env = process.env;

console.log('🔌 Connecting to MongoDB...');
await connectDB(env.MONGODB_URI);

console.log('🤖 Starting bot in long polling mode...');
const bot = createBot(env);

// Long polling — Telegram sends updates to your bot directly
// No webhook URL or public server needed for local testing
await bot.start({
  onStart: () => console.log('✅ Bot is running locally! Open Telegram and send /start'),
});

http.createServer((req, res) => res.end('ok')).listen(process.env.PORT || 3000);
