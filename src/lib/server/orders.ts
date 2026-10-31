import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, link, unlink, readFile, readdir } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface Order {
  id: string;
  receiptToken: string;
  productId: string;
  productName: string;
  durationMonths: number;
  amount: number;
  currency: string;
  status: "pending_confirmation";
  createdAt: string;
}

export class InvalidOrderError extends Error {
  constructor(message = "Invalid order") {
    super(message);
    this.name = "InvalidOrderError";
  }
}

export class OrderCapacityError extends Error {
  constructor(message = "Storage quota reached") {
    super(message);
    this.name = "OrderCapacityError";
  }
}

export class OrderRateLimitError extends Error {
  constructor(message = "Rate limit exceeded") {
    super(message);
    this.name = "OrderRateLimitError";
  }
}

export class OrderConfigError extends Error {
  constructor(message = "Order configuration invalid") {
    super(message);
    this.name = "OrderConfigError";
  }
}

export class OrderStorageError extends Error {
  constructor(message = "Order storage error") {
    super(message);
    this.name = "OrderStorageError";
  }
}

function dataDir(): string {
  const envDir = process.env.ORDERS_DATA_DIR;
  if (process.env.NODE_ENV === "production") {
    // If running in cloud hosting (Vercel / Lambda) or explicit fallback allowed
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      if (envDir && path.isAbsolute(envDir)) return path.resolve(envDir);
      return path.join(os.tmpdir(), "devtech_orders");
    }
    if (!envDir || !path.isAbsolute(envDir)) {
      throw new OrderConfigError("ORDERS_DATA_DIR required and must be absolute in production");
    }
    return path.resolve(envDir);
  }
  if (envDir) return path.resolve(envDir);
  return path.join(process.cwd(), ".data", "orders");
}

function parseMaxRecords(): number {
  const envVal = process.env.ORDERS_MAX_RECORDS;
  if (envVal === undefined || envVal === "") return 1000;
  if (!/^\d+$/.test(envVal)) throw new OrderConfigError("Invalid ORDERS_MAX_RECORDS");
  const num = parseInt(envVal, 10);
  if (num <= 0 || !Number.isSafeInteger(num)) throw new OrderConfigError("Invalid ORDERS_MAX_RECORDS");
  return num;
}

function parseRateLimitPerMinute(): number {
  const envVal = process.env.ORDERS_RATE_LIMIT_PER_MINUTE;
  if (envVal === undefined || envVal === "") return 60;
  if (!/^\d+$/.test(envVal)) throw new OrderConfigError("Invalid ORDERS_RATE_LIMIT_PER_MINUTE");
  const num = parseInt(envVal, 10);
  if (num <= 0 || !Number.isSafeInteger(num)) throw new OrderConfigError("Invalid ORDERS_RATE_LIMIT_PER_MINUTE");
  return num;
}

const inProcessLocks = new Map<string, Promise<void>>();

function withInProcessLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const current = inProcessLocks.get(key) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  inProcessLocks.set(key, current.then(() => next, () => next));
  return current.then(async () => {
    try {
      return await fn();
    } finally {
      release!();
      if (inProcessLocks.get(key) === next) {
        inProcessLocks.delete(key);
      }
    }
  });
}

async function withDirectoryLock<T>(dir: string, action: () => Promise<T>): Promise<T> {
  return withInProcessLock(dir, async () => {
    const lockFile = path.join(dir, ".order_lock");
    const start = Date.now();
    let handle: FileHandle | null = null;
    while (!handle) {
      try {
        handle = await open(lockFile, "wx", 0o600);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EEXIST" || code === "EBUSY" || code === "EPERM") {
          if (Date.now() - start > 5000) {
            throw new OrderStorageError("Order storage lock timeout");
          }
          await new Promise(r => setTimeout(r, 10));
          continue;
        }
        throw err;
      }
    }
    try {
      return await action();
    } finally {
      try { await handle.close(); } catch {}
      try { await unlink(lockFile); } catch {}
    }
  });
}

export async function readOrder(token: string, directory = dataDir()): Promise<Order | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  try { return JSON.parse(await readFile(path.join(directory, `${token}.json`), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export async function checkOrderRateLimit(directory = dataDir()): Promise<void> {
  const limit = parseRateLimitPerMinute();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await withDirectoryLock(directory, async () => {
    const rateLimitFile = path.join(directory, ".rate_limit.json");
    const now = Date.now();
    let record = { windowStart: now, count: 0 };
    try {
      const data = await readFile(rateLimitFile, "utf8");
      const parsed = JSON.parse(data);
      if (typeof parsed.windowStart === "number" && typeof parsed.count === "number") {
        record = parsed;
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new OrderStorageError("Failed to read rate limit store");
      }
    }

    if (now - record.windowStart >= 60000 || now < record.windowStart) {
      record.windowStart = now;
      record.count = 1;
    } else {
      if (record.count >= limit) {
        throw new OrderRateLimitError("Rate limit exceeded");
      }
      record.count += 1;
    }

    const handle = await open(rateLimitFile, "w", 0o600);
    try {
      await handle.writeFile(JSON.stringify(record), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  });
}

export async function createOrder(input: unknown, directory = dataDir()): Promise<Order> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InvalidOrderError("Invalid order");
  const fields = input as Record<string, unknown>;
  if (Object.keys(fields).sort().join(",") !== "idempotencyKey,productId" ||
      fields.productId !== "chatgpt-plus-private-1m" || typeof fields.idempotencyKey !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(fields.idempotencyKey)) {
    throw new InvalidOrderError("Invalid order");
  }
  const maxRecords = parseMaxRecords();
  const receiptToken = createHash("sha256").update(fields.idempotencyKey).digest("hex");
  await mkdir(directory, { recursive: true, mode: 0o700 });

  const existing = await readOrder(receiptToken, directory);
  if (existing) return existing;

  return withDirectoryLock(directory, async () => {
    const existingUnderLock = await readOrder(receiptToken, directory);
    if (existingUnderLock) return existingUnderLock;

    const files = await readdir(directory);
    const orderCount = files.filter(f => /^[a-f0-9]{64}\.json$/.test(f)).length;
    if (orderCount >= maxRecords) {
      throw new OrderCapacityError("Storage quota reached");
    }

    const order: Order = {
      id: `DT-${randomUUID()}`, receiptToken,
      productId: "chatgpt-plus-private-1m", productName: "ChatGPT Plus Private 1 Bulan",
      durationMonths: 1, amount: 75000, currency: "IDR", status: "pending_confirmation",
      createdAt: new Date().toISOString(),
    };
    const target = path.join(directory, `${receiptToken}.json`);
    const temporary = path.join(directory, `.${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(order)); await handle.sync(); }
    finally { await handle.close(); }
    try {
      // Publish only a fully flushed record; exclusive hard link arbitrates concurrent retries.
      await link(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    } finally {
      await unlink(temporary).catch(() => {});
    }
    return (await readOrder(receiptToken, directory))!;
  });
}
