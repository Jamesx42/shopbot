// src/bot/helpers.js
import { InlineKeyboard } from 'grammy';

export const fmt = {
  usd:   (cents) => `$${(cents / 100).toFixed(2)}`,
  date:  (d)     => new Date(d).toISOString().slice(0, 10),
};

export const kb = {
  mainMenu: () =>
    new InlineKeyboard()
      .text('🛍  Shop',          'shop').row()
      .text('💰  Load Balance',  'deposit').row()
      .text('💼  My Balance',    'balance').row()
      .text('📦  My Orders',     'orders'),

  mainMenuAdmin: () =>
    new InlineKeyboard()
      .text('🛍  Shop',          'shop').row()
      .text('💰  Load Balance',  'deposit').row()
      .text('💼  My Balance',    'balance').row()
      .text('📦  My Orders',     'orders').row()
      .text('👑  Admin Panel',   'admin'),

  back: (action) =>
    new InlineKeyboard().text('⬅️  Back', action),

  backToMain: () =>
    new InlineKeyboard().text('🏠  Main Menu', 'start'),
};
