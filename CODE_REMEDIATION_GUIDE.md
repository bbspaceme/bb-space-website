# ARCHITECTURAL ANALYSIS - CODE REFERENCES & REMEDIATION GUIDE

## Issue #1: Session Hydration Race Condition

### Current Problematic Code
**File**: `src/routes/_app.tsx` (lines 1-20)
```typescript
export const Route = createFileRoute("/_app")({
  // Use getUser() not getSession(): getSession() returns null on hard refresh
  // before the browser client has restored the session from localStorage,
  // which causes a phantom redirect to /login on every reload.
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });  // ⚠️ RACES with localStorage restoration
    }
  },
  component: AppLayout,
});
```

### Root Cause Analysis
```
Hard Reload Flow:
1. Browser loads page
2. JS begins execution
3. Supabase client initializes
4. beforeLoad hook runs IMMEDIATELY
5. getUser() returns null (localStorage not restored yet)
6. REDIRECT TO /LOGIN triggered
7. Meanwhile, localStorage restoration starts (too late!)
8. User sees login page briefly, then would redirect back (if session restores)
```

### Proposed Fix (Retry Loop with Backoff)
```typescript
// src/routes/_app.tsx - PROPOSED FIX
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

async function authenticateWithRetry(maxAttempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase.auth.getUser();
    
    if (data?.user) {
      return true; // Auth successful
    }
    
    if (attempt < maxAttempts) {
      // Exponential backoff: 100ms, 200ms, 400ms
      const delayMs = 100 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return false; // All attempts failed
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const isAuthenticated = await authenticateWithRetry();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});
```

### Alternative Fix (Session State Check)
```typescript
// Monitor auth state changes instead of checking once
useEffect(() => {
  const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession);
    // Handle auth state changes
  });
  
  return () => subscription.subscription.unsubscribe();
}, []);
```

### Testing Strategy
```typescript
// playwright/tests/auth-hydration.spec.ts
import { test, expect } from "@playwright/test";

test("should not redirect to login on hard refresh when authenticated", async ({ page }) => {
  // 1. Login first
  await page.goto("/login");
  await page.fill('input[type="email"]', "test@example.com");
  await page.fill('input[type="password"]', "password");
  await page.click("button:has-text('Sign In')");
  await page.waitForURL("/_app/community");
  
  // 2. Verify session established
  const sessionData = await page.evaluate(() => 
    localStorage.getItem("sb-*-auth-token") // Supabase token pattern
  );
  expect(sessionData).toBeTruthy();
  
  // 3. Hard refresh with DevTools throttling (slow network)
  await page.context().setExtraHTTPHeaders({
    "latency": "2000", // Simulate 2s latency
  });
  await page.reload();
  
  // 4. Should still be on the same page (or after retry, get redirected)
  // Should NOT see login page flash
  expect(page.url()).toContain("_app");
});
```

---

## Issue #2: N+1 Admin Role Query

### Current Code Analyzing Problem
**File**: `src/lib/admin-middleware.ts` (lines 8-30)
```typescript
const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    const userId = ((context ?? {}) as { userId?: string }).userId;
    if (!userId) {
      throw new Response("Unauthorized: No user ID", { status: 401 });
    }

    // ⚠️ THIS QUERY RUNS FOR EVERY ADMIN API CALL
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);  // N+1 PATTERN

    if (!roles?.some((r) => String(r.role) === "admin")) {
      throw new Response("Forbidden: admin role required", { status: 403 });
    }

    return next({ ... });
  },
);
```

### Example N+1 Scenario
```
Admin calls listUsers() function:
  1. Query 1: SELECT * FROM profiles (get 100 users)
  2. Middleware query: SELECT role FROM user_roles WHERE user_id = <admin_id>
  3. Additional queries: if handler does role lookups for each user

Total: 1 + 1 (per admin call) + N (per user in response) = ~N+2 queries in a single request
```

### Solution A: Add Role Claim to JWT (RECOMMENDED)

**Step 1**: Create Supabase trigger to add role to JWT claims
```sql
-- File: supabase/migrations/20260512_add_role_to_jwt.sql
CREATE OR REPLACE FUNCTION add_role_to_jwt()
RETURNS void AS $$
BEGIN
  -- This function configures Supabase to include role in JWT token claims
  -- Add role as custom claim when token is generated
  -- Requires Supabase configuration at dashboard or via API
END;
$$ LANGUAGE plpgsql;
```

**Step 2**: Update middleware to use JWT claims instead
```typescript
// src/lib/admin-middleware.ts - UPDATED
const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    const claims = context.claims; // JWT claims already parsed by auth middleware
    const roles = claims["app_metadata"]?.roles ?? []; // Custom claim added by server
    
    if (!roles.includes("admin")) {
      throw new Response("Forbidden: admin role required", { status: 403 });
    }

    return next({ ... });
  },
);
```

