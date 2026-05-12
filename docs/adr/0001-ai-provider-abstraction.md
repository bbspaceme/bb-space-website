# 0001 - AI Provider Abstraction Layer

Date: 2026-05-10

## Status

Accepted

## Context

The application currently uses Lovable AI gateway as the sole AI provider for generating insights. This creates vendor lock-in and reliability risks. We need a flexible architecture that supports multiple AI providers with fallback capabilities.

## Decision

Implement an AI provider abstraction layer that:

1. Defines a common `AIProvider` interface
2. Supports multiple providers (OpenAI, Anthropic, Gemini) with chain-of-responsibility pattern
3. Uses environment variables to configure available providers
4. Falls back gracefully when primary providers fail

## Implementation

```typescript
interface AIProvider {
  complete(messages: ChatMessage[], options?: AIOptions): Promise<string>;
}

class AIProviderChain implements AIProvider {
  constructor(private providers: AIProvider[]) {}
  async complete(messages, options) {
    /* try each provider */
  }
}
```

## Consequences

- **Positive**: No vendor lock-in, improved reliability
- **Negative**: Increased complexity, API key management
- **Risks**: Provider API changes, cost management

## Alternatives Considered

- Direct API calls without abstraction
- Single provider with manual switching

## References

- Audit finding C1: AI vendor lock-in
- Provider documentation: OpenAI, Anthropic, Google AI
