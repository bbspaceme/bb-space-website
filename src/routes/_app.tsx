import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
