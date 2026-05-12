import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_app")({
  // Use getUser() with retry logic instead of getSession(). This avoids
  // phantom redirects during hard refresh before Supabase hydrates localStorage.
  beforeLoad: async () => {
    let user = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!user && attempts < maxAttempts) {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user && !error) {
        user = data.user;
        break;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** (attempts - 1)));
      }
    }

    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const auth = useAuth();
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
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
