// src/webhooks/nowpayments.js
import { verifyWebhookSignature } from '../services/nowpayments.js';
import { getDepositByNowPaymentId, updateDepositStatus } from '../collections/deposits.js';
import { credit } from '../services/balance.js';
import { getConfig } from '../config.js';

export async function handleNowPaymentsWebhook(request, env, bot) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  // Verify signature
  const sig     = request.headers.get('x-nowpayments-sig');
  const isValid = await verifyWebhookSignature(env, payload, sig);
  if (!isValid) {
    console.warn('[WEBHOOK] Invalid signature');
    return new Response('Unauthorized', { status: 401 });
  }

  const { payment_id, payment_status, order_id, outcome_amount } = payload;
  console.log(`[WEBHOOK] ${payment_id} → ${payment_status}`);

  const deposit = await getDepositByNowPaymentId(payment_id) ||
                  await getDepositByOrderId(order_id);

  if (!deposit) {
    return new Response('Deposit not found', { status: 404 });
  }

  // Prevent double processing
  if (deposit.status === 'finished') {
    return new Response('Already processed', { status: 200 });
  }

  if (payment_status === 'confirming' || payment_status === 'confirmed') {
    await updateDepositStatus(payment_id, 'confirming');

    // Notify user
    try {
      await bot.api.sendMessage(deposit.telegramId,
        `🔄 *Payment Detected!*\n\nYour payment is confirming on the blockchain. Balance will be credited shortly.`,
        { parse_mode: 'Markdown' }
      );
    } catch {}
  }

  else if (payment_status === 'finished') {
    const actualUsd = outcome_amount
      ? Math.floor(Number(outcome_amount) * 100)
      : deposit.priceUsd;

    await updateDepositStatus(payment_id, 'finished', actualUsd);

    // Credit balance
    const user = await credit(
      deposit.telegramId,
      actualUsd,
      `Crypto deposit (${deposit.payCurrency.toUpperCase()})`,
      deposit._id
    );

    // Notify user
    try {
      await bot.api.sendMessage(deposit.telegramId,
        `✅ *Balance Credited!*\n\n` +
        `💰 Amount: *$${(actualUsd / 100).toFixed(2)}*\n` +
        `💼 New Balance: *$${(user.balance / 100).toFixed(2)}*\n\n` +
        `You can now purchase products!`,
        { parse_mode: 'Markdown' }
      );
    } catch {}
  }

  else if (payment_status === 'expired' || payment_status === 'failed') {
    await updateDepositStatus(payment_id, payment_status);
  }

  return new Response('OK', { status: 200 });
}

async function getDepositByOrderId(orderId) {
  // Fallback: look up by our internal order_id (deposit _id)
  const { getDepositById } = await import('../collections/deposits.js');
  try { return getDepositById(orderId); } catch { return null; }
}
