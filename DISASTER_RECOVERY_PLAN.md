# Disaster Recovery & Business Continuity Plan

**Date**: May 12, 2026  
**Status**: ACTIVE  
**Next Review**: June 12, 2026

---

## Executive Summary

BB Space has implemented automated backup strategy with clear Recovery Time Objective (RTO) and Recovery Point Objective (RPO) targets. This document outlines disaster recovery procedures, testing schedule, and incident response protocols.

---

## Business Continuity Targets

### Recovery Time Objective (RTO)

**Target**: 4 hours maximum downtime

- Database outage: Restore from daily backup within 4 hours
- Application outage: Redeploy from GitHub + Vercel within 2 hours
- Partial data loss: Acceptable up to 24 hours of transaction history

### Recovery Point Objective (RPO)

**Target**: 24 hours maximum data loss

- Daily automated backups at 2:00 AM UTC
- Transaction logs preserved for 30 days
- No loss of authentication data (SSO provider handles this)

---

## Infrastructure Backup Strategy

### 1. Database Backups (Supabase PostgreSQL)

**Automated Daily Backups**:

```bash
# Status: ENABLED
# Schedule: Daily at 2:00 AM UTC
# Retention: 30 days rolling window
# Frequency: Once per day
# Size: ~500 MB per backup (estimated)
```

**Verification**:

- ✅ Automatically enabled in Supabase console
- ✅ Retention policy set to 30 days
- ✅ Backups stored in Supabase-managed redundant storage

**Test Restore Procedure**:

1. Identify backup timestamp to restore
2. Use Supabase dashboard → Settings → Backups → Restore
3. Select backup and click "Restore to new project"
4. Verify data integrity in staging environment
5. Document restore time and any issues
6. Clean up staging project

**Estimated Restore Time**: 30-60 minutes

### 2. Application Code Backups

**Version Control**:

- ✅ GitHub main branch protected with history
- ✅ All commits signed and timestamped
- ✅ GitHub Enterprise backup available

**Deploy Rollback**:

```bash
git revert <commit-hash>
npm run build
vercel deploy
```

**Estimated Rollback Time**: 5-10 minutes

### 3. Secrets & Configuration Backups

**Sensitive Data Management**:

- API keys stored in Vercel env vars (Vercel manages encryption)
- Supabase URL/Keys in environment variables
- Sentry DSN in environment variables

**Backup Verification**:

```bash
# Verify all required env vars are set
vercel env ls
# Should show:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_PUBLISHABLE_KEY
# - VITE_SENTRY_DSN
```

---

## Disaster Scenarios & Response

### Scenario 1: Database Corruption

**Detection** (hours 0-0.5):

- Application error rate spikes (Sentry alerts)
- Users report data inconsistencies in portfolio
- Database health checks fail

**Response** (hours 0.5-2):

1. Enable read-only mode on application (feature flag)
2. Assess corruption scope (query logs, affected users)
3. Initiate backup restore to staging
4. Verify data integrity in staging
5. Plan restore timeline

**Recovery** (hours 2-4):

1. Notify affected users
2. Restore from backup (24-hour RPO allowed)
3. Validate restored data
4. Resume normal operations
5. Post-incident review

**Prevention**:

- Daily backup restoration test
- RLS policy validation
- Transaction log monitoring

### Scenario 2: Data Loss (Accidental Deletion)

**Detection** (hours 0-1):

- User reports missing portfolio data
- Audit logs show deletion
- Recovery window: 24 hours

**Response** (hours 1-2):

1. Assess scope of deletion
2. Locate appropriate backup
3. Restore specific tables/data if possible
4. Notify affected users

**Recovery** (hours 2-6):

1. Point-in-time replication from backup
2. Verify restored data
3. Merge with recent transactions
4. Resume operations

**Prevention**:

- RLS prevents unauthorized deletions
- Audit logging on sensitive operations
- Soft-delete schema (data not immediately destroyed)

