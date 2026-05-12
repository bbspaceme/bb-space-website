import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authedMiddleware } from "@/lib/with-auth";
import { insertAuditLog } from "@/lib/audit.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Soft delete user account (GDPR compliance)
export const softDeleteUser = createServerFn({ method: "POST" })
  .middleware([authedMiddleware])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    const userId = context.userId;

    try {
      // Call database function to soft delete user
      const { error } = await supabaseAdmin.rpc("soft_delete_user", {
        user_uuid: userId,
      });

      if (error) throw error;

      // Log the action
      await insertAuditLog({
        userId,
        action: "ACCOUNT_SOFT_DELETED",
        details: { timestamp: new Date().toISOString() },
      });

      return { success: true, message: "Account has been deactivated" };
    } catch (error) {
      console.error("Soft delete user error:", error);
      throw new Error("Failed to deactivate account");
    }
  });

// Export user data (GDPR compliance)
export const exportUserData = createServerFn({ method: "GET" })
  .middleware([authedMiddleware])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    const userId = context.userId;

    try {
      // Get user profile
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) throw userError;

      // Get holdings
      const { data: holdings, error: holdingsError } = await supabaseAdmin
        .from("holdings")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (holdingsError) throw holdingsError;

      // Get transactions
      const { data: transactions, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("transacted_at", { ascending: false });

      if (txError) throw txError;

      // Get cash balance
      const { data: cashBalance, error: cashError } = await supabaseAdmin
        .from("cash_balances")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (cashError && cashError.code !== "PGRST116") throw cashError;

      // Get audit logs (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: auditLogs, error: auditError } = await supabaseAdmin
        .from("audit_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", ninetyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (auditError) throw auditError;

      // Compile export data
      const exportData = {
        exportDate: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          created_at: user.created_at,
          last_sign_in: user.last_sign_in_at,
        },
        holdings: holdings || [],
        transactions: transactions || [],
        cashBalance: cashBalance || null,
        auditLogs: auditLogs || [],
        dataRetention: {
          note: "This export contains your active data. Soft-deleted data is not included.",
          gdprRights:
            "You have the right to access, rectify, erase, or restrict processing of your data.",
        },
      };

      // Log the export
      await insertAuditLog({
        userId,
        action: "DATA_EXPORTED",
        details: {
          exportDate: exportData.exportDate,
          recordCounts: {
            holdings: exportData.holdings.length,
            transactions: exportData.transactions.length,
            auditLogs: exportData.auditLogs.length,
          },
        },
      });

      return exportData;
    } catch (error) {
      console.error("Export user data error:", error);
      throw new Error("Failed to export user data");
    }
  });

// Admin function to restore soft-deleted user
export const restoreUser = createServerFn({ method: "POST" })
  .middleware([authedMiddleware]) // In production, add admin check
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const adminUserId = context.userId;
    const { userId: targetUserId } = data;

    try {
      // Call database function to restore user
      const { error } = await supabaseAdmin.rpc("restore_user", {
        user_uuid: targetUserId,
      });

      if (error) throw error;

      // Log the admin action
      await insertAuditLog({
        userId: adminUserId,
        action: "USER_RESTORED",
        details: {
          targetUserId,
          restoredBy: adminUserId,
          timestamp: new Date().toISOString(),
        },
      });

      return { success: true, message: "User account has been restored" };
    } catch (error) {
      console.error("Restore user error:", error);
      throw new Error("Failed to restore user account");
    }
  });

// Admin function for permanent deletion (after retention period)
export const permanentlyDeleteUser = createServerFn({ method: "POST" })
  .middleware([authedMiddleware]) // In production, add admin check
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const adminUserId = context.userId;
    const { userId: targetUserId } = data;

    try {
      // Call database function for permanent deletion
      const { error } = await supabaseAdmin.rpc("permanently_delete_user", {
        user_uuid: targetUserId,
      });

      if (error) throw error;

      // Log the admin action
      await insertAuditLog({
        userId: adminUserId,
        action: "USER_PERMANENTLY_DELETED",
        details: {
          targetUserId,
          deletedBy: adminUserId,
          timestamp: new Date().toISOString(),
        },
      });

      return { success: true, message: "User account has been permanently deleted" };
    } catch (error) {
      console.error("Permanent delete user error:", error);
      throw new Error("Failed to permanently delete user account");
    }
  });

// Admin function to archive old data
export const archiveOldData = createServerFn({ method: "POST" })
  .middleware([authedMiddleware]) // In production, add admin check
  .inputValidator(z.object({ daysOld: z.number().min(30).max(3650).optional() }))
  .handler(async ({ data, context }) => {
    const adminUserId = context.userId;
    const { daysOld = 365 } = data;

    try {
      // Call database function to archive old data
      const { data: result, error } = await supabaseAdmin.rpc("archive_old_data", {
        days_old: daysOld,
      });

      if (error) throw error;

      // Log the admin action
      await insertAuditLog({
        userId: adminUserId,
        action: "DATA_ARCHIVED",
        details: {
          daysOld,
          archivedRecords: result,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: `Archived ${result?.length || 0} record types`,
        details: result,
      };
    } catch (error) {
      console.error("Archive old data error:", error);
      throw new Error("Failed to archive old data");
    }
  });
