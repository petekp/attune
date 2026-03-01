import { describe, it, expect } from "vitest";
import { JournalingAdapter } from "../../src/defaults/journaling-adapter.js";
import type { LLMClient, MemoryStore } from "../../src/interfaces.js";
import type { RubricSignalValue, Signal, Score } from "../../src/types.js";

function mockLLM(response: string): LLMClient {
  return { async complete() { return response; } };
}

function mockMemory(opts: { promptBody?: string; journalBody?: string } = {}): MemoryStore {
  return {
    async readFile() { throw new Error("not used"); },
    async writeFile() {},
    async scanFrontmatter() { return []; },
    async listFiles(glob?: string) {
      if (glob?.includes("observations")) return [];
      return ["prompt.md"];
    },
    async getPrompt() {
      return {
        path: "prompt.md",
        frontmatter: { type: "prompt", version: 1 },
        body: opts.promptBody ?? "Be helpful.",
      };
    },
    async getJournal() {
      return {
        path: "memory/journal.md",
        frontmatter: {},
        body: opts.journalBody ?? "",
      };
    },
    async snapshot() {
      return { id: "snap-1", files: [], timestamp: new Date() };
    },
    async applyPatches() {},
  };
}

function makeRubricSignals(): { signals: Signal[]; score: Score } {
  const rubric: RubricSignalValue = {
    dimensions: {
      relevance: { score: 0.8, feedback: "Good" },
      quality: { score: 0.5, feedback: "Needs work" },
    },
    weakest: { name: "quality", score: 0.5, feedback: "Needs work" },
  };
  const signals: Signal[] = [
    { runId: "run-1", source: "automated", timing: "immediate", value: rubric },
  ];
  const score: Score = {
    runId: "run-1",
    dimensions: { relevance: 0.8, quality: 0.5, composite: 0.65 },
  };
  return { signals, score };
}

describe("JournalingAdapter", () => {
  it("produces a prompt update patch and an observation patch", async () => {
    const llm = mockLLM(JSON.stringify({
      newPrompt: "Be helpful and specific.",
      rationale: "Improved specificity for weak quality dimension",
    }));

    const adapter = new JournalingAdapter(llm);
    const { signals, score } = makeRubricSignals();
    const patches = await adapter.adapt(signals, score, mockMemory());

    // Should produce at least a prompt update and an observation
    const promptPatch = patches.find((p) => p.file === "prompt.md");
    expect(promptPatch).toBeDefined();
    expect(promptPatch!.content.body).toBe("Be helpful and specific.");
    expect(promptPatch!.operation).toBe("update");

    const observationPatch = patches.find((p) =>
      p.file.startsWith("memory/observations/"),
    );
    expect(observationPatch).toBeDefined();
    expect(observationPatch!.operation).toBe("create");
  });

  it("includes journal context in LLM prompt when journal has content", async () => {
    let capturedSystem = "";
    const llm: LLMClient = {
      async complete(params) {
        capturedSystem = params.system ?? "";
        return JSON.stringify({
          newPrompt: "Updated.",
          rationale: "Applied journal principle",
        });
      },
    };

    const adapter = new JournalingAdapter(llm);
    const { signals, score } = makeRubricSignals();
    await adapter.adapt(
      signals,
      score,
      mockMemory({ journalBody: "## Principles\n\n- Always focus on weakest dimension." }),
    );

    expect(capturedSystem).toContain("Always focus on weakest dimension");
  });
});
