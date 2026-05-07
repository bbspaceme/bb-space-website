import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TOTP, Secret } from "otpauth";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ISSUER = "KBAI Terminal";

function buildTotp(secretBase32: string, label: string) {
  return new TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const arr = new Uint8Array(5);
    crypto.getRandomValues(arr);
    codes.push(
      Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
        .match(/.{1,5}/g)!
        .join("-"),
    );
  }
  return codes;
}

export const start2faSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string })?.email ?? userId;
    const secret = new Secret({ size: 20 }).base32;
    const totp = buildTotp(secret, email);
    const otpauthUrl = totp.toString();

    // Upsert disabled record (will activate on verify)
    await supabaseAdmin
      .from("user_2fa")
      .upsert({ user_id: userId, secret, enabled: false }, { onConflict: "user_id" });

    return { secret, otpauth_url: otpauthUrl };
  });

export const verify2faSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: z.string().regex(/^\d{6}$/) }))
  .handler(async ({ context, data }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string })?.email ?? userId;
    const { data: row } = await supabaseAdmin
      .from("user_2fa")
      .select("secret, enabled")
      .eq("user_id", userId)
      .single();
    if (!row) throw new Error("Setup belum dimulai.");
    const totp = buildTotp(row.secret, email);
    const delta = totp.validate({ token: data.code, window: 1 });
    if (delta === null) throw new Error("Kode salah atau kadaluarsa.");
    const recovery = generateRecoveryCodes();
    await supabaseAdmin
      .from("user_2fa")
      .update({
        enabled: true,
        enrolled_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        recovery_codes: recovery,
      })
      .eq("user_id", userId);
    return { ok: true, recovery_codes: recovery };
  });

export const disable2fa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin.from("user_2fa").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const get2faStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_2fa")
      .select("enabled, enrolled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { enabled: !!data?.enabled, enrolled_at: data?.enrolled_at ?? null };
  });
