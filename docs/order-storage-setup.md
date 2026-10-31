# Order Storage & Checkout Deployment Setup

## Overview
The ChatGPT Plus checkout flow creates persisted order records upon customer checkout, generating canonical order details and receipt tokens used for payment confirmation via WhatsApp.

Public order creation is protected against denial-of-service and storage exhaustion via:
1. **Bounded Persistent Storage Quota**: Caps total stored orders on disk.
2. **Global Request Rate Limiting**: Throttles order creation requests without trusting spoofable proxy headers.
3. **Cross-Process Synchronization**: Atomic mutual exclusion using in-process queue and filesystem-level exclusive locks.
4. **Preserved Idempotency**: Existing orders remain retrievable at quota; real orders are never evicted.
5. **Fail-Closed Architecture**: Missing or invalid configuration fails closed with sanitized 429/503 responses.

---

## Deployment & Filesystem Requirements

### 1. Durable Filesystem (Not Serverless)
- Production order storage requires an absolute path specified via `ORDERS_DATA_DIR`.
- The storage volume must provide durable, non-ephemeral POSIX or NTFS filesystem semantics with support for hard links (`link`) and exclusive file creation (`open` with `wx`).
- **Incompatible with Ephemeral Serverless Platforms**: Platforms such as Vercel serverless functions, AWS Lambda, or container runtimes without persistent volumes are unsuitable because ephemeral instance filesystems do not persist across invocations or instances, and concurrent serverless instances cannot coordinate local file locks.
- Deploy to a durable VM, persistent container with mounted volume, or dedicated host with restricted directory permissions (`0700`).

### 2. Configuration Parameters
Configure the following server-only environment variables in production:

| Variable | Description | Default | Validation & Fail-Closed Behavior |
| :--- | :--- | :--- | :--- |
| `ORDERS_DATA_DIR` | Absolute path to durable order directory | `.data/orders` (dev) | **Mandatory and must be absolute** in `production`. Fails closed (503) if missing or relative. |
| `ORDERS_MAX_RECORDS` | Maximum count of stored order files | `1000` | Must be a positive integer string (`/^\d+$/`). Invalid values fail closed (503). |
| `ORDERS_RATE_LIMIT_PER_MINUTE` | Maximum order creation requests per minute | `60` | Must be a positive integer string (`/^\d+$/`). Invalid values fail closed (503). |
| `ORDER_PUBLIC_ORIGIN` | Expected Origin header for CORS validation | Auto from URL | Rejects mismatched `origin` headers with 403. |

---

## Concurrency & Quota Semantics

1. **Storage Quota Enforcement**:
   - Order files are stored as `<receiptToken>.json` (64-character SHA-256 hash).
   - Before writing a new order, the storage layer checks total order files against `ORDERS_MAX_RECORDS`.
   - When quota is reached, any new order creation request fails with HTTP 503 (`Pesanan belum dapat disimpan. Silakan coba lagi.`).
   - Existing real orders are never deleted or truncated.

2. **Idempotent Replay at Capacity**:
   - If an order with the given `idempotencyKey` has already been published, `createOrder` returns the canonical record immediately without checking or incrementing quota.
   - Retries from customers whose checkout succeeded remain valid even when storage is at full capacity.

3. **Request Rate Limiting**:
   - A global rolling 1-minute window rate limit is enforced before order processing.
   - Does **not** rely on `X-Forwarded-For`, `X-Real-IP`, or other easily spoofed client headers.
   - Exceeding the rate limit returns HTTP 429 (`Terlalu banyak permintaan. Silakan coba lagi nanti.`) with `Cache-Control: no-store`.
   - Operators running high-traffic edge reverse proxies (Cloudflare, Nginx) should also configure edge IP-based rate limiting as a complementary defense.

4. **Cross-Process Mutual Exclusion**:
   - Synchronization uses an in-process promise queue combined with exclusive `.order_lock` acquisition on disk.
   - Write publication uses temporary files flushed with `sync()` and hard-linked into place, ensuring partial writes are never visible.
   - Lock timeout is bounded (5 seconds). If a process crashes while holding `.order_lock`, stop active writers and clean stale lock files.

---

## Verification & Testing

Run all checkout order tests in isolation:
```bash
node --test tests/checkout-orders.test.cjs
```

Run the complete test suite:
```bash
node --test tests/*.test.mjs tests/*.test.cjs
```

Run project linting:
```bash
npm run lint
```

Run TypeScript compilation check (without invoking Next.js build or inspecting `.env`):
```bash
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

All test cases use isolated temporary directories and clean up automatically upon completion.
