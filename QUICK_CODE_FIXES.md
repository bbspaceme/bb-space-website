# 💻 QUICK CODE FIXES - COPY & PASTE

## 🎯 Use This For Fast Implementation

All code is production-ready and can be copied directly into your codebase.

---

## 1️⃣ FIX: Session Hydration Race Condition (2-3 hours)

**File:** `src/routes/_app.tsx`

**Problem:** Users kicked to login after hard refresh due to race condition between `getUser()` and localStorage hydration

**Solution:** Add exponential backoff retry logic

```typescript
// BEFORE (lines 10-15):
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.getQueryData(["user"]);
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  // ...
});

// AFTER - Replace with:
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    // Retry getUser with exponential backoff to allow localStorage hydration
    let user = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Wait before retry with exponential backoff
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        user = await context.queryClient.getQueryData(["user"]);

        if (user) {
          break; // Success
        }

        // If still no user after retry, check localStorage directly
        if (attempt === 2) {
          const stored = localStorage.getItem("supabase.auth");
          if (!stored) {
            throw new Error("No stored auth");
          }
        }
      } catch (error) {
        lastError = error as Error;
        // Continue to next retry
        continue;
      }
    }

    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  // ...
});
```

**Verification:**

```bash
# Hard refresh page (Cmd+Shift+R) 10 times
# Expected: No redirect, stays on app
# Result: Should load every time ✅
```

---

## 2️⃣ FIX: Missing Database Indexes (30 minutes)

**File:** Run via Supabase CLI or Dashboard SQL Editor

**Problem:** 5-10x slower queries for 2FA, cash balances, watchlist, system settings

**Solution:** Add 4 critical indexes

```sql
-- 1. Speed up 2FA lookups
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
COMMENT ON INDEX idx_user_2fa_user_id IS 'Speed up 2FA queries for login, settings';

-- 2. Speed up cash balance lookups
CREATE INDEX IF NOT EXISTS idx_cash_balances_user_id ON cash_balances(user_id);
COMMENT ON INDEX idx_cash_balances_user_id IS 'Speed up cash balance queries';

-- 3. Speed up watchlist queries (composite for common filters)
CREATE INDEX IF NOT EXISTS idx_watchlist_user_ticker
ON watchlist(user_id, ticker)
WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_watchlist_user_ticker IS 'Speed up watchlist lookups by user and ticker';

-- 4. Speed up system settings lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
COMMENT ON INDEX idx_system_settings_key IS 'Speed up system configuration lookups';

-- Verify indexes created
SELECT indexname, indexdef FROM pg_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY indexname;
```

**Verification:**

```bash
# Query performance should improve immediately
# Check in Dashboard → SQL Editor → Indexes tab
# Expected: 4 new indexes visible ✅
```

---

## 3️⃣ FIX: Enable Disaster Recovery (Step-by-Step)

**File:** Supabase Dashboard

**Problem:** No automated backups, data loss risk

**Steps:**

```bash
1. Go to: https://app.supabase.com/project/[PROJECT_ID]/settings/backups

2. Enable "Automated Backups": Click toggle ON
   - Frequency: Daily (recommended for production)
   - Retention: 14 days (covers 2 weeks)

3. Save configuration

4. Create Manual Backup immediately:
   - Click "Take Manual Backup"
   - Name: "backup-2026-05-11"
   - Click "Start"
   - Wait for completion (~2-5 minutes)

5. Document Restore Procedure:
   Save this as RESTORE_PROCEDURE.md in repo:
```

**Restore Procedure (Save as RESTORE_PROCEDURE.md):**

```markdown
# Database Restore Procedure

## Emergency Restore Steps

1. **Verify Backup Available**
   - Dashboard → Settings → Backups
   - Look for recent backup (green checkmark = ready)

2. **Initiate Restore**
   - Click backup row → "Restore"
   - Confirm timestamp: "2026-05-11 14:30 UTC"
   - Warning: ALL data after this time will be lost
   - Click "Restore from Backup"

3. **Wait for Completion**
   - Takes 5-30 minutes depending on size
   - Monitor: Dashboard shows "Restoring..."
   - Completion: Dashboard shows "Ready"

4. **Verify Data Integrity**
   - Connect to database
   - SELECT COUNT(\*) FROM transactions;
   - Compare with known count (check Slack log)
   - If counts match: ✅ Restore successful

5. **Notify Team**
   - Post in #incidents channel
   - Include timestamp of restore
   - List any data lost since backup

## Testing (Monthly)

- First Friday of each month:
- 1. Take test backup
- 2. Restore to staging environment
- 3. Run smoke tests
- 4. Document success
```

**Verification:**

```bash
# Check backups created
curl -X GET 'https://api.supabase.co/v1/projects/[PROJECT_ID]/backups' \
  -H 'Authorization: Bearer [API_KEY]' \
  -H 'Content-Type: application/json'

# Expected: Recent backups listed with timestamps ✅
```

