// src/bot/middlewares.js
import { findOrCreateUser } from '../collections/users.js';
import { getConfig } from '../config.js';

// Load user from DB and attach to ctx
export async function userMiddleware(ctx, next) {
  if (!ctx.from) return next();
  ctx.user = await findOrCreateUser(ctx.from);
  if (ctx.user?.isBanned) {
    return ctx.reply('⛔ Your account has been banned.');
  }
  return next();
}

// Block non-admins
export async function adminMiddleware(ctx, next) {
  const { ADMIN_IDS } = getConfig(ctx.env);
  if (!ADMIN_IDS.includes(ctx.from?.id)) {
    await ctx.answerCallbackQuery({ text: '⛔ Unauthorized', show_alert: true }).catch(() => {});
    return;
  }
  return next();
}
