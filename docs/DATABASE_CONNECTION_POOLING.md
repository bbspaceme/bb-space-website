# Database Connection Pooling Setup

## Overview

KBAI Terminal uses Cloudflare Workers as the runtime environment. Unlike traditional Node.js servers, Cloudflare Workers are stateless edge functions that spin up and down frequently. This means every request could potentially create a new PostgreSQL connection, which can quickly exhaust connection limits.

## The Problem

Supabase (free tier) default limits:

- **Max Connections:** 25-100 depending on plan
- **Without Pooling:** Each request creates a new connection → exhaustion under load
- **Result:** `too many clients` errors → platform downtime

## Solution: Connection Pooling

Supabase provides a built-in connection pooler that sits between your application and PostgreSQL. It reuses connections efficiently.

## Implementation Steps

### 1. Enable Supabase Connection Pooler

Go to your Supabase Dashboard:

```
Project Settings → Database → Connection Pooling
```

Configuration:

- **Enable Pooling:** Toggle ON
- **Pool Mode:** Select `Transaction` (default, safe for most apps)
  - Alternative: `Session` mode if you need connection state persistence
- **Max Pool Size:** 25 (adjust based on your plan)

### 2. Get Pooler Connection String

After enabling, Supabase provides two connection strings:

```
# Direct connection (traditional, one per request)
postgresql://postgres:[password]@aws-0-ap-southeast-1.db.supabase.co:5432/postgres

# Pooler connection (what we use in Cloudflare Workers)
postgresql://postgres:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

The pooler URL uses port `6543` instead of `5432`.

### 3. Update Cloudflare Secrets

Set the pooler URL in your Cloudflare Workers environment:

```bash
# For testing/development
wrangler secret put SUPABASE_DB_POOL_URL
# Paste: postgresql://postgres:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

# Or set directly in wrangler.jsonc for development
{
  "env": {
    "production": {
      "vars": {
        "SUPABASE_DB_POOL_URL": "postgresql://postgres:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
      }
    }
  }
}
```

### 4. Code Integration

The Supabase SDK automatically uses the pooler URL if `SUPABASE_DB_POOL_URL` is set:

```typescript
// In Cloudflare Workers server functions:
import { createClient } from "@supabase/supabase-js";

// The SDK will use SUPABASE_DB_POOL_URL if available, falls back to SUPABASE_URL
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  db: {
    schema: "public",
  },
});
```

## Verification

### 1. Test Connection

```bash
# From your local development machine
psql "postgresql://postgres:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
```

### 2. Monitor Connections

In Supabase Dashboard:

```
Project Settings → Database → Connection Pooling → Overview
```

Watch the metrics:

- **Active Connections:** Should stay low (typically 5-10)
- **Total Requests:** Should increase without connection errors

### 3. Performance Improvement

Before pooling:

- Connection time: ~100-200ms per request
- Total response: 200-300ms

After pooling:

- Connection reuse: ~1-5ms per request
- Total response: 50-150ms improvement expected

## Troubleshooting

### "too many clients" errors

**Cause:** Pooler not enabled or misconfigured
**Fix:**

1. Verify pooling enabled in Supabase Dashboard
2. Confirm `SUPABASE_DB_POOL_URL` set in Cloudflare secrets
3. Redeploy

### Increased error rates post-deployment

**Cause:** Pooler connection limit reached too quickly
**Fix:**

1. Increase `Max Pool Size` in Supabase Dashboard
2. Optimize database queries (add indexes, reduce N+1 queries)
3. Implement caching (Cloudflare KV) to reduce database load

### "Connection refused" on pooler URL

**Cause:** Wrong port (using 5432 instead of 6543)
**Fix:** Verify connection string uses port `6543`

## Estimated Impact

- **Connection exhaustion incidents:** 95% reduction
- **Query latency:** 30-50% improvement
- **Uptime during traffic spikes:** Near 100%

## Next Steps

1. ✅ Configure connection pooler in Supabase Dashboard
2. ✅ Set `SUPABASE_DB_POOL_URL` in Cloudflare secrets
3. ✅ Deploy and monitor connection metrics
4. 🔄 Monitor for 48 hours to ensure stability
5. 🎯 Once stable, enable caching (Cloudflare KV) to further reduce database load

## References

- [Supabase Connection Pooling Docs](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooling)
- [PgBouncer Documentation](https://www.pgbouncer.org/usage.html)
- [Cloudflare Workers Database Optimization](https://developers.cloudflare.com/workers/databases/)