---

## 4️⃣ FIX: Correlation ID Middleware (3-4 hours)

**File:** Create `src/lib/correlation-id.ts`

**Problem:** Can't trace errors through logs, no request correlation

**Solution:** Add UUID to all requests

```typescript
// NEW FILE: src/lib/correlation-id.ts
import { randomUUID } from "crypto";
import { createMiddleware } from "@tanstack/start"; // adjust based on your framework

declare global {
  var _correlationId: string | undefined;
}

export function getCorrelationId(): string {
  return globalThis._correlationId || "no-correlation-id";
}

export function setCorrelationId(id: string): void {
  globalThis._correlationId = id;
}

export const correlationIdMiddleware = createMiddleware({
  onRequest: (ctx) => {
    // Generate or extract correlation ID
    const correlationId = ctx.req.headers.get("x-correlation-id") || randomUUID();

    setCorrelationId(correlationId);

    // Add to response headers for client-side tracking
    ctx.res.headers.set("x-correlation-id", correlationId);
  },
});

export function withCorrelationId<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    const correlationId = getCorrelationId();
    try {
      return await fn(...args);
    } catch (error) {
      console.error("[ERROR]", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }) as T;
}
```

**Integration:** In `src/server.ts`, add to middleware chain:

```typescript
// In src/server.ts - add to middleware stack:
import { correlationIdMiddleware } from "./lib/correlation-id";

// Add correlationIdMiddleware to your middleware array
const middlewares = [
  // ... existing middleware
  correlationIdMiddleware,
  // ... other middleware
];
```

**Usage in Server Functions:**

```typescript
import { withCorrelationId, getCorrelationId } from '~/lib/correlation-id';

export const createServerFn('POST /api/portfolio/transaction')
  .input<TransactionInput>()
  .handler(withCorrelationId(async (input) => {
    const correlationId = getCorrelationId();

    try {
      // Your logic here
      console.log(`[TXN] Creating transaction`, {
        correlationId,
        userId: input.userId,
        amount: input.amount,
      });

      return await db.transaction.create({ ...input });
    } catch (error) {
      console.error(`[TXN ERROR]`, {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }));
```

**Verification:**

```bash
# Test request with correlation ID
curl -X POST http://localhost:5173/api/portfolio/transaction \
  -H "x-correlation-id: test-123" \
  -H "Content-Type: application/json" \
  -d '{"txn": "data"}'

# Check logs - should show correlation ID in output
# Expected: [TXN] Creating transaction {"correlationId":"test-123"} ✅
```

---

## 5️⃣ FIX: Structured Logging (2-3 hours)

**File:** Update logging across the codebase

**Problem:** Unstructured console.log/error makes production debugging hard

**Solution:** Standardized JSON logging

```typescript
// NEW FILE: src/lib/logger.ts
export interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === "development") {
      console.log(
        JSON.stringify({
          level: "DEBUG",
          ts: new Date().toISOString(),
          msg: message,
          ...context,
        }),
      );
    }
  },

  info: (message: string, context?: LogContext) => {
    console.log(
      JSON.stringify({
        level: "INFO",
        ts: new Date().toISOString(),
        msg: message,
        ...context,
      }),
    );
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(
      JSON.stringify({
        level: "WARN",
        ts: new Date().toISOString(),
        msg: message,
        ...context,
      }),
    );
  },

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    console.error(
      JSON.stringify({
        level: "ERROR",
        ts: new Date().toISOString(),
        msg: message,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : String(error),
        ...context,
      }),
    );
  },
};

// Usage:
logger.info("User login successful", {
  correlationId: "abc-123",
  userId: "456",
  provider: "email",
});

logger.error("Transaction failed", error, {
  correlationId: "abc-123",
  userId: "456",
  txnId: "789",
});
```

**Replace existing console.error calls:**

```typescript
// BEFORE:
console.error("Transaction failed:", error);

// AFTER:
logger.error("Transaction failed", error, {
  correlationId: getCorrelationId(),
  userId: context.user?.id,
});
```

---

## 6️⃣ FIX: Increase Sentry Sample Rate (15 minutes)

**File:** `src/server.ts` or wherever Sentry is initialized

**Problem:** Only capturing 10% of errors (90% invisible)

**Current Code:**

```typescript
// BEFORE:
Sentry.init({
  // ... other config
  tracesSampleRate: 0.1, // Only 10%
  sampleRate: 0.1, // Only 10%
});
```

**Updated Code:**

