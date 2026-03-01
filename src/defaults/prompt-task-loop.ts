// Default TaskLoop that reads the current prompt from memory, sends it
// as the system message along with user-provided input, and parses the
// LLM's JSON response. This is the simplest possible task execution:
// one prompt + one input = one output.
//
// The prompt is read from memory on every call (not cached), so the
// Adapter's prompt rewrites take effect on the next cycle automatically.

import type { TaskLoop, LLMClient, MemoryStore } from "../interfaces.js";
import type { Output } from "../types.js";
import { parseJSON } from "../parse-json.js";

export class PromptTaskLoop implements TaskLoop {
  constructor(
    private input: unknown,
    private llm: LLMClient,
  ) {}

  async execute(memory: MemoryStore): Promise<Output> {
    const prompt = await memory.getPrompt();

    const response = await this.llm.complete({
      system: prompt.body,
      messages: [
        {
          role: "user",
          content: typeof this.input === "string"
            ? this.input
            : JSON.stringify(this.input, null, 2),
        },
      ],
    });

    return {
      runId: "",
      data: parseJSON(response),
    };
  }
}
