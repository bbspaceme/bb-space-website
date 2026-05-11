# Environment Variables Setup

Dokumentasi untuk environment variables yang diperlukan untuk KBAI Terminal.

## Production Variables (Cloudflare Workers)

Tambahkan ke Cloudflare Secrets:

```bash
wrangler secret put CRON_SECRET
# Value: generate 32-character secret (OpenSSL: openssl rand -hex 16)

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Value: dari Supabase > Project > Settings > API Keys > service_role

wrangler secret put LOVABLE_API_KEY
# Value: dari Lovable integration
```

## Deploy Checklist

### 1. Database Migrations

```bash
# Apply indexing migration
supabase db push  # atau manual SQL di Supabase dashboard

# Verify indexes created:
# SELECT * FROM pg_indexes WHERE tablename IN ('eod_prices', 'transactions', 'audit_logs');
```

### 2. Wrangler Configuration

```bash
# Verify wrangler.jsonc has triggers configured:
cat wrangler.jsonc | grep -A 3 'triggers'
```

### 3. Test Cron Endpoint

```bash
# Manual test (sebelum deploy):
curl -X POST http://localhost:8787/api/cron/daily-refresh \
  -H "x-cron-secret: <CRON_SECRET>"

# Harus return { "success": true } atau { "skipped": true }
```

### 4. Verify Security Headers

```bash
# Check CSP dan security headers di production:
curl -I https://kbai-terminal.com/ | grep -E 'Content-Security|X-Frame|X-Content'
```

### 5. Test Incremental Holdings

```bash
# Login, buat transaksi BUY, verify tidak ada full recompute delay
# Monitor Supabase query logs:
# - Sebelum: 10+ INSERT/DELETE/SELECT calls
# - Sesudah: 1 RPC call (upsert_holding_buy)
```

## Audit Trail

Semua perubahan di-log di audit_logs:

```sql
SELECT action, entity, metadata, created_at
FROM audit_logs
WHERE action IN ('tx.buy', 'tx.sell', 'auth.login', 'auth.logout')
ORDER BY created_at DESC
LIMIT 50;
```

## Monitoring

### Cron Job Status

- Cloudflare Dashboard > Triggers > Cron Jobs — lihat execution history
- Failed runs akan terlihat di error logs

### Query Performance

- Supabase > SQL Editor > Query Performance
- Verify indexes being used: `EXPLAIN ANALYZE ...`

### Security

- Check für any CSP violations di browser DevTools > Console
- Verify rate limiting di price-alerts endpoint

## Rollback

Jika ada issue:

```bash
# Revert holdings logic (gunakan full recompute lagi):
# Edit portfolio.functions.ts — swap kembali ke computeHoldingsFromTxns loop

# Revert database indexes:
# Drop indexes via supabase/migrations/rollback SQL

# Revert env var:
wrangler secret delete CRON_SECRET
```
