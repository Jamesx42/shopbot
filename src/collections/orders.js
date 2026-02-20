// src/collections/orders.js
import { getDB } from '../db/client.js';
import { ObjectId } from 'mongodb';

const col = () => getDB().collection('orders');

export async function createOrder({ telegramId, productId, productName, amountPaid }) {
  const result = await col().insertOne({
    telegramId,
    productId:   new ObjectId(productId),
    productName,
    amountPaid,
    createdAt:   new Date(),
  });
  return result.insertedId;
}

export async function getOrdersByUser(telegramId) {
  return col().find({ telegramId }).sort({ createdAt: -1 }).limit(10).toArray();
}

export async function getAllOrders() {
  return col().find({}).sort({ createdAt: -1 }).limit(50).toArray();
}

export async function getOrderCount() {
  return col().countDocuments();
}

export async function getRevenue() {
  const result = await col().aggregate([
    { $group: { _id: null, total: { $sum: '$amountPaid' } } },
  ]).toArray();
  return result[0]?.total || 0;
}
