// src/bot/handlers/admin.js
import { InlineKeyboard } from 'grammy';
import { getAllProducts, createProduct, toggleProduct, addLicenseKeys, getStockCount } from '../../collections/products.js';
import { getAllUsers } from '../../collections/users.js';
import { getOrderCount, getRevenue } from '../../collections/orders.js';
import { fmt } from '../helpers.js';

// Per-admin conversation sessions
const sessions = new Map();

// Admin menu
export async function adminHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });

  const keyboard = new InlineKeyboard()
    .text('📦  Products', 'admin_products').row()
    .text('🔑  Add Keys', 'admin_keys').row()
    .text('📊  Stats', 'admin_stats').row()
    .text('🏠  Main Menu', 'start');

  await ctx.editMessageText('👑 *Admin Panel*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  }).catch(() => ctx.reply('👑 *Admin Panel*', { parse_mode: 'Markdown', reply_markup: keyboard }));
}

// Product list
export async function adminProductsHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });

  const products = await getAllProducts();

  const keyboard = new InlineKeyboard()
    .text('➕  Add Product', 'admin_add_product').row();

  for (const p of products) {
    const stock = await getStockCount(p._id.toString());
    const status = p.isActive ? '✅' : '❌';
    keyboard.text(`${status} ${p.name} — ${fmt.usd(p.price)} (${stock} keys)`, `admin_prod_${p._id}`).row();
  }
  keyboard.text('⬅️  Back', 'admin');

  await ctx.editMessageText('📦 *Products*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  }).catch(() => { });
}

// Product actions
export async function adminProductActionsHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });

  const productId = ctx.match[1];
  const products = await getAllProducts();
  const product = products.find(p => p._id.toString() === productId);

  if (!product) return;

  const stock = await getStockCount(productId);
  const keyboard = new InlineKeyboard()
    .text(product.isActive ? '❌  Deactivate' : '✅  Activate', `admin_toggle_${productId}`).row()
    .text('🔑  Add Keys', `admin_addkeys_${productId}`).row()
    .text('⬅️  Back', 'admin_products');

  await ctx.editMessageText(
    `📦 *${product.name}*\n` +
    `Price: ${fmt.usd(product.price)}\n` +
    `Status: ${product.isActive ? '✅ Active' : '❌ Inactive'}\n` +
    `Stock: ${stock} keys\n` +
    `Sold: ${product.totalSold}`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  ).catch(() => { });
}

// Toggle active
export async function adminToggleHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });
  const productId = ctx.match[1];
  const newState = await toggleProduct(productId);
  await ctx.answerCallbackQuery({
    text: newState ? '✅ Product activated' : '❌ Product deactivated',
    show_alert: true,
  });
  await adminProductsHandler(ctx);
}

// Start add product flow
export async function adminAddProductHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });
  sessions.set(ctx.from.id, { step: 'name' });
  await ctx.editMessageText(
    '➕ *Add Product*\n\nStep 1: Enter the *product name*:',
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌  Cancel', 'admin_products') }
  ).catch(() => { });
}

// Start add keys flow
// export async function adminAddKeysHandler(ctx) {
//   await ctx.answerCallbackQuery().catch(() => {});
//   const productId = ctx.match[1];
//   sessions.set(ctx.from.id, { step: 'keys', productId });

//   await ctx.reply(
//     `🔑 *Add License Keys*\n\nPaste your keys — *one key per line*:`,
//     { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌  Cancel', 'admin_products') }
//   );
// }

export async function adminAddKeysHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });
  const productId = ctx.match[1];
  sessions.set(ctx.from.id, { step: 'awaiting_username', productId });

  await ctx.reply(
    `👤 *Add Credentials*\n\nStep 1: Enter the *username*:`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('❌  Cancel', 'admin_products') }
  );
}

