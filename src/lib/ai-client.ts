// Resolved merge: keep HEAD (quota tracking + retry)
/**
 * AI Client with quota tracking and security
 *
 * This client wraps external AI API calls with:
 * - Per-user quota enforcement
 * - Usage logging for monitoring
 * - Cost tracking
 * - Error handling with fallbacks
 */

import { checkAiQuota, logAiUsage, estimateTokens, calculateAiCost } from "@/lib/ai-quota";

export interface AiCallOptions {
  userId?: string;
  operation?: string; // e.g., 'stock_screener', 'market_insight'
  model?: string;
  timeout?: number;
}

export interface AiCallResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export const LOVABLE_AI_URL =
  process.env.AI_GATEWAY_URL ?? "https://ai.gateway.lovable.dev/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = 40_000;

/**
 * Create a financial disclaimer for AI-generated content
 * Must be present on all user-facing AI outputs
 */
export const AI_FINANCIAL_DISCLAIMER = `
⚠️ **Disclaimer:** Konten ini dihasilkan oleh AI berdasarkan data historis dan bukan merupakan saran investasi profesional. 
Selalu lakukan riset mandiri dan konsultasikan dengan advisor keuangan berlisensi sebelum membuat keputusan investasi.
KBAI Terminal tidak bertanggung jawab atas keputusan finansial yang diambil berdasarkan konten ini.
`.trim();

export async function callLovableAi<T>(
  body: unknown,
  options: AiCallOptions = {},
): Promise<AiCallResult<T>> {
  const {
    userId,
    operation = "unknown",
    model = "google/gemini-2.5-flash",
    timeout = DEFAULT_TIMEOUT_MS,
  } = options;

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  try {
    // 1. Check user quota if userId provided
    if (userId) {
      const requestBody = JSON.stringify(body);
      const estimatedTokens = estimateTokens(requestBody);

      const quotaCheck = await checkAiQuota(userId, estimatedTokens);
      if (!quotaCheck.allowed) {
        throw new Error(
          `${quotaCheck.reason}\n\nUpgrade to Premium untuk lebih banyak AI operations.`,
        );
      }
    }

    // 2. Make AI request with timeout
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Rate limit dari AI provider. Coba lagi dalam beberapa menit.");
        }
        if (res.status === 402) {
          throw new Error("Workspace credits habis. Hubungi admin KBAI.");
        }
        const text = await res.text();
        throw new Error(`AI error: ${res.status} ${text.slice(0, 250)}`);
      }

      const result = (await res.json()) as {
        content?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      // 3. Log usage
      const inputTokens = estimateTokens(JSON.stringify(body));
      const outputTokens = estimateTokens(JSON.stringify(result));
      const cost = calculateAiCost(model, inputTokens, outputTokens);

      if (userId) {
        await logAiUsage({
          user_id: userId,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost_usd: cost,
          operation,
          status: "success",
        }).catch((err) => {
          console.error("[Log AI Usage Error]", err);
          // Don't throw — logging shouldn't block the operation
        });
      }

      return {
        data: result as T,
        inputTokens,
        outputTokens,
        cost,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  } catch (error) {
    // Log error if userId provided
    if (userId) {
      await logAiUsage({
        user_id: userId,
        model,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        operation,
        status: "error",
        error_message: error instanceof Error ? error.message : String(error),
      }).catch(() => {
        // Silently fail if logging fails
      });
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request timed out. Coba lagi nanti.");
    }
    throw error;
  }
}

/**
 * Legacy call without quota tracking (for backwards compatibility)
 * New code should use callLovableAi with options.userId
 */
export async function callLovableAiLegacy<T>(
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const result = await callLovableAi<T>(body, { timeout: timeoutMs });
  return result.data;
}
