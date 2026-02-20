// src/bot/handlers/orders.js
import { InlineKeyboard } from 'grammy';
import { getOrdersByUser } from '../../collections/orders.js';
import { getDB } from '../../db/client.js';
import { ObjectId } from 'mongodb';
import { fmt, kb } from '../helpers.js';

export async function ordersHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => {});

  const orders = await getOrdersByUser(ctx.user.telegramId);

  if (!orders.length) {
    await ctx.editMessageText(
      `📦 *My Orders*\n\nYou haven't purchased anything yet.`,
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('🛍  Shop', 'shop').row().text('⬅️  Back', 'start') }
    ).catch(() => {});
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const o of orders) {
    keyboard.text(`${o.productName}  —  ${fmt.usd(o.amountPaid)}`, `order_${o._id}`).row();
  }
  keyboard.text('⬅️  Back', 'start');

  await ctx.editMessageText(
    `📦 *My Orders* (last ${orders.length})\n\nTap to view your license key:`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  ).catch(() => {});
}

export async function orderDetailHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => {});

  const orderId = ctx.match[1];
  const db      = getDB();

  const order = await db.collection('orders').findOne({
    _id:        new ObjectId(orderId),
    telegramId: ctx.user.telegramId,
  });

  if (!order) {
    await ctx.answerCallbackQuery({ text: 'Order not found.', show_alert: true });
    return;
  }

  const licenseKey = await db.collection('licensekeys').findOne({
    orderId: new ObjectId(orderId),
  });

  const text =
    `📦 *Order Details*\n\n` +
    `Product: *${order.productName}*\n` +
    `Paid: *${fmt.usd(order.amountPaid)}*\n` +
    `Date: ${fmt.date(order.createdAt)}\n\n` +
    `🔑 *License Key:*\n\`${licenseKey?.key || 'Key not found — contact support'}\``;

  await ctx.editMessageText(text, {
    parse_mode:   'Markdown',
    reply_markup: kb.back('orders'),
  }).catch(() => ctx.reply(text, { parse_mode: 'Markdown' }));
}
