import { describe, it, expect } from "vitest";
import { RubricJudge } from "../../src/defaults/rubric-judge.js";
import type { LLMClient } from "../../src/interfaces.js";

function mockLLM(response: string): LLMClient {
  return {
    async complete() {
      return response;
    },
  };
}

describe("RubricJudge", () => {
  const dimensions = {
    relevance: { weight: 0.3, description: "Items match user interests" },
    quality: { weight: 0.7, description: "Output is well-written" },
  };

  it("produces a rubric signal with per-dimension scores and weakest", async () => {
    const llm = mockLLM(JSON.stringify({
      dimensions: {
        relevance: { score: 0.8, feedback: "Good match" },
        quality: { score: 0.6, feedback: "Could be better" },
      },
    }));

    const judge = new RubricJudge(dimensions, llm);
    const signals = await judge.collect({
      runId: "run-1",
      data: { text: "Some output" },
    });

    expect(signals).toHaveLength(1);
    const value = signals[0].value as any;
    expect(value.dimensions.relevance.score).toBe(0.8);
    expect(value.dimensions.quality.score).toBe(0.6);
    expect(value.weakest.name).toBe("quality");
  });

  it("passes dimension descriptions to the LLM prompt", async () => {
    let capturedPrompt = "";
    const llm: LLMClient = {
      async complete(params) {
        capturedPrompt = params.messages[0].content;
        return JSON.stringify({
          dimensions: {
            relevance: { score: 0.5, feedback: "ok" },
            quality: { score: 0.5, feedback: "ok" },
          },
        });
      },
    };

    const judge = new RubricJudge(dimensions, llm);
    await judge.collect({ runId: "run-1", data: {} });

    expect(capturedPrompt).toContain("Items match user interests");
    expect(capturedPrompt).toContain("Output is well-written");
  });
});
