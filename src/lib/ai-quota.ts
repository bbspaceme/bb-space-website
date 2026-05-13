/**
 * AI Usage Quota Tracking & Enforcement (stubbed)
 *
 * The `ai_usage_logs` table and `profiles.subscription_tier` column have not
 * been provisioned yet. Until they are, these helpers are no-ops so the rest
 * of the AI client compiles. Add a migration + replace stubs to re-enable.
 */

export interface AiUsageQuota {
  daily_limit: number;
  monthly_limit: number;
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
  operation: string;
  status: "success" | "error";
  error_message?: string;
}

const DEFAULT_LIMITS = { daily: 50_000, monthly: 500_000 };

export async function getUserAiUsage(_userId: string): Promise<AiUsageQuota> {
  return {
    daily_limit: DEFAULT_LIMITS.daily,
    monthly_limit: DEFAULT_LIMITS.monthly,
    current_daily_usage: 0,
    current_monthly_usage: 0,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function logAiUsage(_log: AiUsageLog): Promise<void> {
  // No-op until ai_usage_logs table exists.
}

export async function checkAiQuota(
  _userId: string,
  _estimatedTokens: number,
): Promise<{ allowed: boolean; reason?: string; quotaRemaining?: number }> {
  return { allowed: true };
}

export const modelPricing: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "google/gemini-pro": { input: 0.5, output: 1.5 },
  "anthropic/claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "openai/gpt-4o": { input: 5.0, output: 15.0 },
};

export function calculateAiCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = modelPricing[model] || modelPricing["google/gemini-2.5-flash"];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
