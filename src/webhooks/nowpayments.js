// src/webhooks/nowpayments.js
import { verifyWebhookSignature } from '../services/nowpayments.js';
import { getDepositByNowPaymentId, updateDepositStatus, getDepositById } from '../collections/deposits.js';
import { credit } from '../services/balance.js';

// Simple in-memory rate limiter
const requestCounts = new Map();
function isRateLimited(ip) {
  const count = requestCounts.get(ip) || 0;
  if (count > 30) return true;
  requestCounts.set(ip, count + 1);
  setTimeout(() => requestCounts.delete(ip), 60000);
  return false;
}

export async function handleNowPaymentsWebhook(request, env, bot) {

  // Rate limiting
  const ip = request.ip || 'unknown';
  if (isRateLimited(ip)) {
    console.warn('[WEBHOOK] Rate limited:', ip);
    return new Response('Too Many Requests', { status: 429 });
  }

  // Parse body
  let payload;
  let rawBody;
  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('[WEBHOOK] Bad JSON:', err.message);
    return new Response('Bad JSON', { status: 400 });
  }

  console.log('[WEBHOOK] Payload:', JSON.stringify(payload));

  // ✅ Verify NOWPayments signature — blocks fake payment notifications
  const sig = request.headers.get('x-nowpayments-sig');
  if (!sig) {
    console.warn('[WEBHOOK] No signature header — rejecting');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const isValid = await verifyWebhookSignature(env, payload, sig);
    if (!isValid) {
      console.warn('[WEBHOOK] Invalid signature — rejecting fake request');
      return new Response('Unauthorized', { status: 401 });
    }
    console.log('[WEBHOOK] Signature valid ✅');
  } catch (err) {
    console.error('[WEBHOOK] Signature error:', err.message);
    return new Response('Signature error', { status: 401 });
  }

  const { payment_id, payment_status, order_id, outcome_amount } = payload;
  console.log(`[WEBHOOK] payment_id=${payment_id} status=${payment_status}`);

  // Find deposit
  let deposit = null;
  try {
    deposit = await getDepositByNowPaymentId(String(payment_id));
  } catch (err) {
    console.error('[WEBHOOK] Error finding by payment_id:', err.message);
  }

  if (!deposit && order_id) {
    try {
      deposit = await getDepositById(String(order_id));
    } catch (err) {
      console.error('[WEBHOOK] Error finding by order_id:', err.message);
    }
  }

  if (!deposit) {
    console.error('[WEBHOOK] Deposit not found! payment_id:', payment_id);
    return new Response('Not found', { status: 404 });
  }

  console.log('[WEBHOOK] Deposit found:', deposit._id, '| status:', deposit.status);

  // ✅ Idempotency — prevent double crediting (replay attack protection)
  if (deposit.status === 'finished') {
    console.log('[WEBHOOK] Already processed — ignoring');
    return new Response('Already processed', { status: 200 });
  }

  if (payment_status === 'confirming' || payment_status === 'confirmed') {
    await updateDepositStatus(String(payment_id), 'confirming');
    try {
      await bot.api.sendMessage(deposit.telegramId,
        `🔄 *Payment Detected!*\\n\\nConfirming on blockchain. Balance credited shortly.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[WEBHOOK] Notify error:', err.message);
    }
  }

  else if (payment_status === 'finished') {

    // ✅ Safe amount — don't credit more than what was requested
    const reportedUsd = outcome_amount
      ? Math.floor(Number(outcome_amount) * 100)
      : deposit.priceUsd;

    const actualUsd = Math.min(reportedUsd, deposit.priceUsd * 1.1); // allow max 10% tolerance
    console.log('[WEBHOOK] Crediting:', actualUsd, 'cents to user:', deposit.telegramId);

    await updateDepositStatus(String(payment_id), 'finished', actualUsd);

    const user = await credit(
      deposit.telegramId,
      actualUsd,
      `Crypto deposit (${deposit.payCurrency.toUpperCase()})`,
      deposit._id
    );

    console.log('[WEBHOOK] ✅ Balance credited! New balance:', user.balance);

    try {
      await bot.api.sendMessage(deposit.telegramId,
        `✅ *Balance Credited!*\\n\\n` +
        `💰 Amount: *$${(actualUsd / 100).toFixed(2)}*\\n` +
        `💼 New Balance: *$${(user.balance / 100).toFixed(2)}*\\n\\n` +
        `You can now purchase products!`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[WEBHOOK] Notify error:', err.message);
    }
  }

  else if (payment_status === 'expired' || payment_status === 'failed') {
    await updateDepositStatus(String(payment_id), payment_status);
  }

  return new Response('OK', { status: 200 });
}