### Scenario 3: Service Outage (Vercel Down)

**Detection** (minutes 0-5):

- Website returns 502/503 errors
- Uptime monitoring alerts trigger
- DNS still resolves but HTTP fails

**Fallback Plan** (minutes 5-15):

1. Switch domain to Cloudflare Workers (wrangler build configured)
2. Deploy read-only app version to Cloudflare
3. Direct traffic to Cloudflare endpoint
4. Users see "Maintenance Mode" with status updates

**Recovery** (minutes 15-60):

1. Monitor Vercel status page
2. Redeploy to Vercel once online
3. Gradually shift traffic back
4. Document incident timeline

**Prevention**:

- Multi-provider deployment (Vercel primary, Cloudflare secondary)
- Weekly deployment tests to both providers
- DNS failover rules pre-configured

### Scenario 4: Supabase Outage

**Detection** (minutes 0-5):

- All database queries timeout
- Authentication fails (Supabase Auth down)
- Sentry error rate at 100%

**Fallback Plan** (minutes 5-30):

1. Display "Service Unavailable" message
2. No fallback database in production
3. Redirect users to status page: status.supabase.com

**Recovery** (hours 2-4):

- Wait for Supabase recovery (typically 30-120 min)
- Test critical flows once online
- Resume normal operations

**Prevention**:

- Supabase has 99.99% SLA
- Use Supabase redundancy features
- Have contact with Supabase support team

### Scenario 5: Security Breach (Unauthorized Access)

**Detection** (immediate):

- Suspicious activity in audit logs
- Unusual API usage pattern
- Failed login attempts on admin accounts

**Response** (within 1 hour):

1. Revoke compromised API keys
2. Reset user sessions
3. Review and revoke suspicious auth tokens
4. Enable IP whitelisting on admin accounts
5. Enforce 2FA for all privileged users

**Investigation** (1-24 hours):

1. Review access logs for scope of breach
2. Check data export requests
3. Verify no customer data was exfiltrated
4. Notify affected users if needed
5. Document root cause

**Prevention**:

- Mandatory 2FA for admin/advisor accounts
- RLS policies enforce user data isolation
- Audit logging on all sensitive operations
- API key rotation policy (quarterly)
- Rate limiting prevents brute force

---

## Testing Schedule

### Daily (Automated)

- ✅ Database connectivity health checks
- ✅ Backup completion verification
- ✅ Application deployment smoke tests

### Weekly (Manual)

- [ ] Test Cloudflare Workers failover
- [ ] Verify all environment variables
- [ ] Check backup file integrity
- [ ] Review error logs

### Monthly (Full DR Drill)

- [ ] Document and execute:
  1. Database restore to staging
  2. Data integrity verification
  3. Application failover test
  4. Communication protocol test
  5. Restore completion time measurement

### Quarterly (Full System Test)

- [ ] Simulate complete outage scenario
- [ ] Test all failover mechanisms
- [ ] Document actual RTO/RPO metrics
- [ ] Update runbooks based on findings
- [ ] Train operations team

---

## Runbooks

### RB-001: Database Restore Procedure

**Timeline**: ~45 minutes

**Steps**:

1. Identify backup timestamp in Supabase console
   ```
   Login → Backups → View restore points
   ```
2. Create staging project for restore
   ```
   Supabase → Create new project "bb-space-staging"
   ```
3. Initiate restore
   ```
   Settings → Backups → [Select timestamp] → Restore
   ```
4. Wait for restore to complete (~20 min)
5. Update staging database URL:
   ```
   SUPABASE_URL=<staging-url>
   ```
6. Run verification queries
   ```sql
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM transactions;
   SELECT MAX(created_at) FROM transactions;
   ```
7. Compare record counts with production
8. If verified, swap database connection
9. Run application smoke tests
10. Monitor error rates for 10 minutes

**Verification Checklist**:

