# Landing Page to Login Connection

## Overview
Landing page (`/`) sudah mengintegrasikan koneksi ke halaman login (`/login`) melalui:

1. **Navbar Login Button** — Di desktop, tombol "Login" di kanan navbar
2. **Hero CTA Button** — "Lihat Intelligence Panel" mengarah ke `/request-access`
3. **Responsive Mobile Menu** — Login button tersedia di menu mobile

## Components Architecture

### Landing Components (`src/components/landing-upgraded/`)
```
index.tsx (main page)
├── Navbar.tsx (fixed nav dengan Login button)
├── Hero.tsx (hero section, CTA buttons)
├── Footer.tsx
└── landing.types.ts (type definitions)
```

### Login Route (`src/routes/login.tsx`)
- Standalone login page dengan form validasi
- Post-login redirect ke `/community` (dashboard)
- Audit logging & session recording

## User Flow

```
┌─────────────────┐
│  Landing Page   │  /
│      (/)        │
└────────┬────────┘
         │
    [Click Login]
       ↓
┌─────────────────┐
│  Login Page     │  /login
│   (form)        │
├─────────────────┤
│ Email/Password  │───→ Supabase Auth
└────────┬────────┘
         │
    [Sign In]
       ↓
┌─────────────────┐
│  Community      │ /_app
│  Dashboard      │
│  (Role-based)   │
└─────────────────┘
```

## Account Types & Role-Based Navigation

### 1. Admin Account
**Email**: `admin@kbai.local`
**Password**: `Admin#2026!`
**Menu Levels**:
- Administration (Users, Settings, Market Data, Transactions)
- Compliance (Audit Logs, Security)
- Personal (Activity, Settings)

### 2. Advisor Account
**Email**: `kaizen@gmail.com`
**Password**: `kaizen123`
**Menu Levels**:
- Market (Dashboard, Market Insight, Watchlist)
- Research (Analisis, Ekonomi, Insight modules)
- Advisory Operations (Holdings, User Portfolios, Broadcast)
- Personal (Activity, Settings)

### 3. Member/User Account
**Email**: `alwi@gmail.com`
**Password**: `alwi123`
**Menu Levels**:
- Workspace (Dashboard, Portfolio, Watchlist, Market Insight)
- Research (Analisis, Ekonomi)
- Personal (Activity, Settings)

## Navigation Structure

### Role-Based Nav Groups

Located in `src/components/app-shell.tsx`:

#### MEMBER_GROUPS (Regular Investor)
```
Workspace/
├── Dashboard (Community)
├── Portfolio
├── Watchlist
└── Market Insight

Research/
├── Analisis
└── Ekonomi

Personal/
├── Activity
└── Settings
```

#### ADVISOR_GROUPS (Financial Advisor)
```
Market/
├── Dashboard (Community)
├── Market Insight
└── Watchlist

Research/
├── Analisis
├── Ekonomi
├── Insight
└── Insight AI

Advisory Operations/
├── Holdings Analysis
├── User Portfolios
└── Broadcast

Personal/
├── Activity
└── Settings
```

#### ADMIN_GROUPS (System Administrator)
```
Overview/
└── Dashboard

Administration/
├── Users
├── System Settings
├── Market Data
└── Transactions

Compliance/
├── Audit Log
└── Security & Sessions

Personal/
├── Activity
└── Settings
```

## Technical Implementation

### Auth Context (`src/auth.tsx`)
```ts
interface AuthState {
  isAuthenticated: boolean    // Logged in?
  isLoading: boolean          // Fetching role?
  user: User | null           // Supabase user
  session: Session | null     // Auth session
  username: string | null     // From profiles table
  isAdmin: boolean            // From user_roles
  isAdvisor: boolean          // From user_roles
  signIn: (email, password) => Promise<void>
  signOut: () => Promise<void>
  refreshRole: () => Promise<void>
}
```

### Route Protection (`src/routes/_app.tsx`)
```ts
export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    // Check if user is authenticated via Supabase
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });  // Redirect to login
    }
  },
  component: AppLayout,
});
```

### Auth Loading State
```tsx
if (auth.isLoading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-card">
          <Activity className="h-4 w-4 animate-pulse text-foreground" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Loading…
        </span>
      </div>
    </div>
  );
}
```

## Sidebar Navigation Selection

The sidebar dynamically renders nav groups based on user role:

```tsx
const navGroups = auth.isAdmin 
  ? ADMIN_GROUPS 
  : auth.isAdvisor 
    ? ADVISOR_GROUPS 
    : MEMBER_GROUPS;
```

Route detection updates header title:
```ts
const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/community": { title: "Community Dashboard", subtitle: "KBAI · IHSG · GOLD" },
  "/portfolio": { title: "Portfolio", subtitle: "Holdings & transactions" },
  "/admin/users": { title: "Administration", subtitle: "User Management" },
  // ... etc
};
```

## Styling & Theme

- Light mode support via HTML class toggle
- Dark mode (default)
- Claude/okLCH color system for AUM/Holdings/P/L charts
- Responsive design: mobile drawer menu + desktop sidebar

## Audit & Logging

All login/logout events logged:

```ts
// On login (login.tsx):
await recordSession({ data: { username, user_agent } });
await writeAuditLog({ data: { username, action: "auth.login", user_agent } });

// On logout (app-shell.tsx):
await writeAuditLog({ data: { username, action: "auth.logout", user_agent } });
queryClient.clear();  // Clear cache
window.location.href = "/login";  // Hard redirect
```

Query: `SELECT * FROM audit_logs WHERE action LIKE 'auth.%' ORDER BY created_at DESC;`

## Next Steps

1. **Deploy database migrations** (indexes + stored procedures)
2. **Test login with all 3 account types**
3. **Verify role-based menu switching**
4. **Monitor audit logs** for auth events
5. **Check performance** on transaction submit (should be faster with incremental updates)

---

**Last Updated**: 2026-05-10 | **Status**: ✅ Ready for deployment
