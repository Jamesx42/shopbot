# 🤖 Shopbot — Telegram Digital Product Bot

Telegram bot to sell digital products with crypto payments.

**Stack:** Grammy + MongoDB + NOWPayments + Cloudflare Workers

---

## ⚡ Quick Start

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Create your .env file
```bash
cp .env.example .env
```
Fill in all values in `.env`

### Step 3 — Run locally
```bash
node local.js
```
Open Telegram → find your bot → send `/start`

---

## 🚀 Deploy to Cloudflare

### Step 1 — Login to Cloudflare
```bash
npx wrangler login
```

### Step 2 — Set secrets
```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put MONGODB_URI
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
npx wrangler secret put ADMIN_IDS
npx wrangler secret put WEBHOOK_URL
```

### Step 3 — Deploy
```bash
npm run deploy
```
Copy your worker URL (shown after deploy):
`https://shopbot.yourname.workers.dev`

### Step 4 — Set Telegram webhook
Add your worker URL to .env as WEBHOOK_URL, then:
```bash
node setup-webhook.js
```

### Step 5 — Set NOWPayments IPN URL
In your NOWPayments dashboard → Settings → IPN:
```
https://shopbot.yourname.workers.dev/webhook/nowpayments
```

---

## 📦 Environment Variables

| Variable | Description |
|---|---|
| BOT_TOKEN | From @BotFather |
| MONGODB_URI | MongoDB Atlas connection string |
| NOWPAYMENTS_API_KEY | From NOWPayments dashboard |
| NOWPAYMENTS_IPN_SECRET | From NOWPayments IPN settings |
| ADMIN_IDS | Your Telegram user ID (from @userinfobot) |
| WEBHOOK_URL | Your Cloudflare Worker URL |

---

## 🤖 Bot Commands

| Command | Description |
|---|---|
| `/start` | Register & show main menu |
| `/admin` | Admin panel (admin only) |

---

## 📁 Project Structure

```
src/
├── index.js              # Cloudflare Worker entry
├── config.js             # Environment config
├── db/client.js          # MongoDB connection
├── collections/          # DB queries
│   ├── users.js
│   ├── products.js
│   ├── orders.js
│   ├── deposits.js
│   └── transactions.js
├── bot/
│   ├── index.js          # Grammy bot + all handlers
│   ├── middlewares.js    # User loader, admin guard
│   ├── helpers.js        # Keyboards, formatters
│   └── handlers/
│       ├── start.js
│       ├── shop.js
│       ├── balance.js
│       ├── orders.js
│       ├── deposit.js
│       └── admin.js
├── services/
│   ├── nowpayments.js    # NOWPayments API
│   └── balance.js        # Credit/debit logic
└── webhooks/
    └── nowpayments.js    # Payment confirmation
```
