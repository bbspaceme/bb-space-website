import { createMiddleware } from "@tanstack/react-start";

// Simple in-memory rate limiter (for development)
// In production, use Redis-based rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  const existing = rateLimits.get(key);

  if (!existing || now > existing.resetTime) {
    // Reset or new entry
    rateLimits.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetTime: now + WINDOW_MS };
  }

  if (existing.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime };
  }

  existing.count++;
  return { allowed: true, remaining: MAX_REQUESTS - existing.count, resetTime: existing.resetTime };
}

// Middleware for rate limiting
export function rateLimitMiddleware(identifierFn?: (context: any) => string) {
  return createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const identifier = identifierFn ? identifierFn(context) : (context as any).userId || "anonymous";
    const { allowed, remaining, resetTime } = checkRateLimit(identifier);

    if (!allowed) {
      const resetIn = Math.ceil((resetTime - Date.now()) / 1000);
      throw new Response(`Rate limit exceeded. Try again in ${resetIn} seconds.`, {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": resetTime.toString(),
          "Retry-After": resetIn.toString(),
        },
      });
    }

    const response = await next({
      context: {
        ...context,
        rateLimit: { remaining, resetTime },
      },
    });

    // Add rate limit headers to response
    if (response instanceof Response) {
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set("X-RateLimit-Reset", resetTime.toString());
    }

    return response;
  });
}