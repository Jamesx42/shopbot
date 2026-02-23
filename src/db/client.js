// src/db/client.js
import { MongoClient } from 'mongodb';

let client = null;
let db     = null;

export async function connectDB(uri) {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('[DB] MongoDB connected');
  return db;
}

export function getDB() {
  if (!db) throw new Error('DB not connected. Call connectDB() first.');
  return db;
}
