// src/collections/deposits.js
import { getDB } from '../db/client.js';
import { ObjectId } from 'mongodb';

const col = () => getDB().collection('deposits');

export async function createDeposit({ telegramId, payCurrency, priceUsd, expiresAt }) {
  const result = await col().insertOne({
    telegramId,
    payCurrency,
    priceUsd,      // cents
    actualUsd:     null,
    nowPaymentId:  null,
    payAddress:    null,
    status:        'waiting',
    expiresAt,
    createdAt:     new Date(),
  });
  return result.insertedId;
}

export async function updateDepositPayment(id, { nowPaymentId, payAddress, payAmount }) {
  return col().updateOne(
    { _id: new ObjectId(id) },
    { $set: { nowPaymentId, payAddress, payAmount } }
  );
}

export async function updateDepositStatus(nowPaymentId, status, actualUsd = null) {
  const update = { $set: { status } };
  if (actualUsd !== null) update.$set.actualUsd = actualUsd;
  if (status === 'finished') update.$set.completedAt = new Date();
  return col().updateOne({ nowPaymentId }, update);
}

export async function getDepositByNowPaymentId(nowPaymentId) {
  return col().findOne({ nowPaymentId });
}

export async function getDepositById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

export async function getRecentDeposits() {
  return col().find({}).sort({ createdAt: -1 }).limit(20).toArray();
}