**Benefits**:
- ✅ Zero database queries
- ✅ Scales to any number of users
- ✅ Token-based (cannot be bypassed)

---

### Solution B: In-Memory Cache (QUICK FIX)

```typescript
// src/lib/admin-middleware.ts - WITH CACHE
const roleCache = new Map<string, { roles: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute TTL

const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    const userId = ((context ?? {}) as { userId?: string }).userId;
    if (!userId) {
      throw new Response("Unauthorized: No user ID", { status: 401 });
    }

    // Check cache first
    const cached = roleCache.get(userId);
    const now = Date.now();
    
    if (cached && cached.expiresAt > now) {
      if (!cached.roles.includes("admin")) {
        throw new Response("Forbidden: admin role required", { status: 403 });
      }
      return next({ ... });
    }

    // Query database if cache miss
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roleArray = roles?.map(r => String(r.role)) ?? [];
    roleCache.set(userId, { roles: roleArray, expiresAt: now + CACHE_TTL_MS });

    if (!roleArray.includes("admin")) {
      throw new Response("Forbidden: admin role required", { status: 403 });
    }

    return next({ ... });
  },
);

// Invalidate cache on role changes
export function invalidateRoleCache(userId: string) {
  roleCache.delete(userId);
}
```

---

## Issue #3: Missing Database Indexes

### Indexes to Create (Immediate)
```sql
-- File: supabase/migrations/20260512_add_missing_indexes.sql

-- 2FA lookups (happens on every admin login check)
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);

-- Cash balance validation (on every transaction)
CREATE INDEX IF NOT EXISTS idx_cash_balances_user_id ON cash_balances(user_id);

-- Watchlist queries
CREATE INDEX IF NOT EXISTS idx_watchlist_user_ticker ON watchlist(user_id, ticker);

-- Settings lookups (system config reads)
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Optional: Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_ticker 
  ON transactions(user_id, ticker, transacted_at DESC);

COMMENT ON INDEX idx_user_2fa_user_id IS '2FA enabled check on every admin login';
COMMENT ON INDEX idx_cash_balances_user_id IS 'Cash validation on transaction submit';
```

### Verify Indexes Are Used
```sql
-- Check if queries use indexes (run in Supabase SQL Editor)
EXPLAIN ANALYZE
SELECT * FROM user_2fa WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
-- Should show "Index Scan on idx_user_2fa_user_id"

EXPLAIN ANALYZE
SELECT balance FROM cash_balances WHERE user_id = '550e8400-e29b-41d4-a716-446655440000';
-- Should show "Index Scan on idx_cash_balances_user_id"
```

---

## Issue #4: Missing Disaster Recovery

### Backup Strategy Setup
```bash
# 1. Enable Supabase automated backups
# Via dashboard: Project Settings → Backups → Enable Daily Backups

# 2. Test restore procedure
supabase db pull # Downloads production schema
supabase db reset # Resets local DB
supabase db seed # Re-seeds if needed

# 3. Document RTO/RPO
# RTO (Recovery Time Objective): 4 hours
# RPO (Recovery Point Objective): 24 hours (daily backup)

# 4. Create restore runbook
# See DISASTER_RECOVERY_RUNBOOK.md
```

### Disaster Recovery Runbook Template
```markdown
# Disaster Recovery Runbook

## Incident: Database Corruption or Deletion

### Detection
- Alerts trigger: database query errors > 50%
- Manual check: verify data integrity

### Immediate Response (0-30 min)
1. Declare incident in #incidents Slack channel
2. Notify on-call DBA
3. Do NOT modify database further
4. Prepare statement: "We are investigating..."

### Recovery (30 min - 4 hours)
1. Access Supabase dashboard → Backups tab
2. Identify latest good backup (before corruption time)
3. Request restore: describe exact backup point needed
4. Verify in staging first: load backup to staging, test queries
5. Perform production restore (Supabase support performs)
6. Verify all data: spot check key records

### Post-Incident
- Post-mortem: what failed?
- Improve: add safeguards
- Update runbook
```

---

## Issue #5: Missing Observability / Distributed Tracing

