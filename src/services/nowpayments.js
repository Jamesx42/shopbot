// src/services/nowpayments.js
import { getConfig } from '../config.js';

function headers(env) {
  return {
    'x-api-key':    getConfig(env).NOWPAYMENTS_API_KEY,
    'Content-Type': 'application/json',
  };
}

function baseUrl(env) {
  return getConfig(env).NOWPAYMENTS_API_URL;
}

export async function createPayment(env, { priceUsd, payCurrency, depositId }) {
  const res = await fetch(`${baseUrl(env)}/payment`, {
    method:  'POST',
    headers: headers(env),
    body: JSON.stringify({
      price_amount:      priceUsd / 100,   // NOWPayments expects dollars
      price_currency:    'usd',
      pay_currency:      payCurrency,
      order_id:          depositId,
      order_description: 'Balance top-up',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NOWPayments error: ${err}`);
  }

  return res.json();
  // { payment_id, pay_address, pay_amount, pay_currency, ... }
}

export async function getPaymentStatus(env, paymentId) {
  const res = await fetch(`${baseUrl(env)}/payment/${paymentId}`, {
    headers: headers(env),
  });
  if (!res.ok) throw new Error('Failed to fetch payment status');
  return res.json();
}

export async function verifyWebhookSignature(env, payload, receivedSig) {
  const secret  = getConfig(env).NOWPAYMENTS_IPN_SECRET;
  const encoder = new TextEncoder();

  // Sort keys alphabetically (NOWPayments requirement)
  const sorted  = JSON.stringify(sortDeep(payload));

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(sorted));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === receivedSig;
}

function sortDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortDeep);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, k) => {
      acc[k] = sortDeep(obj[k]);
      return acc;
    }, {});
  }
  return obj;
}
