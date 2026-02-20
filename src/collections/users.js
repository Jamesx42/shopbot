// src/collections/users.js
import { getDB } from '../db/client.js';
import { ObjectId } from 'mongodb';

const col = () => getDB().collection('users');

export async function findOrCreateUser(from) {
  const { id: telegramId, first_name, username } = from;
  const now = new Date();

  await col().updateOne(
    { telegramId },
    {
      $setOnInsert: {
        telegramId,
        balance:        0,
        totalDeposited: 0,
        totalSpent:     0,
        isAdmin:        false,
        isBanned:       false,
        createdAt:      now,
      },
      $set: {
        firstName: first_name || '',
        username:  username   || null,
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  return col().findOne({ telegramId });
}

export async function getUserByTelegramId(telegramId) {
  return col().findOne({ telegramId });
}

export async function creditUserBalance(telegramId, amountCents) {
  return col().findOneAndUpdate(
    { telegramId },
    {
      $inc: { balance: amountCents, totalDeposited: amountCents },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );
}

export async function debitUserBalance(telegramId, amountCents) {
  // Only deducts if sufficient balance exists
  const result = await col().findOneAndUpdate(
    { telegramId, balance: { $gte: amountCents } },
    {
      $inc: { balance: -amountCents, totalSpent: amountCents },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );
  if (!result) throw new Error('INSUFFICIENT_BALANCE');
  return result;
}

export async function getAllUsers() {
  return col().find({}).sort({ createdAt: -1 }).toArray();
}

export async function banUser(telegramId, isBanned) {
  return col().updateOne({ telegramId }, { $set: { isBanned } });
}

export async function adjustBalance(telegramId, amountCents) {
  return col().findOneAndUpdate(
    { telegramId },
    { $inc: { balance: amountCents }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
}
