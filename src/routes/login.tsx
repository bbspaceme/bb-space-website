import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/auth";
import { recordSession, writeAuditLog } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [today, setToday] = useState<string>("");
  useEffect(() => { setToday(format(new Date(), "dd MMM yyyy")); }, []);

  // If already authenticated, redirect (side effect, not during render)
  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      navigate({ to: "/community" });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await auth.signIn(username.trim(), password);
      // Record session + audit (best-effort, non-blocking failure)
      try {
        const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
        if (data.user) {
          await Promise.all([
            recordSession({
              data: {
                user_id: data.user.id,
                username: username.trim(),
                user_agent: navigator.userAgent,
              },
            }).catch(() => null),
            writeAuditLog({
              data: {
                user_id: data.user.id,
                username: username.trim(),
                action: "auth.login",
                user_agent: navigator.userAgent,
              },
            }).catch(() => null),
          ]);
        }
      } catch {
        /* swallow */
      }
      toast.success("Berhasil masuk");
      // Wait briefly for auth state to propagate
      window.location.href = "/community";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login gagal";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-card">
            <Activity className="h-4 w-4 text-foreground" />
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-wide">KBAI Terminal</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Keluarga Besar Awas Indeks
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-border bg-card">
          <div className="border-b border-border px-5 py-3.5">
            <h1 className="text-[13px] font-semibold uppercase tracking-[0.14em]">
              Sign in
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Akses dengan kredensial yang diberikan admin.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3.5 px-5 py-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="h-9 rounded-sm border-border bg-background text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-9 rounded-sm border-border bg-background text-[13px]"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 w-full rounded-sm bg-foreground text-[12px] font-semibold uppercase tracking-[0.14em] text-background hover:bg-foreground/90"
            >
              {submitting ? "Authenticating…" : "Sign in"}
            </Button>
          </form>
          <div className="border-t border-border px-5 py-3 text-center">
            <a
              href="https://t.me/eLsavador1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Send className="h-3 w-3" />
              Hubungi Admin · Telegram @eLsavador1
            </a>
          </div>
        </div>

        <div className="mt-4 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Session · secure</span>
          <span suppressHydrationWarning>{today || "—"}</span>
        </div>
      </div>
    </div>
  );
}
