import 'server-only';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export interface StorePricing {
  price: number;
  originalPrice: number;
  updatedAt: number;
}

const DEFAULT_PRICING: StorePricing = {
  price: 75000,
  originalPrice: 150000,
  updatedAt: Date.now(),
};

function getPricingFilePath(): string {
  if (process.env.PRICING_DATA_DIR) {
    return path.join(path.resolve(process.env.PRICING_DATA_DIR), 'pricing.json');
  }
  if (process.env.ORDERS_DATA_DIR) {
    return path.join(path.resolve(process.env.ORDERS_DATA_DIR), 'pricing.json');
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'devtech_pricing.json');
  }
  return path.join(process.cwd(), '.data', 'pricing.json');
}

function parseServiceAccount(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  try {
    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
  } catch {
    return JSON.parse(trimmed);
  }
}

export async function getStorePricing(): Promise<StorePricing> {
  const { FIREBASE_SERVICE_ACCOUNT_JSON } = process.env;
  if (FIREBASE_SERVICE_ACCOUNT_JSON && process.env.CLAIM_STORAGE_BACKEND === 'firestore') {
    try {
      const sa = parseServiceAccount(FIREBASE_SERVICE_ACCOUNT_JSON);
      const app = getApps().find(a => a.name === 'private-claims') || initializeApp({ credential: cert(sa) }, 'private-claims');
      const db = process.env.FIREBASE_DATABASE_ID ? getFirestore(app, process.env.FIREBASE_DATABASE_ID) : getFirestore(app);
      const doc = await db.collection('storeSettings').doc('pricing').get();
      if (doc.exists) {
        const data = doc.data() as StorePricing;
        if (typeof data?.price === 'number' && data.price > 0) {
          return {
            price: data.price,
            originalPrice: typeof data.originalPrice === 'number' ? data.originalPrice : data.price * 2,
            updatedAt: data.updatedAt || Date.now(),
          };
        }
      }
    } catch {
      // Fallback to local storage if firestore read fails
    }
  }

  try {
    const filePath = getPricingFilePath();
    const content = await readFile(filePath, 'utf8');
    const data = JSON.parse(content) as StorePricing;
    if (typeof data.price === 'number' && data.price > 0) {
      return {
        price: data.price,
        originalPrice: typeof data.originalPrice === 'number' ? data.originalPrice : data.price * 2,
        updatedAt: data.updatedAt || Date.now(),
      };
    }
  } catch {
    // Return default pricing
  }

  return DEFAULT_PRICING;
}

export async function updateStorePricing(newPrice: number, originalPrice?: number): Promise<StorePricing> {
  if (!Number.isSafeInteger(newPrice) || newPrice < 1000 || newPrice > 10000000) {
    throw new Error('Harga tidak valid. Masukkan angka antara Rp1.000 sampai Rp10.000.000');
  }

  const updated: StorePricing = {
    price: newPrice,
    originalPrice: originalPrice && originalPrice > newPrice ? originalPrice : newPrice * 2,
    updatedAt: Date.now(),
  };

  const { FIREBASE_SERVICE_ACCOUNT_JSON } = process.env;
  if (FIREBASE_SERVICE_ACCOUNT_JSON && process.env.CLAIM_STORAGE_BACKEND === 'firestore') {
    try {
      const sa = parseServiceAccount(FIREBASE_SERVICE_ACCOUNT_JSON);
      const app = getApps().find(a => a.name === 'private-claims') || initializeApp({ credential: cert(sa) }, 'private-claims');
      const db = process.env.FIREBASE_DATABASE_ID ? getFirestore(app, process.env.FIREBASE_DATABASE_ID) : getFirestore(app);
      await db.collection('storeSettings').doc('pricing').set(updated, { merge: true });
    } catch {
      // Continue to local save
    }
  }

  const filePath = getPricingFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');

  return updated;
}
