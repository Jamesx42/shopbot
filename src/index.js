// src/index.js — Cloudflare Worker entry point
import { webhookCallback } from 'grammy';
import { connectDB }       from './db/client.js';
import { createBot }       from './bot/index.js';
import { handleNowPaymentsWebhook } from './webhooks/nowpayments.js';

let bot = null;
let handleUpdate = null;

async function init(env) {
  if (bot) return;
  await connectDB(env.MONGODB_URI);
  bot          = createBot(env);
  handleUpdate = webhookCallback(bot, 'cloudflare-mod');
}

export default {
  async fetch(request, env) {
    try {
      await init(env);
    } catch (err) {
      console.error('[INIT]', err.message);
      return new Response('Init failed', { status: 500 });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Telegram webhook
    if (path === '/webhook/telegram' && request.method === 'POST') {
      return handleUpdate(request);
    }

    // NOWPayments webhook
    if (path === '/webhook/nowpayments' && request.method === 'POST') {
      return handleNowPaymentsWebhook(request, env, bot);
    }

    return new Response('Not Found', { status: 404 });
  },
};
