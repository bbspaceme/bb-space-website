import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_app")({
  // Use getUser() not getSession(): getSession() returns null on hard refresh
  // before the browser client has restored the session from localStorage,
  // which causes a phantom redirect to /login on every reload.
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
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
