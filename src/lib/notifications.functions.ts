import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function listNotifications() {
  const { supabase, userId } = await requireSupabaseAuth();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, metadata, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead({ data }: { data: { id?: string; all?: boolean } }) {
  const { supabase, userId } = await requireSupabaseAuth();
  const now = new Date().toISOString();
  const q = supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null);
  const { error } = data.all ? await q : await q.eq("id", data.id!);
  if (error) throw error;
  return { ok: true };
}

export async function listPriceAlerts() {
  const { supabase, userId } = await requireSupabaseAuth();
  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, ticker, condition, threshold, is_active, triggered_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ticker: z
        .string()
        .min(2)
        .max(10)
        .regex(/^[A-Z0-9]+$/),
      condition: z.enum(["above", "below"]),
      threshold: z.number().positive(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("price_alerts").insert({
      user_id: userId,
      ticker: data.ticker,
      condition: data.condition,
      threshold: data.threshold,
    });
    if (error) throw error;
    return { ok: true };
  });

  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("price_alerts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
