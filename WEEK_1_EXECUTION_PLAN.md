# IMMEDIATE ACTION ITEMS - BB SPACE CTO AUDIT

## Week 1 Execution Plan

**Generated**: May 11, 2026  
**Status**: READY FOR IMMEDIATE IMPLEMENTATION  
**Time Budget**: ~40 hours (Week 1)  
**Owner**: Engineering Leadership

---

## 🔴 TIER 1: PRODUCTION BLOCKERS (Do First)

### Action 1.1: Fix Session Hydration Race Condition

**Effort**: 2-3 hours  
**Owner**: Backend engineer  
**Impact**: Eliminates "phantom login" redirects

**Root Cause**:

```typescript
// CURRENT PROBLEM (src/routes/_app.tsx)
export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
});
```

Race condition: `getUser()` called before localStorage hydration completes.

**Solution**:

```typescript
// FIXED VERSION
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [100, 200, 400]; // Exponential backoff

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (data?.user) {
          return; // Success!
        }

        if (error) {
          lastError = error;
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }

    // All retries exhausted - actually not authenticated
    throw redirect({ to: "/login" });
  },
});
```

**Implementation Checklist**:

- [ ] Update `src/routes/_app.tsx` with retry logic
- [ ] Test with DevTools network throttling (Slow 3G)
- [ ] Hard refresh 20 times - should NOT redirect to login
- [ ] Test on mobile network simulator
- [ ] Commit and push

**Testing Script** (in browser console on authenticated page):

```javascript
for (let i = 0; i < 20; i++) {
  console.log(`Test ${i}: Hard refresh...`);
  setTimeout(() => location.reload(true), i * 1000);
}
// Should NOT see login page
```

---

### Action 1.2: Add Missing Database Indexes

**Effort**: 30 minutes  
**Owner**: DBA / Backend engineer  
**Impact**: 5-10x faster 2FA/cash/watchlist operations

**Current State**:
Recent migrations (20260510) added indexes, but these are still missing.

**SQL to Execute**:

```sql
-- From your Supabase dashboard or CLI:

-- Index 1: User 2FA lookups
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id
ON user_2fa(user_id);

-- Index 2: Cash balance lookups
CREATE INDEX IF NOT EXISTS idx_cash_balances_user_id
ON cash_balances(user_id);

-- Index 3: Watchlist queries (commonly filtered by user+ticker)
CREATE INDEX IF NOT EXISTS idx_watchlist_user_ticker
ON watchlist(user_id, ticker);

-- Index 4: System settings lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key
ON system_settings(key);

-- Run immediately in production (safe operation)
```

**Via Supabase CLI**:

```bash
# Create migration file
supabase migration new add_missing_indexes

# Edit supabase/migrations/[timestamp].sql
# Paste SQL above

# Deploy
supabase db push
```

**Verification**:

```sql
-- Confirm indexes exist
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_user_2fa%'
   OR indexname LIKE 'idx_cash_balances%'
   OR indexname LIKE 'idx_watchlist%'
   OR indexname LIKE 'idx_system_settings%';
```

---

### Action 1.3: Verify Disaster Recovery (Enable Backups)

**Effort**: 1-2 hours (includes testing)  
**Owner**: DevOps / Backend engineer  
**Impact**: **CRITICAL** - Protects all customer data

**Current State**: Unclear if backups enabled

**Step 1: Enable Supabase Automated Backups**

```bash
# Check backup status
supabase backup list --project-id <your-project-id>

# If not enabled, enable:
supabase backup enable --project-id <your-project-id>
```

**Step 2: Document RTO/RPO Targets**

Create file: `docs/DISASTER_RECOVERY.md`

