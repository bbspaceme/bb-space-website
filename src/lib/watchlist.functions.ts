import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export async function getWatchlist() {
  const { supabase, userId } = await requireSupabaseAuth();
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, ticker, note, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addToWatchlist(data: { ticker: string; note?: string }) {
  const { supabase, userId } = await requireSupabaseAuth();
  const { error } = await supabase.from("watchlist").insert({
    user_id: userId,
    ticker: data.ticker.toUpperCase(),
    note: data.note ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removeFromWatchlist(data: { id: string }) {
  const { supabase, userId } = await requireSupabaseAuth();
  const { error } = await supabase.from("watchlist").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
