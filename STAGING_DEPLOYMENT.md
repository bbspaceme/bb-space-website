# Staging Environment Deployment Guide

## Overview

This guide covers deploying the BB Space Website to a staging environment using Cloudflare Workers and Supabase.

## Architecture

- **Frontend**: React + TanStack Router deployed on Cloudflare Workers
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **CDN**: Cloudflare for global distribution
- **Monitoring**: Sentry for error tracking, PostHog for analytics

## Prerequisites

1. **Cloudflare Account**: With Workers enabled
2. **Supabase Account**: For database and backend services
3. **Domain**: `staging.yourdomain.com` configured in Cloudflare
4. **GitHub Repository**: With deployment workflows

## Environment Setup

### 1. Clone and Configure

```bash
git clone https://github.com/bbspaceme/bb-space-website.git
cd bb-space-website
cp .env.staging.example .env.staging
# Edit .env.staging with your actual values
```

### 2. Supabase Setup

```bash
# Create a new Supabase project for staging
supabase projects create "bb-space-staging"
supabase link --project-ref your-staging-project-ref

# Push database schema
supabase db push

# Deploy edge functions (if any)
supabase functions deploy
```

### 3. Cloudflare Workers Setup

```bash
# Login to Cloudflare
wrangler auth login

# Configure staging environment
wrangler deploy --env staging --dry-run

# Deploy to staging
npm run deploy:staging
```

## Environment Variables

### Required Variables (.env.staging)

```bash
# Environment
NODE_ENV=staging
VITE_APP_ENV=staging

# Supabase
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key

# AI Providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-gemini-key

# Market Data
SECTORS_API_KEY=your-sectors-api-key

# Monitoring
SENTRY_DSN=your-staging-sentry-dsn
POSTHOG_KEY=your-staging-posthog-key

# Security
JWT_SECRET=your-staging-jwt-secret
```

## Deployment Workflow

### Automated Deployment (Recommended)

1. **Push to staging branch**:

   ```bash
   git checkout -b staging
   git push origin staging
   ```

2. **GitHub Actions** will automatically:
   - Run tests
   - Build for staging
   - Deploy to Cloudflare Workers
   - Run E2E tests against staging

### Manual Deployment

```bash
# Build for staging
npm run build:staging

# Deploy to Cloudflare
wrangler deploy --env staging

# Run E2E tests
npm run test:e2e -- --config=playwright.staging.config.ts
```

## DNS Configuration

Configure your staging domain in Cloudflare:

1. **Add CNAME record**: `staging.yourdomain.com` → `your-workers-subdomain.workers.dev`
2. **SSL/TLS**: Set to "Full (strict)"
3. **Page Rules**: Configure caching and security headers

## Monitoring & Observability

### Error Tracking

- **Sentry**: Automatic error reporting with staging environment tagging
- **Source Maps**: Uploaded during build for proper stack traces

### Analytics

- **PostHog**: User behavior tracking with staging data isolation
- **Custom Events**: Portfolio actions, feature usage, performance metrics

### Performance Monitoring

- **Cloudflare Analytics**: Response times, error rates, bandwidth
- **Real User Monitoring**: Core Web Vitals tracking

## Testing Strategy

### Automated Tests

```bash
# Unit tests
npm run test:run

# E2E tests against staging
npm run test:e2e -- --config=playwright.staging.config.ts

# Visual regression tests
npm run test:visual
```

### Manual Testing Checklist

- [ ] User registration/login flow
- [ ] Portfolio creation and transactions
- [ ] Market data loading
- [ ] PDF export functionality
- [ ] Mobile responsiveness
- [ ] Error boundaries
- [ ] Performance (Lighthouse score > 90)

## Rollback Strategy

### Quick Rollback

```bash
# Rollback Cloudflare deployment
wrangler deployments list --env staging
wrangler deployments rollback <deployment-id>

# Or redeploy previous version
git revert HEAD~1
git push origin staging
```

### Database Rollback

```bash
# If schema changes need rollback
supabase db reset --linked
supabase db push
```

## Security Considerations

### Staging Environment Security

- **Access Control**: Restrict staging access to team members only
- **Data Isolation**: Use separate Supabase project from production
- **API Keys**: Use staging-specific keys with limited permissions
- **Rate Limiting**: More permissive limits for testing

### Secrets Management

- **Environment Variables**: Never commit secrets to git
- **Cloudflare Secrets**: Use `wrangler secret put` for sensitive values
- **Rotation**: Regularly rotate API keys and tokens

## Troubleshooting

### Common Issues

1. **Build Failures**

   ```bash
   # Check environment variables
   wrangler secret list --env staging

   # Rebuild with verbose logging
   npm run build:staging -- --verbose
   ```

2. **Runtime Errors**

   ```bash
   # Check Cloudflare logs
   wrangler tail --env staging

   # Check Supabase logs
   supabase functions logs
   ```

3. **Database Connection Issues**

   ```bash
   # Test Supabase connection
   supabase db health

   # Check RLS policies
   supabase db diff
   ```

### Health Checks

```bash
# Application health
curl https://staging.yourdomain.com/api/health

# Database connectivity
curl https://staging.yourdomain.com/api/health/db

# External API connectivity
curl https://staging.yourdomain.com/api/health/external
```

## Performance Optimization

### Staging Optimizations

- **Source Maps**: Enabled for debugging
- **Minification**: Disabled for readable code
- **Caching**: Aggressive caching for static assets
- **Compression**: Brotli compression enabled

### Monitoring Performance

- **Core Web Vitals**: Track in staging before production
- **Bundle Analysis**: Use `npm run build:analyze` to check bundle size
- **Database Queries**: Monitor slow queries in Supabase dashboard

## Next Steps

After staging validation:

1. **Production Deployment**: Follow similar steps for production
2. **Load Testing**: Run performance tests against staging
3. **Security Audit**: Final security review
4. **Go-Live Checklist**: Complete pre-launch verification

## Support

For deployment issues:

- Check GitHub Actions logs
- Review Cloudflare Workers dashboard
- Monitor Supabase project health
- Check Sentry for application errors
