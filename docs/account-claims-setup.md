# Private account claims

## Current status
The old /2fa client fetched the entire RTDB settings/redeemLinks collection and fabricated credentials even when no code matched. /claim reexports that UI. It now POSTs a bearer claim code to /api/claims and only displays the single server-returned account. The existing dark gate and logo remain.

Persistence must be explicitly selected with server-only `CLAIM_STORAGE_BACKEND=firestore` or `local`. There is no automatic fallback. Missing/invalid configuration returns 503 without exposing internal errors. Environment files and live records were not inspected during this security correction. Tests use isolated temporary files/SQLite and a mocked Firebase SDK; they do not prove live Firebase connectivity or deployed rules.

## Required secure deployment setup
1. Enable Cloud Firestore for the existing Firebase project. Supply a least-privileged service identity in server-only `FIREBASE_SERVICE_ACCOUNT_JSON` using deployment secret management (never NEXT_PUBLIC, never chat). Firebase Auth must be the same project as the client login.
2. Supply server-only `CLAIM_ENCRYPTION_KEY`: a cryptographically random 32-byte key encoded as 64 hex characters. Keep a secure backup; losing it makes saved accounts unreadable.
3. Set `CLAIM_ADMIN_UIDS` to comma-separated Firebase Authentication merchant UIDs. Login alone does NOT authorize creation. The server verifies ID tokens including revocation and checks this allowlist.
4. Deploy and verify Firestore rules denying ALL client read/write access to `/privateAccountClaims/{document=**}` and `/privateClaimRateLimits/{document=**}`. Ensure no broader wildcard allow rule grants access: Firestore allows are additive. Do not overwrite unrelated rules. Admin SDK access uses IAM, bypassing client rules.
5. Only after checking anonymous AND signed-in-client access denial, set server-only `CLAIM_FIRESTORE_RULES_CONFIRMED=true`. This is an operator attestation, not automatic rules verification. The service remains disabled without it.
6. Restart/redeploy through the usual deployment workflow. Visit /admin, log in, and enter account credentials manually in **Kirim akun privat**. Save the returned code securely and share privately with the intended buyer. Buyer enters it at /claim; never put it in a URL. Nothing is sent to WhatsApp automatically.

## Semantics and operational limitations
- Codes contain 256 random bits; only SHA-256 hashes are stored as document IDs. Account payloads are AES-256-GCM encrypted with the document hash authenticated as AAD.
- Codes are reusable bearer secrets for the same assigned account. They are not public order IDs and not one-use purchase/payment verification. Protect delivery; anyone possessing a code can retrieve that assigned account. Delete via the authorized admin endpoint to revoke. Inventory listing is server-side decrypted only after Firebase token verification and explicit UID authorization.
- Responses are no-store. Do not enable request-body logging, APM payload capture, session replay, or response-body logging on this path. Use HTTPS.
- Firestore transactions enforce a global 60 claims/minute limit and 10 creates/minute per admin. Global limits avoid trusting spoofable forwarded IP headers but permit denial of service; deploy an edge IP rate limiter too.
- Legacy RTDB rules and redeemLinks were not modified, migrated, or read. Audit separately if sensitive credentials were previously placed there. Never enter new credentials in the legacy redeem-link form.
- `npm install firebase-admin server-only` reported 32 dependency vulnerabilities (20 moderate, 11 high, 1 critical); broad upgrades were not attempted.

## Explicit local storage
Set `CLAIM_STORAGE_BACKEND=local` deliberately. The same server-only random encryption key, Firebase service account, and nonempty UID allowlist are mandatory: local storage does not bypass Firebase authentication. In production `CLAIMS_DATA_DIR` must be an absolute path on a durable, backed-up, access-restricted volume, never an ephemeral serverless filesystem. The application validates the path, but cannot prove volume durability; operators must verify persistence across redeploys. Development defaults to `.data/claims` only after explicit local selection. Firestore mode requires `CLAIM_FIRESTORE_RULES_CONFIRMED=true` and never falls back if initialization or operations fail.

Local insert uses an exclusive hard link; updates use a synced temporary file and atomic same-directory rename under a cross-process per-record lock. Deletes share that lock. Lock contention fails closed (retry the request); after a crash, stop all writers and inspect/remove stale `.lock` files before recovery. Filesystem support for atomic rename/hard links and restrictive Windows ACLs must be verified by the operator. Local rate limits are per-process, not distributed; deploy an edge limit and use Firestore for multi-instance deployments.

Keys must be generated with a cryptographically secure random generator outside source control and stored only as deployment secrets. The server validates 64-hex encoding; randomness cannot be inferred from a supplied string. No public configuration or default is ever used to derive a key. Existing data encrypted under an old fallback key must be securely reissued/migrated by an operator; no automatic migration is attempted.

## Verification
`node --test tests/*.test.mjs tests/*.test.cjs` runs the complete isolated suite. Claims tests cover configuration failure, revocation-check/UID authorization, encrypted local CRUD across reopen, duplicate/missing record behavior, code preservation, corruption failure, mocked Firestore create/update semantics, and direct route Request/Response checks for every privileged action. HTTP tests invoke handlers without starting Next or loading environment files. They are not live network/Firebase integration tests.
`npm run lint` checks the project.
`node node_modules/typescript/bin/tsc --noEmit --incremental false` checks project types without a Next build. A normal Next build automatically reads environment files; do not run it when environment-file access is prohibited.
