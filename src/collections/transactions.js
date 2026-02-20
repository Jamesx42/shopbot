// src/collections/transactions.js
import { getDB } from '../db/client.js';
import { ObjectId } from 'mongodb';

const col = () => getDB().collection('transactions');

export async function logTransaction({ telegramId, type, amount, balanceBefore, balanceAfter, description, refId }) {
  return col().insertOne({
    telegramId,
    type,           // 'deposit' | 'purchase'
    amount,         // positive = credit, negative = debit
    balanceBefore,
    balanceAfter,
    description,
    refId: refId ? new ObjectId(refId) : null,
    createdAt: new Date(),
  });
}

export async function getTransactionsByUser(telegramId) {
  return col().find({ telegramId }).sort({ createdAt: -1 }).limit(10).toArray();
}
