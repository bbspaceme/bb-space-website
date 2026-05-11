/**
 * AI Usage Quota Tracking & Enforcement
 *
 * Tracks per-user AI API consumption and enforces limits to prevent cost explosion.
 * Logs all AI usage for monitoring and billing purposes.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AiUsageQuota {
  daily_limit: number; // tokens per day
  monthly_limit: number; // tokens per month
  current_daily_usage: number;
  current_monthly_usage: number;
}

export interface AiUsageLog {
  user_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  operation: string; // 'screener', 'insight', 'brief', etc
  status: "success" | "error";
  error_message?: string;
}

/**
 * Get current AI usage for a user
 */
export async function getUserAiUsage(userId: string): Promise<AiUsageQuota> {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  try {
    const [dailyUsage, monthlyUsage] = await Promise.all([
      supabaseAdmin
        .from("ai_usage_logs")
        .select("total_tokens")
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00Z`)
        .then((res) => res.data?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0),
      supabaseAdmin
        .from("ai_usage_logs")
        .select("total_tokens")
        .eq("user_id", userId)
        .gte("created_at", `${monthStartStr}T00:00:00Z`)
        .then((res) => res.data?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0),
    ]);

    // Get user's subscription tier to determine limits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    const tier = profile?.subscription_tier || "free";

    // Default quotas per tier (in tokens)
    const quotas: Record<string, { daily: number; monthly: number }> = {
      free: { daily: 50_000, monthly: 500_000 },
      premium: { daily: 500_000, monthly: 10_000_000 },
      advisor: { daily: 2_000_000, monthly: 50_000_000 },
    };

    const limits = quotas[tier] || quotas.free;

    return {
      daily_limit: limits.daily,
      monthly_limit: limits.monthly,
      current_daily_usage: dailyUsage,
      current_monthly_usage: monthlyUsage,
    };
  } catch (error) {
    console.error("[AI Quota Error]", { userId, error });
    // Return conservative limits on error
    return {
      daily_limit: 50_000,
      monthly_limit: 500_000,
      current_daily_usage: 0,
      current_monthly_usage: 0,
    };
  }
}

/**
 * Estimate tokens for input/output
 * Rough approximation: 1 token ≈ 4 characters
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Log AI operation for monitoring and quota enforcement
 */
export async function logAiUsage(log: AiUsageLog): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: log.user_id,
      model: log.model,
      input_tokens: log.input_tokens,
      output_tokens: log.output_tokens,
      total_tokens: log.total_tokens,
      cost_usd: log.cost_usd,
      operation: log.operation,
      status: log.status,
      error_message: log.error_message,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Log AI Usage Error]", { error, log });
    // Don't throw — logging failure shouldn't block the operation
  }
}

/**
 * Check if user can make AI request based on quota
 */
export async function checkAiQuota(
  userId: string,
  estimatedTokens: number,
): Promise<{
  allowed: boolean;
  reason?: string;
  quotaRemaining?: number;
}> {
  try {
    const quota = await getUserAiUsage(userId);

    if (quota.current_daily_usage + estimatedTokens > quota.daily_limit) {
      return {
        allowed: false,
        reason: `Daily AI quota exceeded. Used: ${quota.current_daily_usage}/${quota.daily_limit} tokens`,
        quotaRemaining: Math.max(0, quota.daily_limit - quota.current_daily_usage),
      };
    }

    if (quota.current_monthly_usage + estimatedTokens > quota.monthly_limit) {
      return {
        allowed: false,
        reason: `Monthly AI quota exceeded. Used: ${quota.current_monthly_usage}/${quota.monthly_limit} tokens`,
        quotaRemaining: Math.max(0, quota.monthly_limit - quota.current_monthly_usage),
      };
    }

    return {
      allowed: true,
      quotaRemaining: quota.daily_limit - quota.current_daily_usage,
    };
  } catch (error) {
    console.error("[Quota Check Error]", { userId, error });
    // Fail open on error — don't block users due to quota system failure
    return { allowed: true };
  }
}

/**
 * Model pricing reference (in USD per 1M tokens)
 * Update as pricing changes
 */
export const modelPricing: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "google/gemini-pro": { input: 0.5, output: 1.5 },
  "anthropic/claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "openai/gpt-4o": { input: 5.0, output: 15.0 },
};

/**
 * Calculate cost for AI operation
 */
export function calculateAiCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = modelPricing[model] || modelPricing["google/gemini-2.5-flash"];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
