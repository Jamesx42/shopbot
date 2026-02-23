// src/bot/handlers/recharge.js
import { InlineKeyboard } from 'grammy';
import { getDB }          from '../../db/client.js';
import { ObjectId }       from 'mongodb';
import { createRecharge, completeRecharge, getRechargeById } from '../../collections/recharges.js';
import { debit }          from '../../services/balance.js';
import { getConfig }      from '../../config.js';
import { fmt }            from '../helpers.js';

// Buyer requests recharge for an order
export async function requestRechargeHandler(ctx) {
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

  // Check balance
  if (ctx.user.balance < order.rechargePrice) {
    await ctx.editMessageText(
      `❌ *Insufficient Balance*\n\n` +
      `Recharge costs: *${fmt.usd(order.rechargePrice)}*\n` +
      `Your balance: *${fmt.usd(ctx.user.balance)}*\n\n` +
      `Please load your balance first.`,
      {
        parse_mode:   'Markdown',
        reply_markup: new InlineKeyboard()
          .text('💰  Load Balance', 'deposit').row()
          .text('⬅️  Back', `order_${orderId}`),
      }
    ).catch(() => {});
    return;
  }

  // Confirm screen
  await ctx.editMessageText(
    `⚡ *Request Recharge*\n\n` +
    `Account: \`${order.accountEmail}\`\n` +
    `Cost: *${fmt.usd(order.rechargePrice)}*\n` +
    `Your Balance: *${fmt.usd(ctx.user.balance)}*\n\n` +
    `Confirm to proceed. Admin will be notified.`,
    {
      parse_mode:   'Markdown',
      reply_markup: new InlineKeyboard()
        .text('✅  Confirm Recharge', `confirm_recharge_${orderId}`).row()
        .text('❌  Cancel',           `order_${orderId}`),
    }
  ).catch(() => {});
}

// Buyer confirms recharge
export async function confirmRechargeHandler(ctx) {
  await ctx.answerCallbackQuery({ text: 'Processing...' }).catch(() => {});

  const orderId = ctx.match[1];
  const db      = getDB();
  const { ADMIN_IDS } = getConfig(ctx.env);

  const order = await db.collection('orders').findOne({
    _id:        new ObjectId(orderId),
    telegramId: ctx.user.telegramId,
  });

  if (!order) return;

  try {
    // Deduct balance
    await debit(
      ctx.user.telegramId,
      order.rechargePrice,
      `Recharge: ${order.productName}`,
      orderId
    );

    // Create recharge request
    const rechargeId = await createRecharge({
      telegramId:   ctx.user.telegramId,
      orderId,
      accountEmail: order.accountEmail,
      amount:       order.rechargePrice,
    });

    // Notify buyer
    await ctx.editMessageText(
      `✅ *Recharge Requested!*\n\n` +
      `Account: \`${order.accountEmail}\`\n` +
      `Amount paid: *${fmt.usd(order.rechargePrice)}*\n\n` +
      `Admin has been notified and will recharge your account shortly.`,
      {
        parse_mode:   'Markdown',
        reply_markup: new InlineKeyboard().text('🏠  Main Menu', 'start'),
      }
    ).catch(() => {});

    // Notify all admins
    const buyerName = ctx.user.username
      ? `@${ctx.user.username}`
      : ctx.user.firstName || `#${ctx.user.telegramId}`;

    const adminMsg =
      `⚡ *Recharge Request*\n\n` +
      `👤 Buyer: ${buyerName}\n` +
      `📧 Account: \`${order.accountEmail}\`\n` +
      `💰 Amount: *${fmt.usd(order.rechargePrice)}*\n` +
      `📦 Product: ${order.productName}`;

    const adminKeyboard = new InlineKeyboard()
      .text('✅  Mark Complete', `admin_recharge_done_${rechargeId}`);

    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.api.sendMessage(adminId, adminMsg, {
          parse_mode:   'Markdown',
          reply_markup: adminKeyboard,
        });
      } catch (e) {
        console.error(`[RECHARGE] Could not notify admin ${adminId}:`, e.message);
      }
    }

  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      await ctx.reply('❌ Insufficient balance.');
    } else {
      console.error('[RECHARGE]', err.message);
      await ctx.reply('❌ Something went wrong. Please try again.');
    }
  }
}

// Admin marks recharge as complete
export async function adminRechargeCompleteHandler(ctx) {
  await ctx.answerCallbackQuery({ text: 'Marking complete...' }).catch(() => {});

  const rechargeId = ctx.match[1];
  const recharge   = await completeRecharge(rechargeId);

  if (!recharge) {
    await ctx.answerCallbackQuery({ text: 'Recharge not found.', show_alert: true });
    return;
  }

  // Update admin message
  await ctx.editMessageText(
    ctx.callbackQuery.message.text + '\n\n✅ *Completed!*',
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  // Notify buyer
  try {
    await ctx.api.sendMessage(
      recharge.telegramId,
      `✅ *Your Account Has Been Recharged!*\n\n` +
      `📧 Account: \`${recharge.accountEmail}\`\n` +
      `💰 Amount: *${fmt.usd(recharge.amount)}*\n\n` +
      `You're all set! Enjoy.`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('[RECHARGE] Could not notify buyer:', e.message);
  }
}