```markdown
# Disaster Recovery Plan

## RTO/RPO Targets

**RTO (Recovery Time Objective)**: 4 hours

- Maximum acceptable downtime

**RPO (Recovery Point Objective)**: 24 hours

- Maximum acceptable data loss

## Backup Strategy

- Automated daily backups via Supabase
- Retained for 30 days
- Tested monthly via restoration to staging

## Restoration Procedure

1. Identify desired backup timestamp
2. In Supabase dashboard: Backups → [date] → Restore
3. Choose destination (original or new project)
4. Test restored data in staging
5. Verify all transactions replayed
6. Swap DNS to restored instance

## Contact

On-call: [contact info]
```

**Step 3: Test Restoration**

```sql
-- Schedule test: do this at 9 AM on first Monday of each month

-- Example: Restore from 24 hours ago
-- In Supabase dashboard:
-- 1. Click "Backups"
-- 2. Select backup from 24 hours ago
-- 3. Click "Restore"
-- 4. Restore to "bb-space-website-test" project
-- 5. Run this query on restored database:

SELECT COUNT(*) as transaction_count, MAX(created_at) as latest_transaction
FROM transactions;

-- Compare to production to verify data is there
```

**Commit & Document**:

- [ ] Enable backups in Supabase dashboard
- [ ] Create `docs/DISASTER_RECOVERY.md`
- [ ] Schedule monthly restoration test (calendar reminder)
- [ ] Add to deployment checklist

---

### Action 1.4: Investigate Vercel Deployment Error

**Effort**: 1-4 hours (depends on root cause)  
**Owner**: Backend / DevOps engineer  
**Impact**: Enables deployments

**Step 1: Check Vercel Function Logs (5 min)**

```
Dashboard → Deployments → [Most recent] → "Function Logs"
Look for red error messages
```

**Common Errors & Fixes**:

**Error: "Cannot find module '@supabase/supabase-js'"**

- Cause: Build failed
- Fix: Run `npm run build` locally, debug errors

**Error: "SUPABASE_URL is undefined"**

- Cause: Missing environment variable
- Fix: Add to Vercel Settings → Environment Variables

**Error: "Refused to load the script..."**

- Cause: CSP header too restrictive
- Fix: Update `vercel.json` CSP policy

**Error: "Cannot GET /api/entry"**

- Cause: Build output structure mismatch
- Fix: Verify `dist/` folder has `api/entry` file

**Step 2: Verify Environment Variables** (5 min)

Required vars (check Vercel dashboard):

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SENTRY_DSN=https://...@sentry.io/...
```

**Step 3: Test Build Locally** (10 min)

```bash
# Install dependencies
npm ci

# Build
npm run build

# Preview locally
npm run preview

# Visit http://localhost:3000
# Test: Login, navigate, check browser console for errors
```

**Step 4: If Still Failing**

Try Cloudflare Workers deployment (already configured):

```bash
npm run deploy:prod
```

**Root Cause Investigation Checklist**:

- [ ] Check Vercel Function Logs
- [ ] Verify all env vars in Vercel dashboard
- [ ] Test `npm run build && npm run preview` locally
- [ ] Check browser DevTools Console for CSP violations
- [ ] If needed, contact Vercel support with function logs URL
- [ ] Fallback: Deploy to Cloudflare Workers instead

---

## 🟠 TIER 2: OBSERVABILITY FOUNDATION (Do Week 1-2)

### Action 2.1: Add Correlation ID Middleware

**Effort**: 2-3 hours  
**Owner**: Backend engineer  
**Impact**: Cannot debug production issues without this

**What is correlation ID?**
A UUID that tracks a single request through the entire system:

```
User Action → Frontend logs: req-123 → Backend logs: req-123 → DB logs: req-123
```

This makes tracing errors across layers possible.

**Implementation**:

Create file: `src/lib/correlation-id.ts`

```typescript
import { createMiddleware } from "@tanstack/react-start";
import { randomUUID } from "crypto";

