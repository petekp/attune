import { describe, it, expect } from "vitest";
import { RubricEvaluator } from "../../src/defaults/rubric-evaluator.js";
import type { Signal, RubricSignalValue } from "../../src/types.js";

function makeRubricSignal(dims: Record<string, { score: number; feedback: string }>): Signal {
  const entries = Object.entries(dims);
  const weakest = entries.reduce(
    (min, [name, dim]) => (dim.score < min.score ? { name, ...dim } : min),
    { name: "", score: 1.1, feedback: "" },
  );

  const value: RubricSignalValue = { dimensions: dims, weakest };
  return { runId: "run-1", source: "automated", timing: "immediate", value };
}

describe("RubricEvaluator", () => {
  const weights = {
    relevance: { weight: 0.3, description: "" },
    specificity: { weight: 0.2, description: "" },
    diversity: { weight: 0.2, description: "" },
    actionability: { weight: 0.15, description: "" },
    conciseness: { weight: 0.15, description: "" },
  };

  it("produces per-dimension and weighted composite scores", async () => {
    const evaluator = new RubricEvaluator(weights);
    const signal = makeRubricSignal({
      relevance: { score: 0.8, feedback: "good" },
      specificity: { score: 0.6, feedback: "ok" },
      diversity: { score: 0.9, feedback: "great" },
      actionability: { score: 0.5, feedback: "weak" },
      conciseness: { score: 0.7, feedback: "ok" },
    });

    const score = await evaluator.evaluate(
      { runId: "run-1", data: {} },
      [signal],
    );

    expect(score.dimensions.relevance).toBe(0.8);
    expect(score.dimensions.composite).toBeGreaterThan(0);
    expect(score.dimensions.composite).toBeLessThanOrEqual(1);
  });

  it("returns zeros when no rubric signal is present", async () => {
    const evaluator = new RubricEvaluator(weights);
    const score = await evaluator.evaluate(
      { runId: "run-1", data: {} },
      [],
    );

    expect(score.dimensions.composite).toBe(0);
  });
});
