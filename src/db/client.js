// src/db/client.js
import { MongoClient } from 'mongodb';

let client = null;
let db = null;

function resetConnection() {
  db = null;
  client = null;
}

export async function connectDB(uri) {
  if (db) return db;
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    heartbeatFrequencyMS: 5000,
    retryWrites: true,
    retryReads: true,
  });
  client.on('topologyDescriptionChanged', (event) => {
    const hasWritable = [...event.newDescription.servers.values()]
      .some(s => s.isWritable);
    if (!hasWritable) {
      console.warn('[DB] No writable server — resetting connection cache');
      resetConnection();
    }
  });
  await client.connect();
  db = client.db();
  console.log('[DB] MongoDB connected');
  return db;
}

export function getDB() {
  if (!db) throw new Error('DB not connected. Call connectDB() first.');
  return db;
}