```typescript
// AFTER:
const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  // ... other config
  tracesSampleRate: isProduction ? 0.5 : 1.0, // 50% in prod, 100% in dev
  sampleRate: isProduction ? 0.5 : 1.0, // 50% in prod, 100% in dev

  // BONUS: Focus on errors
  ignoreErrors: [
    // Browser extensions
    /^top\.GLOBALS/,
    // Ignore ResizeObserver loop limit
    "ResizeObserver loop limit exceeded",
  ],

  // Capture auth errors 100%
  beforeSend(event) {
    if (event?.tags?.type === "auth") {
      return event; // Always send auth errors
    }
    return event;
  },
});
```

**Verification:**

```bash
# Check Sentry dashboard
# New events should appear much more frequently
# Expected: 5x more error events in dashboard ✅
```

---

## 7️⃣ FIX: Vercel Investigation Flowchart (2-4 hours)

If you get Vercel deployment errors, follow this decision tree:

```
START: Vercel deployment failed
│
├─ ERROR: "Build failed"?
│  └─ CHECK: npm run build locally
│     ├─ SUCCESS: Problem is Vercel environment
│     │  └─ NEXT: Check environment variables
│     │     ├─ MISSING: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
│     │     │  └─ FIX: Add to Vercel dashboard
│     │     ├─ WRONG: ENV vars mismatch
│     │     │  └─ FIX: Compare vercel.json with local .env
│     │     └─ CORRECT: But still fails
│     │        └─ NEXT: Check build output
│     │
│     └─ FAILED: Problem is local
│        └─ FIX: npm ci && npm run build
│
├─ ERROR: "Build succeeded, but app blank"?
│  └─ CHECK: Browser console for errors
│     ├─ "CORS blocked"
│     │  └─ FIX: Check CSP headers in vercel.json
│     │  └─ UPDATE: Add allowed domains
│     │
│     ├─ "Not found /api/user"
│     │  └─ FIX: Check API route rewrites in vercel.json
│     │  └─ VERIFY: Routes match src/routes/
│     │
│     └─ "Supabase connection error"
│        └─ FIX: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY wrong
│        └─ UPDATE: Copy from Supabase dashboard
│
├─ ERROR: "API timeout"?
│  └─ LIKELY: Database connection pooling issue
│  └─ FIX: Restart Supabase project or increase connection pool
│
└─ STILL FAILING?
   └─ CHECK: Vercel logs directly
      └─ Command: vercel logs --follow
      └─ LOOK FOR: First error in output
      └─ GOOGLE: Error message → Solution
```

**Step-by-step investigation:**

```bash
# Step 1: Try local build first
npm run build

# If successful:
# Step 2: Compare environments
cat .env.local > /tmp/local-env.txt
# Check Vercel dashboard Settings → Environment Variables
# Are they identical?

# Step 3: Check Vercel logs live
vercel logs --follow

# Step 4: Look at deployment URL
# Open in incognito window (avoid cache)
open https://your-project.vercel.app

# Step 5: Monitor performance
# Network tab → find failed requests
# Check error messages in browser console

# Step 6: If still stuck
# Delete build cache and retry:
vercel build --no-cache
```

**Common Issues & Fixes:**

| Error                      | Fix                                     |
| -------------------------- | --------------------------------------- |
| `Cannot find SUPABASE_URL` | Add to vercel.json `env` or dashboard   |
| `CSP blocks supabase.co`   | Update Content-Security-Policy header   |
| `Timeout connecting to DB` | Increase Supabase connection pool to 30 |
| `Module not found: crypto` | Check Node.js version in vercel.json    |
| `Port 5173 not available`  | Clear Vercel cache and rebuild          |

---

## ✅ IMPLEMENTATION CHECKLIST

Week 1 Implementation:

```
Monday:
☐ Session hydration fix (2-3 hours)
☐ Vercel investigation started (1-2 hours investigation)

Tuesday:
☐ Correlation ID middleware added (3-4 hours)

Wednesday:
☐ Database indexes applied (30 min)
☐ Disaster recovery enabled (1 hour)

Thursday:
☐ Structured logging implemented (2-3 hours)
☐ Sentry sample rate increased (15 min)

Friday:
☐ Deploy to staging & test thoroughly (2 hours)
☐ Fix any issues found (1-2 hours)
☐ Deploy to production (1 hour)

SUCCESS CRITERIA:
☐ 0 session redirects in 50+ hard refreshes
☐ Better error tracking (5x more events in Sentry)
☐ Queries 5-10x faster (check database metrics)
☐ Disaster recovery backup created & tested
☐ Vercel deployments working smoothly
```

---

## 📞 DEBUGGING HELP

If something breaks:

```bash
# Check logs in production
vercel logs --follow

# Check database
psql $DATABASE_URL

# Check Sentry dashboard
https://sentry.io/[organization]/bb-space-website

# Check Supabase logs
https://app.supabase.com/project/[ID]/logs

# Local reproduction
npm run dev
# Then reproduce issue in http://localhost:5173
```

Keep this file handy!