### Add Correlation ID Middleware
```typescript
// src/lib/correlation-id-middleware.ts - NEW FILE
import { createMiddleware } from "@tanstack/react-start";
import { generateUUID } from "./utils";

export const correlationIdMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const correlationId = (context as any)._correlationId || generateUUID();
    
    const response = await next({
      context: {
        ...context,
        correlationId,
      },
    });

    if (response instanceof Response) {
      response.headers.set("X-Correlation-ID", correlationId);
      response.headers.set("X-Request-ID", correlationId);
    }

    return response;
  },
);

// Add to all createServerFn handlers:
export const exampleFunction = createServerFn({ method: "GET" })
  .middleware([correlationIdMiddleware, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { correlationId } = context;
    
    // Log with correlation ID
    console.log(`[${correlationId}] User action start`);
    
    // ... handler code ...
    
    console.log(`[${correlationId}] User action complete`);
  });
```

### Add Structured Logging
```typescript
// src/lib/structured-logger.ts - NEW FILE
interface LogContext {
  correlationId: string;
  userId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export function logStructured(level: "info" | "warn" | "error", context: LogContext) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    correlationId: context.correlationId,
    userId: context.userId,
    action: context.action,
    metadata: context.metadata,
    service: "kbai-terminal",
    environment: process.env.NODE_ENV,
  };

  // Log to console (and should forward to log aggregation service)
  console.log(JSON.stringify(logEntry));

  // Forward to Sentry
  if (level === "error") {
    Sentry.captureMessage(context.action, {
      level: "error",
      tags: { correlationId: context.correlationId },
      contexts: { metadata: context.metadata },
    });
  }
}

// Usage:
logStructured("info", {
  correlationId: context.correlationId,
  userId: context.userId,
  action: "transaction.submit",
  metadata: { ticker: "TLKM", side: "BUY", amount: 10000000 },
});
```

---

## Issue #6: Low Test Coverage

### Priority Test Suite (Phase 1)
```typescript
// src/__tests__/portfolio.business-logic.test.ts
import { describe, it, expect } from "vitest";
import { computeHoldingsFromTxns } from "@/lib/portfolio.functions";

describe("Portfolio Business Logic", () => {
  describe("computeHoldingsFromTxns", () => {
    it("should calculate holdings from BUY transactions", () => {
      const txns = [
        { ticker: "TLKM", side: "BUY", lot: 10, price: "3500" },
        { ticker: "TLKM", side: "BUY", lot: 5, price: "3600" },
      ];
      
      const holdings = computeHoldingsFromTxns(txns);
      
      expect(holdings).toEqual([
        { ticker: "TLKM", total_lot: 15, avg_price: 3533.3333 },
      ]);
    });

    it("should calculate avg price correctly after partial SELL", () => {
      const txns = [
        { ticker: "GOOGL", side: "BUY", lot: 100, price: "2000" },
        { ticker: "GOOGL", side: "SELL", lot: 30, price: "2500" },
      ];
      
      const holdings = computeHoldingsFromTxns(txns);
      
      expect(holdings[0].total_lot).toBe(70);
      expect(holdings[0].avg_price).toBe(2000); // Avg price unchanged
    });

    it("should remove holdings when all shares sold", () => {
      const txns = [
        { ticker: "TSLA", side: "BUY", lot: 50, price: "200" },
        { ticker: "TSLA", side: "SELL", lot: 50, price: "300" },
      ];
      
      const holdings = computeHoldingsFromTxns(txns);
      
      expect(holdings).toHaveLength(0); // No holdings remain
    });
  });
});
```

### Priority Test Suite (Phase 2)
```typescript
// src/__tests__/auth.integration.test.ts
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should prevent unauthorized access to admin pages", async ({ page }) => {
    // Try to access /admin without logging in
    await page.goto("/_app/admin");
    
    // Should redirect to login
    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });

  test("should enforce 2FA for admin accounts", async ({ page }) => {
    // Login with admin account WITHOUT 2FA
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@kbai.local");
    await page.fill('input[type="password"]', "Admin#2026!");
    await page.click("button:has-text('Sign In')");
    
    // Should redirect to 2FA setup, not dashboard
    await page.waitForURL("/_app/settings");
    expect(page.url()).toContain("/settings");
  });
});
```

---

## Quick Reference: Files to Inspect

| Issue | File | Lines | Action |
|-------|------|-------|--------|
| Session race | `src/routes/_app.tsx` | 10-15 | Add retry logic |
| N+1 roles | `src/lib/admin-middleware.ts` | 8-30 | Cache or JWT claims |
| Missing indexes | `supabase/migrations/` | N/A | Create new migration |
| No backups | Supabase dashboard | N/A | Enable backups |
| Missing tests | `src/__tests__/` | N/A | Add test files |
| No tracing | `src/lib/` | N/A | Add middleware |

---

**Report Generated**: 2026-05-11  
**For Questions**: Refer to `ARCHITECTURE_EXPLORATION_SUMMARY.md` and `ARCHITECTURAL_ANALYSIS.json`
