import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attune } from "../src/attune.js";
import type { LLMClient } from "../src/interfaces.js";
import { MemoryDirectory } from "../src/memory-directory.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "attune-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true });
});

function mockLLM(): LLMClient {
  let callCount = 0;
  return {
    async complete(params) {
      callCount++;
      // Alternate between task output, judge output, and adapter output
      if (params.system?.includes("quality evaluator") || params.system?.includes("Score outputs")) {
        return JSON.stringify({
          dimensions: {
            quality: { score: 0.7, feedback: "Decent" },
          },
        });
      }
      if (params.system?.includes("optimizing")) {
        return JSON.stringify({
          newPrompt: `Improved prompt v${callCount}`,
          rationale: "Better now",
        });
      }
      // Task output
      return JSON.stringify({ result: `output ${callCount}` });
    },
  };
}

describe("attune()", () => {
  it("creates a RunLoop from a config object and runs a step", async () => {
    const loop = attune({
      task: "Test task",
      prompt: "You are helpful.",
      dimensions: {
        quality: { weight: 1.0, description: "Overall quality" },
      },
      input: { text: "Hello" },
      memory: dir,
      llm: mockLLM(),
    });

    const record = await loop.step();

    expect(record.id).toBeTruthy();
    expect(record.score.dimensions).toBeDefined();
  });

  it("initializes the memory directory with the prompt on first call", async () => {
    const loop = attune({
      task: "Test task",
      prompt: "You are helpful.",
      dimensions: {
        quality: { weight: 1.0, description: "Overall quality" },
      },
      input: "Hello",
      memory: dir,
      llm: mockLLM(),
    });

    await loop.step();

    // Verify prompt.md was created
    const memory = new MemoryDirectory(dir);
    const prompt = await memory.readFile("prompt.md");
    expect(prompt.body).toBeTruthy();
  });
});
