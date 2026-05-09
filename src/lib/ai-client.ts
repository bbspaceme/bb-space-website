export const LOVABLE_AI_URL =
  process.env.AI_GATEWAY_URL ?? "https://ai.gateway.lovable.dev/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = 40_000;

export async function callLovableAi<T>(body: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
      if (res.status === 429) throw new Error("Rate limit. Coba lagi sebentar.");
      if (res.status === 402) throw new Error("Kuota AI habis. Top-up workspace credits.");
      const text = await res.text();
      throw new Error(`AI error: ${res.status} ${text.slice(0, 250)}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI request timed out. Coba lagi nanti.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
