// src/bot/index.js
import { Bot } from 'grammy';
import { userMiddleware, adminMiddleware } from './middlewares.js';
import {
  requestRechargeHandler,
  confirmRechargeHandler,
  adminRechargeCompleteHandler,
} from './handlers/recharge.js';
import { startHandler } from './handlers/start.js';
import { shopHandler, productHandler, buyHandler, confirmBuyHandler } from './handlers/shop.js';
import { balanceHandler }                 from './handlers/balance.js';
import { ordersHandler, orderDetailHandler } from './handlers/orders.js';
import {
  depositHandler, amountHandler, depositTextHandler,
  cryptoHandler, checkDepositHandler,
} from './handlers/deposit.js';
import {
  adminHandler, adminProductsHandler, adminProductActionsHandler,
  adminToggleHandler, adminAddProductHandler, adminAddKeysHandler,
  adminTextHandler, adminConfirmProductHandler, adminStatsHandler,
  adminKeysMenuHandler,
} from './handlers/admin.js';

export function createBot(env) {
  const bot = new Bot(env.BOT_TOKEN);

  // Attach env to ctx so handlers can access secrets
  bot.use(async (ctx, next) => { ctx.env = env; return next(); });

  // Load user from DB on every update
  bot.use(userMiddleware);

  // ── Commands ──────────────────────────────────────────────
  bot.command('start', startHandler);
  bot.command('admin', adminMiddleware, adminHandler);

  // ── Main navigation ───────────────────────────────────────
  bot.callbackQuery('start',   startHandler);
  bot.callbackQuery('shop',    shopHandler);
  bot.callbackQuery('balance', balanceHandler);
  bot.callbackQuery('orders',  ordersHandler);
  bot.callbackQuery('deposit', depositHandler);
  bot.callbackQuery('admin',   adminMiddleware, adminHandler);

  // ── Recharge (must be before confirm_ to avoid conflict) ────
  bot.callbackQuery(/^recharge_(.+)$/,            requestRechargeHandler);
  bot.callbackQuery(/^confirm_recharge_(.+)$/,    confirmRechargeHandler);
  bot.callbackQuery(/^admin_recharge_done_(.+)$/, adminRechargeCompleteHandler);

  // ── Shop ─────────────────────────────────────────────────
  bot.callbackQuery(/^prod_(.+)$/,    productHandler);
  bot.callbackQuery(/^buy_(.+)$/,     buyHandler);
  bot.callbackQuery(/^confirm_(.+)$/, confirmBuyHandler);

  // ── Deposit ──────────────────────────────────────────────
  bot.callbackQuery(/^amt_(.+)$/,   amountHandler);
  bot.callbackQuery(/^crypto_(.+)$/, cryptoHandler);
  bot.callbackQuery(/^check_(.+)$/,  checkDepositHandler);

  // ── Admin ────────────────────────────────────────────────
  bot.callbackQuery('admin_products',        adminMiddleware, adminProductsHandler);
  bot.callbackQuery('admin_keys',            adminMiddleware, adminKeysMenuHandler);
  bot.callbackQuery('admin_stats',           adminMiddleware, adminStatsHandler);
  bot.callbackQuery('admin_add_product',     adminMiddleware, adminAddProductHandler);
  bot.callbackQuery('admin_confirm_product', adminMiddleware, adminConfirmProductHandler);
  bot.callbackQuery(/^admin_prod_(.+)$/,     adminMiddleware, adminProductActionsHandler);
  bot.callbackQuery(/^admin_toggle_(.+)$/,   adminMiddleware, adminToggleHandler);
  bot.callbackQuery(/^admin_addkeys_(.+)$/,  adminMiddleware, adminAddKeysHandler);

  // ── Text message router ───────────────────────────────────
  bot.on('message:text', async (ctx) => {
    const { ADMIN_IDS } = ctx.env ? { ADMIN_IDS: (ctx.env.ADMIN_IDS || '').split(',').map(Number) } : { ADMIN_IDS: [] };
    const isAdmin = ADMIN_IDS.includes(ctx.from.id);

    // Try deposit text handler
    const handledByDeposit = await depositTextHandler(ctx);
    if (handledByDeposit) return;

    // Try admin text handler
    if (isAdmin) {
      const handledByAdmin = await adminTextHandler(ctx);
      if (handledByAdmin) return;
    }
  });

  return bot;
}
