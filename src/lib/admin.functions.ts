import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { authedMiddleware } from "@/lib/with-auth";
import { insertAuditLog } from "@/lib/audit.functions";
import { adminAuthMiddleware } from "@/lib/admin-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================
// AUDIT LOGS — DUP-03: Consolidated implementation
// ============================================
export async function writeAuditLog(data: {
  username?: string;
  action: string;
  entity?: string;
  entity_id?: string;
  metadata?: Record<string, Json>;
  user_agent?: string;
}) {
  // For SPA mode, we need to get user from auth context
  const { supabase, userId } = await requireSupabaseAuth();
  await insertAuditLog({
    ...data,
    user_id: userId,
  });
  return { ok: true };
}

export async function adminListAuditLogs(
  data: {
    limit?: number;
    action?: string;
    user_id?: string;
  } = {},
) {
  // For SPA mode, we need admin auth
  const { userId } = await requireSupabaseAuth();
  // DUP-04: userId is from authenticated context, not client input
  let q = supabaseAdmin
    .from("audit_logs")
    .select(
      "id, user_id, username, action, entity, entity_id, metadata, ip_address, user_agent, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(data.limit || 200);
  if (data.action) q = q.eq("action", data.action);
  if (data.user_id) q = q.eq("user_id", data.user_id);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export async function recordSession(data: {
  username?: string;
  device_label?: string;
  user_agent?: string;
}) {
  const { supabase, userId } = await requireSupabaseAuth();

  if (data.user_agent) {
    await supabaseAdmin
      .from("user_sessions")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("user_agent", data.user_agent)
      .eq("is_active", true);
  }
  const { data: row, error } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id: userId,
      username: data.username ?? null,
      device_label: data.device_label ?? null,
      user_agent: data.user_agent ?? null,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { session_id: row.id };
}

export async function adminListSessions(
  data: {
    only_active?: boolean;
    limit?: number;
  } = {},
) {
  // For SPA mode, we need admin auth
  const { userId } = await requireSupabaseAuth();
  let q = supabaseAdmin
    .from("user_sessions")
    .select(
      "id, user_id, username, device_label, user_agent, ip_address, is_active, last_seen_at, created_at, ended_at",
    )
    .order("last_seen_at", { ascending: false })
    .limit(data.limit || 200);
  if (data.only_active) q = q.eq("is_active", true);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export async function adminRevokeSession(data: { session_id: string }) {
  // For SPA mode, we need admin auth
  const { userId } = await requireSupabaseAuth();
  const { error } = await supabaseAdmin
    .from("user_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("id", data.session_id);
  if (error) throw new Error(error.message);
  // Note: cannot force-logout the browser remotely, but session is marked revoked
  return { ok: true };
}

// ============================================
// SYSTEM SETTINGS
// ============================================
export async function adminListSystemSettings() {
  // For SPA mode, we need admin auth
  const { userId } = await requireSupabaseAuth();
  const { data: rows, error } = await supabaseAdmin
    .from("system_settings")
    .select("key, value, updated_at")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export async function adminUpdateSystemSetting(data: { key: string; value: Json }) {
  const { userId } = await requireSupabaseAuth();
  const { error } = await supabaseAdmin.from("system_settings").upsert(
    {
      key: data.key,
      value: data.value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ============================================
// SMF / Reksadana scraping (pasardana.id)
// ============================================
export async function adminGetMutualFundNav(data: { fund_id?: string } = {}) {
  // Pasardana exposes a public chart JSON endpoint
  const url = `https://pasardana.id/api/Fund/GetFundNavData?id=${data.fund_id || "2057"}&period=1Y`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 KBAITerminal/1.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `pasardana returned ${res.status}`, data: [] };
    }
    const json = (await res.json()) as Array<{ Date: string; Nav: number }> | { data?: unknown };
    const arr = Array.isArray(json)
      ? json
      : Array.isArray((json as { data?: unknown }).data)
        ? (json as { data: Array<{ Date: string; Nav: number }> }).data
        : [];
    return {
      ok: true,
      count: arr.length,
      data: arr.slice(-30).map((r) => ({ date: r.Date?.slice(0, 10), nav: r.Nav })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch failed",
      data: [],
    };
  }
}

// Aliases for backward compatibility
export const adminListSettings = adminListSystemSettings;
export const adminUpdateSetting = adminUpdateSystemSetting;
export const fetchSmfNav = adminGetMutualFundNav;
