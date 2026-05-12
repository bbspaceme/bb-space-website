/**
 * DUP-04: Admin middleware for server functions
 * Validates both authentication and admin role from the authenticated user's token
 * Usage: .middleware([attachSupabaseAuth, requireAdminAuth])
 */
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attachSupabaseAuth } from "@/lib/with-auth";

// Server-side: validate admin role from authenticated user
const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    // requireSupabaseAuth already ran and provides userId and claims
    const userId = ((context ?? {}) as { userId?: string }).userId;
    if (!userId) {
      throw new Response("Unauthorized: No user ID", { status: 401 });
    }

    // Get roles from JWT claims (efficient, no DB query)
    const claims = ((context ?? {}) as { claims?: { app_metadata?: { roles?: string[] } } }).claims;
    const jwtRoles = claims?.app_metadata?.roles;

    if (!jwtRoles || !jwtRoles.includes("admin")) {
      throw new Response("Forbidden: admin role required", { status: 403 });
    }

    return next({
      context: {
        ...((context ?? {}) as Record<string, unknown>),
        userId, // Already verified to be admin
      },
    });
  },
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

    const claims = ((context ?? {}) as { claims?: { app_metadata?: { roles?: string[] } } }).claims;
    const jwtRoles = claims?.app_metadata?.roles;

    const hasAdminOrAdvisor =
      jwtRoles && (jwtRoles.includes("admin") || jwtRoles.includes("advisor"));

    if (!hasAdminOrAdvisor) {
      throw new Response("Forbidden: admin or advisor role required", { status: 403 });
    }

    return next({
      context: {
        ...((context ?? {}) as Record<string, unknown>),
        userId,
      },
    });
  },
);

export const advisorAuthMiddleware = [
  attachSupabaseAuth,
  requireSupabaseAuth,
  requireAdvisorAuth,
] as const;