export function correlationIdMiddleware() {
  return createMiddleware({ type: "function" }).server(async (ctx) => {
    // Extract from request header or generate new
    const correlationId = ctx.request?.headers?.get("x-correlation-id") || randomUUID();

    // Add to context
    ctx.correlationId = correlationId;

    // Call next middleware
    const response = await ctx.next();

    // Add to response headers
    if (response instanceof Response) {
      response.headers.set("x-correlation-id", correlationId);
    }

    return response;
  });
}

// Hook for logging
export function useCorrelationId() {
  return typeof globalThis !== "undefined" && "correlationId" in globalThis
    ? (globalThis as any).correlationId
    : "unknown";
}
```

**Apply to all API routes**:

Update `src/lib/portfolio.functions.ts` (example):

```typescript
export const submitTransaction = createServerFn({ method: "POST" })
  .middleware([
    correlationIdMiddleware(), // ← ADD THIS
    attachSupabaseAuth,
    requireSupabaseAuth,
    rateLimitMiddleware(),
  ])
  .inputValidator(
    z.object({
      /* ... */
    }),
  )
  .handler(async (input) => {
    const correlationId = useCorrelationId();
    console.log(`[${correlationId}] Transaction submitted:`, input);

    // Rest of handler...
  });
```

**Testing**:

```bash
# Deploy to staging
npm run deploy:staging

# Make API call
curl -H "X-Correlation-ID: test-123" \
  https://staging.example.com/api/submit-transaction

# Check logs - should see "test-123" in response header
```

**Add to Sentry Context**:

```typescript
// In error-capture.ts
import Sentry from "@sentry/react";

Sentry.setContext("request", {
  correlation_id: useCorrelationId(),
});
```

---

### Action 2.2: Increase Sentry Sample Rate

**Effort**: 30 minutes  
**Owner**: Backend engineer  
**Impact**: 50% of errors now visible (vs 10%)

**Current**: 10% sample rate = 90% of errors invisible  
**Target**: 50% sample rate = 50% of errors tracked

**How to Fix**:

Find in `src/server.ts` or `src/start.ts`:

```typescript
// CURRENT
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1, // ← CHANGE THIS
  // ...
});

// FIXED
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.5, // ← 50% sample rate
  // ...
});
```

**Deploy & Verify**:

```bash
npm run build
npm run deploy

# Create test error
# Verify it appears in Sentry dashboard within 5 minutes
```

---

### Action 2.3: Structured Logging

**Effort**: 3-4 hours  
**Owner**: Backend engineer  
**Impact**: Logs are queryable and aggregatable

**Current State**: `console.error("message")` (unstructured)

**Target**: JSON format (searchable)

```json
{
  "timestamp": "2026-05-11T10:23:45.123Z",
  "level": "error",
  "message": "Transaction submission failed",
  "correlation_id": "req-abc123",
  "user_id": "user-xyz",
  "error": "Insufficient cash balance",
  "context": { "amount": 500000, "available": 250000 },
  "stack_trace": "..."
}
```

**Implementation**:

Create file: `src/lib/logger.ts`

```typescript
interface LogContext {
  userId?: string;
  correlationId?: string;
  [key: string]: any;
}

export function logError(message: string, context?: LogContext) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      ...context,
    }),
  );
}

export function logWarn(message: string, context?: LogContext) {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      ...context,
    }),
  );
}

export function logInfo(message: string, context?: LogContext) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      ...context,
    }),
  );
}
```

**Usage**:

```typescript
import { logError } from "@/lib/logger";

try {
  // some operation
} catch (error) {
  logError("Operation failed", {
    correlationId: req.correlationId,
    userId: req.userId,
    error: error instanceof Error ? error.message : String(error),
    context: {
      /* relevant data */
    },
  });
}
```

---

## 🟡 TIER 3: QUALITY FOUNDATION (Do Week 2-3)

### Action 3.1: Create Initial Test Suite

**Effort**: 1 week  
**Owner**: QA engineer  
**Target**: 40% coverage

**High-Priority Tests** (in order of ROI):

1. **Portfolio Calculations** (Days 1-2, 20+ tests)

```typescript
// src/lib/__tests__/portfolio.test.ts
import { describe, it, expect } from "vitest";
import { computeHoldingsFromTxns } from "../portfolio.functions";

