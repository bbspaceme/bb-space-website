/**
 * DUP-04: Admin middleware for server functions
 * Validates both authentication and admin role from the authenticated user's token
 * Usage: .middleware([attachSupabaseAuth, requireAdminAuth])
 */
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Client-side: attach auth token
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      sendContext: {},
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
);

// Server-side: validate admin role from authenticated user
const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    // requireSupabaseAuth already ran and provides userId
    const userId = ((context ?? {}) as { userId?: string }).userId;
    if (!userId) {
      throw new Response("Unauthorized: No user ID", { status: 401 });
    }

    // Check if user has admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!roles?.some((r) => String(r.role) === "admin")) {
      throw new Response("Forbidden: admin role required", { status: 403 });
    }

    return next({
      context: {
        ...((context ?? {}) as Record<string, unknown>),
        userId, // Already verified to be admin
      },
    });
  }
);

// Combined middleware: auth + admin role check
export const adminAuthMiddleware = [
  attachSupabaseAuth,
  requireSupabaseAuth,
  requireAdminAuth,
] as const;

/**
 * Advisor middleware - checks for admin OR advisor role
 */
const requireAdvisorAuth = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    const userId = ((context ?? {}) as { userId?: string }).userId;
    if (!userId) {
      throw new Response("Unauthorized: No user ID", { status: 401 });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const hasAdminOrAdvisor = roles?.some(
      (r) => String(r.role) === "admin" || String(r.role) === "advisor"
    );

    if (!hasAdminOrAdvisor) {
      throw new Response("Forbidden: admin or advisor role required", { status: 403 });
    }

    return next({
      context: {
        ...((context ?? {}) as Record<string, unknown>),
        userId,
      },
    });
  }
);

export const advisorAuthMiddleware = [
  attachSupabaseAuth,
  requireSupabaseAuth,
  requireAdvisorAuth,
] as const;
