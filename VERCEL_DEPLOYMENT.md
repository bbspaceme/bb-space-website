# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Ensure you have a Vercel account connected to your GitHub
2. **Environment Variables**: Set the following in Vercel dashboard:

### Required Environment Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Security
CRON_SECRET=your-cron-secret-key

# Optional API Keys
FRED_API_KEY=your-fred-api-key
LOVABLE_API_KEY=your-lovable-api-key
```

## Deployment Steps

1. **Connect Repository**: In Vercel dashboard, import your `bb-space-website` repository
2. **Configure Build Settings**:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./` (leave empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`

3. **Set Environment Variables**: Add all required variables in Vercel dashboard

4. **Deploy**: Vercel will automatically deploy on every push to `main` branch

## Troubleshooting

- **Build Fails**: Check that all environment variables are set
- **Runtime Errors**: Verify Supabase credentials and database connectivity
- **API Routes**: Ensure server functions are properly configured in `vercel.json`

## Custom Domain

To use a custom domain, configure it in Vercel dashboard under Project Settings > Domains.
