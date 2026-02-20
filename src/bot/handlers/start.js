// src/bot/handlers/start.js
import { fmt, kb } from '../helpers.js';
import { getConfig } from '../../config.js';

export async function startHandler(ctx) {
  const user    = ctx.user;
  const { ADMIN_IDS } = getConfig(ctx.env);
  const isAdmin = ADMIN_IDS.includes(ctx.from.id);

  const text =
    `👋 Welcome${user.firstName ? `, *${user.firstName}*` : ''}!\n\n` +
    `🏪 *Digital Shop Bot*\n` +
    `Buy digital products instantly.\n\n` +
    `💼 Your Balance: *${fmt.usd(user.balance)}*`;

  await ctx.reply(text, {
    parse_mode:   'Markdown',
    reply_markup: isAdmin ? kb.mainMenuAdmin() : kb.mainMenu(),
  });
}
