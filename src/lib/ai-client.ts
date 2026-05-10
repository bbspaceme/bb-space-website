import { createAIProvider } from "./ai-provider";

const DEFAULT_TIMEOUT_MS = 40_000;

export async function callLovableAi<T>(body: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  // Legacy function - now uses new AI provider abstraction
  const provider = createAIProvider();

  const messages = (body as any)?.messages || [];
  const options = {
    model: (body as any)?.model,
    temperature: 0.7,
    maxTokens: 1000,
  };

  const content = await provider.complete(messages, options);

  // Return in the expected format for backward compatibility
  return {
    choices: [{
      message: {
        content: content
      }
    }]
  } as T;
}