// Handle admin text input (multi-step flows)
export async function adminTextHandler(ctx) {
  const session = sessions.get(ctx.from.id);
  if (!session) return false;

  const text = ctx.message.text.trim();

  // Add product flow
  if (session.step === 'name') {
    sessions.set(ctx.from.id, { ...session, step: 'description', name: text });
    await ctx.reply('Step 2: Enter the *product description*:', { parse_mode: 'Markdown' });
    return true;
  }



  if (session.step === 'description') {
    sessions.set(ctx.from.id, { ...session, step: 'price', description: text });
    await ctx.reply('Step 3: Enter the *price in USD* (e.g. 9.99):', { parse_mode: 'Markdown' });
    return true;
  }

  if (session.step === 'price') {
    const price = parseFloat(text.replace('$', ''));
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Invalid price. Enter a number like 9.99');
      return true;
    }

    const s = { ...session, price: Math.round(price * 100) };

    await ctx.reply(
      `✅ *Confirm New Product:*\n\n` +
      `Name: *${s.name}*\n` +
      `Description: ${s.description}\n` +
      `Price: *${fmt.usd(s.price)}*`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('✅  Create', 'admin_confirm_product').row()
          .text('❌  Cancel', 'admin_products'),
      }
    );

    sessions.set(ctx.from.id, { ...s, step: 'confirm' });
    return true;
  }

  // Add keys flow
  // if (session.step === 'keys') {
  //   const keys = text.split('\n');
  //   try {
  //     const count = await addLicenseKeys(session.productId, keys);
  //     sessions.delete(ctx.from.id);
  //     await ctx.reply(
  //       `✅ *${count} keys added successfully!*`,
  //       {
  //         parse_mode: 'Markdown',
  //         reply_markup: new InlineKeyboard().text('⬅️  Back to Products', 'admin_products'),
  //       }
  //     );
  //   } catch (err) {
  //     await ctx.reply(`❌ Error: ${err.message}`);
  //   }
  //   return true;
  // }

  // Add credentials flow — step 1: username
  if (session.step === 'awaiting_username') {
    sessions.set(ctx.from.id, { ...session, step: 'awaiting_password', username: text });
    await ctx.reply(
      `🔑 Step 2: Enter the *password* for \`${text}\`:`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // Add credentials flow — step 2: password
  if (session.step === 'awaiting_password') {
    const credential = `${session.username}:${text}`;
    try {
      await addLicenseKeys(session.productId, [credential]);
      sessions.delete(ctx.from.id);
      await ctx.reply(
        `✅ *Credentials Added!*\n\n` +
        `👤 Username: \`${session.username}\`\n` +
        `🔑 Password: \`${text}\`\n\n` +
        `Add another or go back.`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('➕  Add Another', `admin_addkeys_${session.productId}`).row()
            .text('⬅️  Back to Products', 'admin_products'),
        }
      );
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
    return true;
  }

  return false;
}

// Confirm create product
export async function adminConfirmProductHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });

  const session = sessions.get(ctx.from.id);
  if (!session?.name) {
    await ctx.reply('Session expired. Start again.');
    return;
  }

  await createProduct({
    name: session.name,
    description: session.description,
    price: session.price,
  });

  sessions.delete(ctx.from.id);

  await ctx.editMessageText(
    `✅ *Product Created!*\n\n*${session.name}* — ${fmt.usd(session.price)}\n\nNow add license keys to it.`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text('📦  View Products', 'admin_products'),
    }
  ).catch(() => { });
}

// Stats
export async function adminStatsHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });

  const [users, orderCount, revenue] = await Promise.all([
    getAllUsers(),
    getOrderCount(),
    getRevenue(),
  ]);

  const text =
    `📊 *Bot Stats*\n\n` +
    `👥 Total Users: ${users.length}\n` +
    `🛒 Total Orders: ${orderCount}\n` +
    `💰 Total Revenue: *${fmt.usd(revenue)}*`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard().text('🔄  Refresh', 'admin_stats').row().text('⬅️  Back', 'admin'),
  }).catch(() => { });
}

// Select product to add keys to
export async function adminKeysMenuHandler(ctx) {
  await ctx.answerCallbackQuery().catch(() => { });

  const products = await getAllProducts();
  if (!products.length) {
    await ctx.editMessageText('No products yet. Add a product first.', {
      reply_markup: new InlineKeyboard().text('⬅️  Back', 'admin'),
    }).catch(() => { });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const p of products) {
    keyboard.text(p.name, `admin_addkeys_${p._id}`).row();
  }
  keyboard.text('⬅️  Back', 'admin');

  await ctx.editMessageText('🔑 *Add Keys — Select Product:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  }).catch(() => { });
}
