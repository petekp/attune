import { describe, it, expect } from "vitest";
import { PromptTaskLoop } from "../../src/defaults/prompt-task-loop.js";
import type { LLMClient, MemoryStore } from "../../src/interfaces.js";

function mockLLM(response: string): LLMClient {
  return { async complete() { return response; } };
}

function mockMemory(promptBody: string): MemoryStore {
  return {
    async readFile() { throw new Error("not used"); },
    async writeFile() {},
    async scanFrontmatter() { return []; },
    async listFiles() { return ["prompt.md"]; },
    async getPrompt() {
      return { path: "prompt.md", frontmatter: {}, body: promptBody };
    },
    async getJournal() {
      return { path: "memory/journal.md", frontmatter: {}, body: "" };
    },
    async snapshot() {
      return { id: "snap-1", files: [], timestamp: new Date() };
    },
    async applyPatches() {},
  };
}

describe("PromptTaskLoop", () => {
  it("sends the prompt and input to the LLM and returns the output", async () => {
    let capturedMessages: any;
    const llm: LLMClient = {
      async complete(params) {
        capturedMessages = params;
        return JSON.stringify({ result: "briefing text" });
      },
    };

    const taskLoop = new PromptTaskLoop(
      { items: ["item1", "item2"] },
      llm,
    );

    const output = await taskLoop.execute(mockMemory("You are helpful."));

    expect(capturedMessages.system).toContain("You are helpful.");
    expect(capturedMessages.messages[0].content).toContain("item1");
    expect(output.data).toBeDefined();
  });
});
