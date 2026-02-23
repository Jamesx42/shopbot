// src/bot/handlers/shop.js
import { InlineKeyboard } from 'grammy';
import { getActiveProducts, getProductById, getStockCount, reserveAndSellKey } from '../../collections/products.js';
import { debit }          from '../../services/balance.js';
import { createOrder }    from '../../collections/orders.js';
import { getConfig }      from '../../config.js';
import { getDB }          from '../../db/client.js';
import { ObjectId }       from 'mongodb';
import { fmt, kb }        from '../helpers.js';

// Show product list
export async function shopHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => {});

  const products = await getActiveProducts();

  if (!products.length) {
    await ctx.editMessageText('😕 No products available yet. Check back soon!', {
      reply_markup: kb.backToMain(),
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const p of products) {
    keyboard.text(`${p.name}  —  ${fmt.usd(p.price)}`, `prod_${p._id}`).row();
  }
  keyboard.text('⬅️  Back', 'start');

  await ctx.editMessageText('🛍 *Shop* — Choose a product:', {
    parse_mode:   'Markdown',
    reply_markup: keyboard,
  });
}

// Show product detail
export async function productHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => {});

  const productId = ctx.match[1];
  const product   = await getProductById(productId);

  if (!product) {
    await ctx.answerCallbackQuery({ text: 'Product not found.', show_alert: true });
    return;
  }

  const stock    = await getStockCount(productId);
  const hasStock = stock > 0;

  const text =
    `📦 *${product.name}*\n\n` +
    `${product.description}\n\n` +
    `💰 Price: *${fmt.usd(product.price)}*\n` +
    `📊 Stock: ${hasStock ? `✅ In Stock (${stock})` : '❌ Out of Stock'}`;

  const keyboard = new InlineKeyboard();
  if (hasStock) {
    keyboard.text(`💳  Buy  ${fmt.usd(product.price)}`, `buy_${productId}`).row();
  }
  keyboard.text('⬅️  Back', 'shop');

  await ctx.editMessageText(text, {
    parse_mode:   'Markdown',
    reply_markup: keyboard,
  });
}

// Confirm purchase screen
export async function buyHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => {});

  const productId = ctx.match[1];
  const product   = await getProductById(productId);
  const user      = ctx.user;

  if (!product) return;

  const canAfford = user.balance >= product.price;

  const text =
    `🛒 *Confirm Purchase*\n\n` +
    `Product: *${product.name}*\n` +
    `Price: *${fmt.usd(product.price)}*\n` +
    `Your Balance: *${fmt.usd(user.balance)}*\n\n` +
    (canAfford
      ? `✅ Tap confirm to complete your purchase.`
      : `❌ Insufficient balance. You need *${fmt.usd(product.price - user.balance)}* more.`
    );

  const keyboard = new InlineKeyboard();
  if (canAfford) {
    keyboard.text('✅  Confirm', `confirm_${productId}`).row();
  } else {
    keyboard.text('💰  Load Balance', 'deposit').row();
  }
  keyboard.text('⬅️  Back', `prod_${productId}`);

  await ctx.editMessageText(text, {
    parse_mode:   'Markdown',
    reply_markup: keyboard,
  });
}

// Process purchase
export async function confirmBuyHandler(ctx) {
  await ctx.answerCallbackQuery({ text: 'Processing...' }).catch(() => {});

  const productId = ctx.match[1];
  const user      = ctx.user;
  const product   = await getProductById(productId);

  if (!product) return;

  try {
    // 1. Create order first to get a real orderId
    const orderId = await createOrder({
      telegramId:    user.telegramId,
      productId,
      productName:   product.name,
      amountPaid:    product.price,
      accountEmail:  '',           // will update after key is reserved
      rechargePrice: product.price, // same as purchase price
    });

    // 2. Reserve key and link to real orderId
    const licenseKey = await reserveAndSellKey(productId, user.telegramId, orderId.toString());

    // 3. Update order with account email extracted from key (username:password)
    const db = getDB();
    await db.collection('orders').updateOne(
      { _id: orderId },
      { $set: { accountEmail: licenseKey.key.split(':')[0] || licenseKey.key } }
    );

    // 4. Deduct balance
    await debit(user.telegramId, product.price, `Purchase: ${product.name}`, orderId);

    // 5. Confirm + deliver credentials
    await ctx.editMessageText(
      `✅ *Purchase Successful!*\n\n` +
      `Product: *${product.name}*\n` +
      `Paid: *${fmt.usd(product.price)}*`,
      { parse_mode: 'Markdown' }
    );

    await ctx.reply(
      `🔐 *Your Login Credentials:*\n\n\`${licenseKey.key}\`\n\n` +
      `_You can view this anytime in 📦 My Orders._`,
      { parse_mode: 'Markdown', reply_markup: kb.mainMenu() }
    );

    // 6. Notify admins of new sale
    const { ADMIN_IDS } = getConfig(ctx.env);
    const buyerName = user.username ? `@${user.username}` : user.firstName || `#${user.telegramId}`;
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.api.sendMessage(
          adminId,
          `🛒 *New Sale!*\n\n` +
          `👤 Buyer: ${buyerName}\n` +
          `📦 Product: ${product.name}\n` +
          `💰 Amount: ${fmt.usd(product.price)}`,
          { parse_mode: 'Markdown' }
        );
      } catch {}
    }

  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      await ctx.reply('❌ Insufficient balance. Please load your balance first.', {
        reply_markup: new InlineKeyboard().text('💰  Load Balance', 'deposit'),
      });
    } else if (err.message === 'OUT_OF_STOCK') {
      await ctx.reply('❌ This product just went out of stock. Sorry!', {
        reply_markup: kb.backToMain(),
      });
    } else {
      console.error('[PURCHASE]', err.message);
      await ctx.reply('❌ Something went wrong. Please try again.');
    }
  }
}