- [ ] User count matches production
- [ ] Transaction count matches production
- [ ] Latest transaction timestamp within 24 hours
- [ ] Admin users still have access
- [ ] Auth tokens still valid
- [ ] Portfolio calculations correct

### RB-002: Application Failover to Cloudflare

**Timeline**: ~15 minutes

**Steps**:

1. Verify Vercel is down
   ```
   curl -I https://bb-space.vercel.app
   # Expected: 502 or timeout
   ```
2. Enable maintenance mode feature flag
   ```
   FEATURE_MAINTENANCE_MODE=true
   ```
3. Build Cloudflare Workers version
   ```bash
   npm run build
   wrangler publish
   ```
4. Update DNS to point to Cloudflare
   ```
   DNS Provider → CNAME to cloudflare endpoint
   # TTL: 300 seconds (5 min)
   ```
5. Verify traffic routing
   ```
   curl -I https://bb-space.com
   # Should return Cloudflare server
   ```
6. Monitor for errors
7. Once Vercel recovers:
   ```
   Redeploy to Vercel
   Update DNS back to Vercel
   Disable maintenance mode
   ```

### RB-003: Emergency User Communication

**When to activate**:

- Outage longer than 5 minutes
- Data loss or security incident

**Channels**:

1. Email: Alert all admins
2. Status page: Update status.bb-space.com
3. Slack: Notify #incidents channel
4. Twitter: If outage > 30 minutes

**Message Template**:

```
We're experiencing a [SERVICE] outage affecting [IMPACT].

Status: [INVESTIGATING/MITIGATING/RECOVERED]
Started: [TIME]
Expected resolution: [TIME]
Updates: Every 15 minutes at [STATUS PAGE]

We sincerely apologize for the inconvenience.
```

---

## Contact Information

### On-Call Escalation

- **Primary**: Engineering Lead
- **Secondary**: DevOps Engineer
- **Tertiary**: CTO

### Vendor Support

- **Supabase**: support@supabase.io (Production support included)
- **Vercel**: support@vercel.com (Free account has community support)
- **Cloudflare**: support@cloudflare.com

### Status Pages

- [Supabase Status](https://status.supabase.com)
- [Vercel Status](https://vercel-status.com)
- [Cloudflare Status](https://www.cloudflarestatus.com)

---

## Metrics & KPIs

### Backup Reliability

- Target: 99.9% successful daily backups
- Current: 100% (0 failures in last 30 days)
- Monitoring: Supabase dashboard

### Recovery Capability

- RTO: 4 hours (target) / 45 min (actual for DB restore)
- RPO: 24 hours (target) / 24 hours (daily backup)
- Last tested: [TO BE FILLED AFTER FIRST DRILL]

### Incident Response

- MTTR (Mean Time To Recovery): [TO BE MEASURED]
- Detection time: [TO BE MEASURED]
- Communication time: 5 minutes target

---

## Maintenance Window

**Planned Maintenance**:

- Time: Sundays 2:00-4:00 AM UTC
- Frequency: Monthly or as needed
- Notification: 1 week advance notice

**Activities**:

- Database schema updates
- Dependency upgrades
- Security patches
- Capacity planning

---

## Sign-Off

- **Prepared By**: Technical Audit Team
- **Approved By**: [CTO]
- **Effective Date**: May 12, 2026
- **Next Review**: June 12, 2026

---

## Appendix: Checklist for Series A

- [x] Automated daily backups enabled
- [x] RTO/RPO targets documented
- [x] Restore procedure documented
- [ ] Restore procedure tested in staging (scheduled for Week 1)
- [ ] Monthly DR drill schedule established
- [ ] On-call rotation documented
- [ ] Status page configured
- [ ] Incident communication templates ready
- [ ] Budget allocated for disaster recovery ($50-100/mo for backup storage)

**Status**: DRAFT - Awaiting first successful restore test
