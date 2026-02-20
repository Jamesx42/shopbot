// src/config.js
// Works for both local (.env) and Cloudflare Workers (wrangler secrets)

export function getConfig(env = {}) {
  const e = { ...process.env, ...env };
  return {
    BOT_TOKEN:              e.BOT_TOKEN,
    MONGODB_URI:            e.MONGODB_URI,
    NOWPAYMENTS_API_KEY:    e.NOWPAYMENTS_API_KEY,
    NOWPAYMENTS_IPN_SECRET: e.NOWPAYMENTS_IPN_SECRET,
    ADMIN_IDS:              (e.ADMIN_IDS || '').split(',').map(id => Number(id.trim())).filter(Boolean),
    WEBHOOK_URL:            e.WEBHOOK_URL || '',
    MIN_DEPOSIT_USD:        1,
    MAX_DEPOSIT_USD:        1000,
    PAYMENT_EXPIRY_MIN:     60,
    NOWPAYMENTS_API_URL:    'https://api.nowpayments.io/v1',
    SUPPORTED_CRYPTOS: [
      { ticker: 'btc',       name: 'Bitcoin',    emoji: '₿'  },
      { ticker: 'eth',       name: 'Ethereum',   emoji: 'Ξ'  },
      { ticker: 'usdttrc20', name: 'USDT TRC20', emoji: '💵' },
      { ticker: 'ltc',       name: 'Litecoin',   emoji: 'Ł'  },
    ],
  };
}
