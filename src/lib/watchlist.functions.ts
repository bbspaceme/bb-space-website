import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authedMiddleware } from "@/lib/with-auth";

export const listWatchlist = createServerFn({ method: "GET" })
  .middleware(authedMiddleware)
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watchlist")
      .select("id, ticker, note, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWatchlist = createServerFn({ method: "POST" })
  .middleware(authedMiddleware)
  .inputValidator(z.object({ ticker: z.string().min(1).max(10), note: z.string().max(200).optional() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist")
      .insert({ user_id: context.userId, ticker: data.ticker.toUpperCase(), note: data.note ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWatchlist = createServerFn({ method: "POST" })
  .middleware(authedMiddleware)
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("watchlist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });