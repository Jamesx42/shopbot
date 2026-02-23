// src/collections/recharges.js
import { getDB } from '../db/client.js';
import { ObjectId } from 'mongodb';

const col = () => getDB().collection('recharges');

export async function createRecharge({ telegramId, orderId, accountEmail, amount }) {
  const result = await col().insertOne({
    telegramId,
    orderId:      new ObjectId(orderId),
    accountEmail,
    amount,        // cents deducted from buyer balance
    status:        'pending',
    createdAt:     new Date(),
    completedAt:   null,
  });
  return result.insertedId;
}

export async function completeRecharge(rechargeId) {
  return col().findOneAndUpdate(
    { _id: new ObjectId(rechargeId) },
    { $set: { status: 'completed', completedAt: new Date() } },
    { returnDocument: 'after' }
  );
}

export async function getRechargeById(rechargeId) {
  return col().findOne({ _id: new ObjectId(rechargeId) });
}

export async function getPendingRecharges() {
  return col().find({ status: 'pending' }).sort({ createdAt: -1 }).toArray();
}
