// Thin wrapper around the Anthropic SDK that implements LLMClient.
// The wrapper exists to keep provider details out of the core loop.
// Components depend on the LLMClient interface, not on Anthropic
// directly. This also makes testing easy: swap in a mock LLMClient
// that returns canned responses without hitting any API.

import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "./interfaces.js";

export { type LLMClient } from "./interfaces.js";

/** LLM client backed by Claude via the Anthropic SDK. */
export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(model = "claude-sonnet-4-20250514") {
    this.client = new Anthropic();
    this.model = model;
  }

  async complete(params: {
    system?: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: params.system,
      messages: params.messages,
    });

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error(`Unexpected response type: ${block.type}`);
    }
    return block.text;
  }
}

/** Convenience factory for the Anthropic client. */
export function anthropic(model?: string): LLMClient {
  return new AnthropicLLMClient(model);
}
