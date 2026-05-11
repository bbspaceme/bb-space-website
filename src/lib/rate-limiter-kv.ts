/**
 * Production-grade rate limiter using Cloudflare Workers KV
 * Replaces in-memory rate limiting with distributed KV storage
 *
 * This ensures rate limits work correctly across all Cloudflare Worker instances
 * and persists across restarts.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if a request should be rate limited using Cloudflare KV
 *
 * @param kv - Cloudflare KV namespace binding
 * @param identifier - Unique identifier (user ID, IP, API key, etc)
 * @param maxRequests - Maximum allowed requests in the window
 * @param windowMs - Time window in milliseconds
 * @returns RateLimitResult with allow/deny and metadata
 */
export async function checkRateLimitKV(
  kv: KVNamespace,
  identifier: string,
  maxRequests = 100,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const key = `rl:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Fetch current rate limit state from KV
    const current = (await kv.get(key, "json")) as {
      count: number;
      resetTime: number;
    } | null;

    // Window has expired or no data exists - reset counter
    if (!current || now > current.resetTime) {
      const newResetTime = now + windowMs;
      await kv.put(key, JSON.stringify({ count: 1, resetTime: newResetTime }), {
        expirationTtl: Math.ceil(windowMs / 1000),
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: newResetTime,
      };
    }

    // Check if limit exceeded
    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetTime - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime,
        retryAfter,
      };
    }

    // Increment counter
    const newCount = current.count + 1;
    const ttl = Math.ceil((current.resetTime - now) / 1000);

    await kv.put(key, JSON.stringify({ count: newCount, resetTime: current.resetTime }), {
      expirationTtl: Math.max(1, ttl),
    });

    return {
      allowed: true,
      remaining: maxRequests - newCount,
      resetTime: current.resetTime,
    };
  } catch (error) {
    // On KV error, fail open (allow request) to prevent outages
    // But log the error for monitoring
    console.error("[RateLimit Error]", {
      identifier,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      allowed: true, // Fail open
      remaining: maxRequests,
      resetTime: now + windowMs,
    };
  }
}

/**
 * Rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  // Strict: AI/expensive operations
  ai: {
    maxRequests: 20,
    windowMs: 3_600_000, // 1 hour
    name: "AI Operations",
  },

  // Standard: API operations
  api: {
    maxRequests: 100,
    windowMs: 60_000, // 1 minute
    name: "API Operations",
  },

  // Loose: Public operations
  public: {
    maxRequests: 1000,
    windowMs: 60_000, // 1 minute
    name: "Public Operations",
  },

  // Strict: Authentication
  auth: {
    maxRequests: 10,
    windowMs: 900_000, // 15 minutes
    name: "Authentication",
  },

  // Strict: Price alerts and expensive operations
  alerts: {
    maxRequests: 50,
    windowMs: 3_600_000, // 1 hour
    name: "Alerts and Notifications",
  },
} as const;

/**
 * High-precision rate limiter for API quota enforcement
 * Tracks detailed usage metrics per user/API key
 */
export class RateLimiterWithQuota {
  constructor(private kv: KVNamespace) {}

  async checkDaily(
    identifier: string,
    dailyQuota: number,
  ): Promise<{ allowed: boolean; used: number; remaining: number; resetAt: Date }> {
    const today = new Date().toISOString().split("T")[0];
    const key = `quota:daily:${identifier}:${today}`;

    try {
      const data = (await this.kv.get(key, "json")) as { count: number } | null;
      const used = data?.count ?? 0;

      if (used >= dailyQuota) {
        return {
          allowed: false,
          used,
          remaining: 0,
          resetAt: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
        };
      }

      const newCount = used + 1;
      await this.kv.put(key, JSON.stringify({ count: newCount }), {
        expirationTtl: 24 * 60 * 60, // 24 hours
      });

      return {
        allowed: true,
        used: newCount,
        remaining: Math.max(0, dailyQuota - newCount),
        resetAt: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
      };
    } catch (error) {
      console.error("[Quota Check Error]", {
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fail open
      return {
        allowed: true,
        used: 0,
        remaining: dailyQuota,
        resetAt: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
      };
    }
  }
}
