# CRITICAL ISSUES BRIEFING

**BB Space Website - KBAI Terminal**  
**Generated**: May 11, 2026

---

## 🔴 TIER 1: PRODUCTION BLOCKERS (Address Before GA)

### Issue #1: Login Phantom Redirect (User Impact: HIGH)

**Location**: `src/routes/_app.tsx:10-15`  
**Symptom**: Users intermittently kicked to `/login` on page reload  
**Cause**: Session hydration race condition

```typescript
// CURRENT (problematic):
const { data, error } = await supabase.auth.getUser();
if (error || !data.user) throw redirect({ to: "/login" }); // Runs before localStorage restored
```

**Fix Required**: Implement retry logic with exponential backoff
**Effort**: 2-3 hours  
**Test**: Browser devtools network throttle + hard refresh

---

### Issue #2: Missing Observability (Operational Impact: CRITICAL)

**Symptom**: Cannot diagnose production issues—no correlation IDs, no structured logs  
**Components Missing**:

- ❌ Distributed tracing (request correlation)
- ❌ Structured request/response logging
- ❌ Error aggregation dashboard
- ❌ Performance SLI tracking
- ❌ Real-time alerting

**Current State**: Sentry at 10% sample rate (90% of errors invisible!)  
**Fix Required**:

1. Add correlation ID middleware
2. Implement structured logging (JSON format)
3. Set up error aggregation dashboard
4. Increase Sentry sample rate to 50%+
   **Effort**: 2-3 days  
   **Impact**: Enables production support

---

### Issue #3: Vercel Deployment Broken (Operational Impact: HIGH)

**Location**: Documented in `VERCEL_DEPLOYMENT.md` but root cause not analyzed  
**Probable Causes**:

1. Environment variables missing (check Vercel dashboard)
   - Required: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
2. CSP headers blocking external APIs
   - Header: `Content-Security-Policy` in `vercel.json` may be too restrictive
3. API route rewrite mismatch
   - `vercel.json` catch-all rewrite to `/api/entry` may not match actual handler

**Investigation Steps**:

```bash
# 1. Check Vercel logs
# Dashboard → Deployments → [recent] → Function Logs

# 2. Test build locally
npm run build
npm run preview

# 3. Check CSP violations
# DevTools → Console → look for "Refused to connect" or "Blocked by CSP"

# 4. Verify env vars
# Dashboard → Settings → Environment Variables
# Must have ALL: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
```

**Effort**: 2-4 hours (mostly investigation)

---

## 🟠 TIER 2: PERFORMANCE DEGRADATION (Address in Sprint 1)

### Issue #4: N+1 Admin Role Queries (Performance Impact: MEDIUM)

**Location**: `src/lib/admin-middleware.ts`  
**Query**: `SELECT role FROM user_roles WHERE user_id = ?` runs on EVERY admin API call  
**Example**: List admin users triggers:

- 1 query to get users
- 1 query per admin operation to check admin role
- Total: N queries for N users

**Fix Options**:

1. **Option A** (Best): Add role claim to Supabase JWT token
   - One-time configuration in Supabase
   - Role available in token without DB query
2. **Option B** (Quick): Cache in-memory with TTL
   - Cache role lookup for 5 minutes
   - Invalidate on role change

**Effort**: Option A = 2 hrs setup, Option B = 4-6 hrs implementation  
**Performance Gain**: 80% reduction in admin queries

---

### Issue #5: Missing Database Indexes (Query Performance: MEDIUM)

**Add** these indexes immediately:

```sql
CREATE INDEX idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX idx_cash_balances_user_id ON cash_balances(user_id);
CREATE INDEX idx_watchlist_user_ticker ON watchlist(user_id, ticker);
CREATE INDEX idx_system_settings_key ON system_settings(key);
```

**Effort**: 30 minutes  
**Impact**: 5x-10x faster 2FA lookups, cash balance checks

---

## 🔴 TIER 3: ENTERPRISE GAPS (Address Before Fund Release)

### Issue #6: Zero Disaster Recovery Plan

**Missing**:

- ❌ Backup automation
- ❌ RTO/RPO targets
- ❌ Database replication
- ❌ Restored procedure documented

**Risk**: Complete data loss possible if Supabase experiences outage  
**Fix**:

```bash
# Enable Supabase automated backups
supabase database backups enable --project-id <project_id>

# Document RTO/RPO
# RTO target: 4 hours (restore from last backup)
# RPO target: 24 hours (lose <1 day of data)

# Create runbook: "How to restore from backup"
```

**Effort**: 1 day  
**Priority**: URGENT before production traffic

---

### Issue #7: <5% Test Coverage (Quality Impact: HIGH)

**Current Tests**: 2 smoke tests only  
**Missing**:

- Unit tests for portfolio calculations
- Integration tests for transaction flow
- Auth/RBAC tests
- Error scenario tests

**Target for Next Sprint**: 40% coverage  
**High-Priority Tests**:

1. Portfolio calculation accuracy (BUY/SELL ledger)
2. Transaction validation (cash/holdings checks)
3. Admin access control (unauthorized requests blocked)
4. 2FA flow (setup, verification, disable)

**Effort**: 3-5 days for initial suite  
**Test Framework**: Vitest (already configured)

---

## 📊 IMPACT SUMMARY

| Issue                    | Severity    | User Impact       | Operator Impact     | Fix Effort |
| ------------------------ | ----------- | ----------------- | ------------------- | ---------- |
| Login phantom redirect   | 🔴 CRITICAL | Kicked to login   | High support burden | 3 hrs      |
| Missing observability    | 🔴 CRITICAL | Can't get support | Can't debug issues  | 2-3 days   |
| Vercel deployment broken | 🔴 CRITICAL | Can't deploy      | Can't release       | 2-4 hrs    |
| N+1 role queries         | 🟠 HIGH     | Slow admin pages  | Ops cost high       | 4-6 hrs    |
| Missing indexes          | 🟠 HIGH     | Slow 2FA login    | DB overload risk    | 30 min     |
| No disaster recovery     | 🔴 CRITICAL | Data loss risk    | Compliance fail     | 1 day      |
| <5% test coverage        | 🟠 HIGH     | Regressions       | Manual QA burden    | 3-5 days   |

---

## 🚨 IMMEDIATE ACTION ITEMS

### Day 1 (3-4 hours)

- [ ] Investigate Vercel deployment root cause
- [ ] Add missing database indexes
- [ ] Add correlation ID middleware

### Days 2-3 (2-3 days)

- [ ] Fix session hydration race condition
- [ ] Enable Supabase automated backups
- [ ] Set up error aggregation dashboard

### Days 4-5 (1-2 days)

- [ ] Cache admin roles in JWT or memory
- [ ] Add initial test suite (40% coverage target)

---

## 📞 Questions for Engineering Team

1. **Session Race**: Has this been reported by users? Can you reproduce with network throttling?
2. **Vercel Logs**: What error message appears in Vercel Function logs?
3. **Disaster Recovery**: Has data loss ever occurred? What's the backup strategy currently?
4. **Observability**: What's the process for debugging production issues today?
5. **Testing**: Why is test coverage so low? Are there intentional reasons?

---

**Next Steps**:

1. Assign TIER 1 items to sprint immediately
2. Create incident response runbook
3. Schedule production readiness review
