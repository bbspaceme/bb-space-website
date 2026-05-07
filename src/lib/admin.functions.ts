import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function assertAdmin(admin_user_id: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", admin_user_id);
  if (!roles?.some((r) => String(r.role) === "admin")) {
    throw new Error("Forbidden: admin role required");
  }
}

// ============================================
// AUDIT LOGS
// ============================================
export const writeAuditLog = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      user_id: z.string().uuid().optional(),
      username: z.string().max(100).optional(),
      action: z.string().min(1).max(80),
      entity: z.string().max(80).optional(),
      entity_id: z.string().max(120).optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      user_agent: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: data.user_id ?? null,
      username: data.username ?? null,
      action: data.action,
      entity: data.entity ?? null,
      entity_id: data.entity_id ?? null,
      metadata: data.metadata ?? {},
      user_agent: data.user_agent ?? null,
    });
    return { ok: true };
  });

export const adminListAuditLogs = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      admin_user_id: z.string().uuid(),
      limit: z.number().int().min(1).max(500).default(200),
      action: z.string().max(80).optional(),
      user_id: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.admin_user_id);
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, user_id, username, action, entity, entity_id, metadata, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============================================
// SESSIONS / DEVICE TRACKING
// ============================================
export const recordSession = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      username: z.string().max(100).optional(),
      device_label: z.string().max(120).optional(),
      user_agent: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    // End previous active sessions for the same user_agent (one device = one active row)
    if (data.user_agent) {
      await supabaseAdmin
        .from("user_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("user_id", data.user_id)
        .eq("user_agent", data.user_agent)
        .eq("is_active", true);
    }
    const { data: row, error } = await supabaseAdmin
      .from("user_sessions")
      .insert({
        user_id: data.user_id,
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
  });

export const adminListSessions = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      admin_user_id: z.string().uuid(),
      only_active: z.boolean().default(false),
      limit: z.number().int().min(1).max(500).default(200),
    }),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.admin_user_id);
    let q = supabaseAdmin
      .from("user_sessions")
      .select("id, user_id, username, device_label, user_agent, ip_address, is_active, last_seen_at, created_at, ended_at")
      .order("last_seen_at", { ascending: false })
      .limit(data.limit);
    if (data.only_active) q = q.eq("is_active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminRevokeSession = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      admin_user_id: z.string().uuid(),
      session_id: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.admin_user_id);
    const { error } = await supabaseAdmin
      .from("user_sessions")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    // Note: cannot force-logout the browser remotely, but session is marked revoked
    return { ok: true };
  });

// ============================================
// SYSTEM SETTINGS
// ============================================
export const adminListSettings = createServerFn({ method: "POST" })
  .inputValidator(z.object({ admin_user_id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await assertAdmin(data.admin_user_id);
    const { data: rows, error } = await supabaseAdmin
      .from("system_settings")
      .select("key, value, updated_at")
      .order("key", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateSetting = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      admin_user_id: z.string().uuid(),
      key: z.string().min(1).max(80),
      value: z.any(),
    }),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.admin_user_id);
    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert(
        {
          key: data.key,
          value: data.value,
          updated_by: data.admin_user_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================
// SMF / Reksadana scraping (pasardana.id)
// ============================================
export const fetchSmfNav = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      // pasardana fund id, e.g. "2057" for SMF
      fund_id: z.string().regex(/^\d+$/).default("2057"),
    }),
  )
  .handler(async ({ data }) => {
    // Pasardana exposes a public chart JSON endpoint
    const url = `https://pasardana.id/api/Fund/GetFundNavData?id=${data.fund_id}&period=1Y`;
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
          ? ((json as { data: Array<{ Date: string; Nav: number }> }).data)
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
  });