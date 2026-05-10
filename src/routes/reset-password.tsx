import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ResetPasswordSearch {
  type?: string;
  token_hash?: string;
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    type: search.type as string | undefined,
    token_hash: search.token_hash as string | undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" });
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if we have a valid token
  useEffect(() => {
    if (!search.type || !search.token_hash) {
      setError("Invalid reset link. Link may have expired.");
    }
  }, [search.type, search.token_hash]);

  // Redirect if already authenticated
  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      navigate({ to: "/community" });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password harus minimal 8 karakter");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password tidak cocok");
      return;
    }

    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password: password,
      });

      if (err) throw err;

      toast.success("Password berhasil diubah");
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah password";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[380px]">
        <button
          onClick={() => navigate({ to: "/login" })}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke login
        </button>

        <div className="rounded-sm border border-border bg-card">
          <div className="border-b border-border px-5 py-3.5">
            <h1 className="text-[13px] font-semibold uppercase tracking-[0.14em]">
              Reset Password Baru
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">Masukkan password baru kamu.</p>
          </div>

          <div className="px-5 py-5">
            {error && search.type !== "recovery" ? (
              <div className="space-y-4">
                <div className="flex gap-3 rounded-sm bg-red-500/10 border border-red-500/20 p-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-red-600">
                      Link tidak valid atau telah kadaluarsa
                    </p>
                    <p className="text-[11px] text-red-500/80 mt-1">{error}</p>
                  </div>
                </div>
                <Button
                  className="w-full text-[13px]"
                  onClick={() => navigate({ to: "/forgot-password" })}
                >
                  Minta Link Baru
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Password Baru
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    required
                    className="text-[13px]"
                  />
                  <p className="text-[10px] text-muted-foreground">Minimal 8 karakter</p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirm-password"
                    className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Konfirmasi Password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                    required
                    className="text-[13px]"
                  />
                </div>

                {error && search.type === "recovery" && (
                  <div className="rounded-sm bg-red-500/10 border border-red-500/20 p-2.5">
                    <p className="text-[11px] text-red-600">{error}</p>
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full text-[13px]">
                  {submitting ? "Menyimpan..." : "Simpan Password Baru"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
