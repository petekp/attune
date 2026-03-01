// Pure-math Evaluator that computes a weighted composite score from
// rubric signals. No LLM calls, just arithmetic. This separation
// keeps evaluation deterministic and fast: given the same signals,
// you always get the same score.
//
// If no rubric signal is found (e.g. using a non-rubric SignalCollector),
// all dimensions score 0. This is a safe default that signals
// "no data" rather than fabricating scores.

import type { Evaluator } from "../interfaces.js";
import type { Output, Signal, Score, DimensionConfig, RubricSignalValue } from "../types.js";

export class RubricEvaluator implements Evaluator {
  constructor(private dimensions: Record<string, DimensionConfig>) {}

  async evaluate(output: Output, signals: Signal[]): Promise<Score> {
    const rubricSignal = signals.find(
      (s) => s.source === "automated" && isRubricSignal(s.value),
    );

    if (!rubricSignal) {
      const dims: Record<string, number> = { composite: 0 };
      for (const name of Object.keys(this.dimensions)) {
        dims[name] = 0;
      }
      return { runId: output.runId, dimensions: dims };
    }

    const rubric = rubricSignal.value as RubricSignalValue;
    const dims: Record<string, number> = {};
    let composite = 0;

    for (const [name, config] of Object.entries(this.dimensions)) {
      const dimScore = rubric.dimensions[name]?.score ?? 0;
      dims[name] = dimScore;
      composite += dimScore * config.weight;
    }

    // Round to 3 decimal places to avoid floating-point noise in logs
    dims.composite = Math.round(composite * 1000) / 1000;

    return { runId: output.runId, dimensions: dims };
  }
}

function isRubricSignal(value: unknown): value is RubricSignalValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "dimensions" in value &&
    "weakest" in value
  );
}
