// LLM-as-judge SignalCollector. Takes an output and scores it against
// each quality dimension defined in the config. The judge is deliberately
// calibrated to be critical (0.7 means "decent but improvable") so
// the attuning loop has room to optimize.
//
// Produces a RubricSignalValue containing per-dimension scores and
// feedback, plus the weakest dimension (which the JournalingAdapter
// uses to decide what to improve next).

import type { SignalCollector, LLMClient } from "../interfaces.js";
import type { Output, Signal, DimensionConfig, RubricSignalValue } from "../types.js";
import { parseJSON } from "../parse-json.js";

export class RubricJudge implements SignalCollector {
  constructor(
    private dimensions: Record<string, DimensionConfig>,
    private llm: LLMClient,
  ) {}

  async collect(output: Output): Promise<Signal[]> {
    const dimensionLines = Object.entries(this.dimensions)
      .map(([name, config]) => `- ${name}: ${config.description}`)
      .join("\n");

    const dimensionJSON = Object.keys(this.dimensions)
      .map((name) => `    "${name}": { "score": 0.0-1.0, "feedback": "..." }`)
      .join(",\n");

    const response = await this.llm.complete({
      system: "You are a quality evaluator. Score outputs on the given dimensions. Be critical — 0.7 means decent but improvable. Reserve 0.9+ for genuinely excellent work.",
      messages: [
        {
          role: "user",
          content: `Score this output on each dimension from 0.0 to 1.0. For each, provide specific actionable feedback.

Output to evaluate:
${JSON.stringify(output.data, null, 2)}

Dimensions:
${dimensionLines}

Respond with JSON:
{
  "dimensions": {
${dimensionJSON}
  }
}`,
        },
      ],
    });

    const parsed = parseJSON<{ dimensions: Record<string, { score: number; feedback: string }> }>(response);

    // Identify the weakest dimension so the Adapter knows where to focus.
    // Initialized above max score (1.1) so any real score replaces it.
    let weakest = { name: "", score: 1.1, feedback: "" };
    for (const [name, dim] of Object.entries(parsed.dimensions)) {
      if (dim.score < weakest.score) {
        weakest = { name, score: dim.score, feedback: dim.feedback };
      }
    }

    const value: RubricSignalValue = {
      dimensions: parsed.dimensions,
      weakest,
    };

    return [
      {
        runId: output.runId,
        source: "automated",
        timing: "immediate",
        value,
      },
    ];
  }
}
