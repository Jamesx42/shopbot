// src/collections/products.js
import { getDB } from '../db/client.js';
import { ObjectId } from 'mongodb';

const col     = () => getDB().collection('products');
const keyCol  = () => getDB().collection('licensekeys');

export async function getActiveProducts() {
  return col().find({ isActive: true }).sort({ createdAt: -1 }).toArray();
}

export async function getAllProducts() {
  return col().find({}).sort({ createdAt: -1 }).toArray();
}

export async function getProductById(id) {
  return col().findOne({ _id: new ObjectId(id) });
}

export async function createProduct({ name, description, price, rechargePrice }) {
  const result = await col().insertOne({
    name,
    description,
    price,          // in cents
    rechargePrice,  // in cents — cost per recharge request
    isActive:   true,
    totalSold:  0,
    createdAt:  new Date(),
  });
  return result.insertedId;
}

export async function toggleProduct(id) {
  const product = await getProductById(id);
  if (!product) return null;
  await col().updateOne(
    { _id: new ObjectId(id) },
    { $set: { isActive: !product.isActive } }
  );
  return !product.isActive;
}

export async function getStockCount(productId) {
  return keyCol().countDocuments({ productId: new ObjectId(productId), status: 'available' });
}

export async function addLicenseKeys(productId, keys) {
  const docs = keys
    .map(k => k.trim()).filter(Boolean)
    .map(key => ({
      productId: new ObjectId(productId),
      key,
      status:    'available',
      createdAt: new Date(),
    }));
  if (!docs.length) throw new Error('No valid keys');
  const result = await keyCol().insertMany(docs);
  return result.insertedCount;
}

export async function reserveAndSellKey(productId, telegramId, orderId) {
  // Atomically grab one available key
  const key = await keyCol().findOneAndUpdate(
    { productId: new ObjectId(productId), status: 'available' },
    { $set: { status: 'sold', soldTo: telegramId, soldAt: new Date(), orderId: new ObjectId(orderId) } },
    { returnDocument: 'after' }
  );
  if (!key) throw new Error('OUT_OF_STOCK');
  // Increment sold counter
  await col().updateOne({ _id: new ObjectId(productId) }, { $inc: { totalSold: 1 } });
  return key;
}
