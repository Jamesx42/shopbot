// src/bot/handlers/orders.js
import { InlineKeyboard } from 'grammy';
import { getOrdersByUser } from '../../collections/orders.js';
import { getDB }           from '../../db/client.js';
import { ObjectId }        from 'mongodb';
import { fmt, kb }         from '../helpers.js';

export async function ordersHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => {});

  const orders = await getOrdersByUser(ctx.user.telegramId);

  if (!orders.length) {
    await ctx.editMessageText(
      `📦 *My Orders*\n\nYou haven't purchased anything yet.`,
      {
        parse_mode:   'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🛍  Shop', 'shop').row()
          .text('⬅️  Back', 'start'),
      }
    ).catch(() => {});
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const o of orders) {
    keyboard.text(`${o.productName}  —  ${fmt.usd(o.amountPaid)}`, `order_${o._id}`).row();
  }
  keyboard.text('⬅️  Back', 'start');

  await ctx.editMessageText(
    `📦 *My Orders* (last ${orders.length})\n\nTap to view your credentials:`,
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

  // Try multiple ways to find the license key
  let licenseKey = null;

  // 1. By orderId as ObjectId
  try {
    licenseKey = await db.collection('licensekeys').findOne({
      orderId: new ObjectId(orderId),
    });
  } catch {}

  // 2. By orderId as string
  if (!licenseKey) {
    licenseKey = await db.collection('licensekeys').findOne({
      orderId: orderId,
    });
  }

  // 3. Fallback — by soldTo telegramId + productId
  if (!licenseKey) {
    try {
      licenseKey = await db.collection('licensekeys').findOne({
        productId: new ObjectId(order.productId),
        soldTo:    ctx.user.telegramId,
        status:    'sold',
      });
    } catch {}
  }

  // 4. Fallback — by soldTo telegramId only
  if (!licenseKey) {
    licenseKey = await db.collection('licensekeys').findOne({
      soldTo: ctx.user.telegramId,
      status: 'sold',
    });
  }

  const rechargePrice = order.rechargePrice || order.amountPaid;

  const text =
    `📦 *Order Details*\n\n` +
    `Product: *${order.productName}*\n` +
    `Paid: *${fmt.usd(order.amountPaid)}*\n` +
    `Date: ${fmt.date(order.createdAt)}\n\n` +
    `🔐 *Login Credentials:*\n\`${licenseKey?.key || 'Not found — contact support'}\``;

  const keyboard = new InlineKeyboard();
  keyboard.text(`⚡  Recharge  ${fmt.usd(rechargePrice)}`, `recharge_${orderId}`).row();
  keyboard.text('⬅️  Back', 'orders');

  await ctx.editMessageText(text, {
    parse_mode:   'Markdown',
    reply_markup: keyboard,
  }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }));
}
