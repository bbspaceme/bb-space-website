const uuidv4 = () => crypto.randomUUID();

/**
 * Correlation ID utilities for request tracing.
 *
 * Serverless runtimes may reuse a single isolate for many concurrent requests,
 * so this module deliberately avoids mutable module-level request state on the
 * server. Pass `correlationId`/`requestId` in the log context (or TanStack
 * middleware context) instead of relying on a global singleton.
 */

export class CorrelationIdContext {
  private static browserRequestId: string = uuidv4();

  static generate(): string {
    return uuidv4();
  }

  static getRequestId(): string {
    if (typeof window !== "undefined") {
      return CorrelationIdContext.browserRequestId;
    }

    return "unscoped";
  }

  static setRequestId(id: string): void {
    if (typeof window !== "undefined") {
      CorrelationIdContext.browserRequestId = id;
    }
  }
}

/**
 * Structured logging for observability
 * Returns JSON-formatted logs that can be easily aggregated
 */
export interface StructuredLog {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  requestId: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function getContextRequestId(context?: Record<string, unknown>): string | undefined {
  const requestId = context?.requestId ?? context?.correlationId;
  return typeof requestId === "string" && requestId.length > 0 ? requestId : undefined;
}

export function createStructuredLog(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  context?: Record<string, unknown>,
  error?: Error,
): StructuredLog {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    requestId: getContextRequestId(context) ?? CorrelationIdContext.getRequestId(),
    context,
    error: error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined,
  };
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  const log = createStructuredLog("info", message, context);
  console.log(JSON.stringify(log));
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  const log = createStructuredLog("warn", message, context);
  console.warn(JSON.stringify(log));
}

export function logError(message: string, error?: Error, context?: Record<string, unknown>): void {
  const log = createStructuredLog("error", message, context, error);
  console.error(JSON.stringify(log));
}

export function logDebug(message: string, context?: Record<string, unknown>): void {
  const log = createStructuredLog("debug", message, context);
  if (process.env.DEBUG) {
    console.debug(JSON.stringify(log));
  }
}