describe("Portfolio Calculations", () => {
  it("should calculate holdings from BUY transaction", () => {
    const holdings = computeHoldingsFromTxns([
      { ticker: "BBCA", side: "BUY", lot: 100, price: 500 },
    ]);

    expect(holdings).toEqual([
      {
        ticker: "BBCA",
        total_lot: 100,
        avg_price: 500,
      },
    ]);
  });

  it("should handle SELL reducing position", () => {
    const holdings = computeHoldingsFromTxns([
      { ticker: "BBCA", side: "BUY", lot: 100, price: 500 },
      { ticker: "BBCA", side: "SELL", lot: 30, price: 600 },
    ]);

    expect(holdings[0].total_lot).toBe(70);
  });

  it("should close position when fully sold", () => {
    const holdings = computeHoldingsFromTxns([
      { ticker: "BBCA", side: "BUY", lot: 100, price: 500 },
      { ticker: "BBCA", side: "SELL", lot: 100, price: 600 },
    ]);

    expect(holdings.length).toBe(0);
  });
});
```

2. **Transaction Validation** (Days 3-4, 15+ tests)

```typescript
// src/routes/api/portfolio/submit-transaction.test.ts
import { describe, it, expect } from "vitest";
import { submitTransaction } from "../submit-transaction";

describe("Transaction Submission", () => {
  it("should reject BUY when insufficient cash", async () => {
    expect(() =>
      submitTransaction({
        userId: "test-user",
        ticker: "BBCA",
        side: "BUY",
        lot: 100,
        price: 500, // Needs 50,000 cash
        cash_available: 25000, // Only have 25k
      }),
    ).toThrow("Insufficient cash");
  });
});
```

3. **Auth/RBAC** (Days 5, 10+ tests)

```typescript
// src/lib/__tests__/admin-middleware.test.ts
describe("Admin Middleware", () => {
  it("should allow admin users", async () => {
    // Mock admin user
    // Should NOT throw error
  });

  it("should block non-admin users", async () => {
    // Mock regular user
    // Should throw "Not authorized"
  });
});
```

**Running Tests**:

```bash
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:coverage # Coverage report
```

**Coverage Target**: 40% = ~200 test lines

---

## 📋 DEPLOYMENT CHECKLIST

Before each production deploy:

- [ ] All critical env vars set in Vercel dashboard
- [ ] Session hydration fix deployed
- [ ] Database indexes verified
- [ ] Disaster recovery runbook tested this month
- [ ] Sentry sample rate at 50%
- [ ] No merge conflicts in code
- [ ] E2E tests passing

---

## ✅ SUCCESS CRITERIA FOR WEEK 1

- [ ] **Day 2 EOD**: Session race condition fixed + tested
- [ ] **Day 3 EOD**: Vercel deployment root cause identified (and fixed or documented)
- [ ] **Day 3 EOD**: Database indexes added
- [ ] **Day 4 EOD**: Disaster recovery enabled + documented
- [ ] **Day 5 EOD**: Correlation ID middleware in place
- [ ] **EOW**: Sentry sample rate increased to 50%
- [ ] **Monday**: First 20 test cases passing

---

## 📞 IF YOU GET STUCK

**Session hydration won't fix**
→ Check browser DevTools Network tab, look for auth network requests, verify timing

**Vercel won't deploy**
→ Post in #deployment Slack with error message + Vercel URL, reach out to Vercel support

**Database migration fails**
→ Revert: `supabase db push --revert`, check error message, fix SQL

**Tests not running**
→ Verify node_modules: `rm -rf node_modules && npm ci`

---

**Next Checkpoint**: Friday 4 PM (EOW standup to review progress)
