// src/index.js — Cloudflare Worker entry point
import { webhookCallback } from 'grammy';
import { connectDB }       from './db/client.js';
import { createBot }       from './bot/index.js';
import { handleNowPaymentsWebhook } from './webhooks/nowpayments.js';

let bot          = null;
let handleUpdate = null;
let dbConnected  = false;

async function init(env) {
  // Create bot always (no DB needed for this)
  if (!bot) {
    bot          = createBot(env);
    handleUpdate = webhookCallback(bot, 'cloudflare-mod');
  }

  // Try DB separately — don't block if it fails
  if (!dbConnected) {
    try {
      await connectDB(env.MONGODB_URI);
      dbConnected = true;
    } catch (err) {
      console.error('[DB]', err.message);
    }
  }
}

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    // Health check — no DB needed
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, db: dbConnected }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Init bot + attempt DB
    await init(env);

    // Telegram webhook
    if (path === '/webhook/telegram' && request.method === 'POST') {
      if (!dbConnected) {
        return new Response('DB not connected', { status: 503 });
      }
      return handleUpdate(request);
    }

    // NOWPayments webhook
    if (path === '/webhook/nowpayments' && request.method === 'POST') {
      if (!dbConnected) {
        return new Response('DB not connected', { status: 503 });
      }
      return handleNowPaymentsWebhook(request, env, bot);
    }

    return new Response('Not Found', { status: 404 });
  },
};