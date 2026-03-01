// The self-improving Adapter. On each cycle it rewrites the system prompt
// to target the weakest scoring dimension, and records an observation
// about what it changed and why.
//
// The "journaling" pattern solves a key problem: without memory of past
// changes, the adapter oscillates, improving dimension A at the expense
// of B, then reversing. By reading its own journal before proposing
// changes, it can build on prior lessons and avoid regressions.
//
// Produces two patches per cycle:
//   1. prompt.md update with the rewritten system prompt
//   2. memory/observations/run-NNN.md recording what changed and why

import type { Adapter, LLMClient, MemoryStore } from "../interfaces.js";
import type { Signal, Score, MemoryPatch, RubricSignalValue } from "../types.js";
import { parseJSON } from "../parse-json.js";

export class JournalingAdapter implements Adapter {
  private runCount = 0;

  constructor(private llm: LLMClient) {}

  async adapt(
    signals: Signal[],
    score: Score,
    memory: MemoryStore,
  ): Promise<MemoryPatch[]> {
    this.runCount++;
    const patches: MemoryPatch[] = [];

    const currentPrompt = await memory.getPrompt();
    const journal = await memory.getJournal();

    const rubricSignal = signals.find(
      (s) => s.source === "automated" && isRubricSignal(s.value),
    );

    const feedbackSection = rubricSignal
      ? this.formatRubric(rubricSignal.value as RubricSignalValue)
      : `Score: ${JSON.stringify(score.dimensions)}`;

    // Feed past observations into the system prompt so the LLM can
    // build on what it learned. This is the anti-oscillation mechanism.
    const journalContext = journal.body
      ? `\n\nYour adaptation journal (lessons learned from previous runs):\n${journal.body}`
      : "";

    const response = await this.llm.complete({
      system: `You are optimizing a system prompt for an AI task. Make ONE targeted change per iteration. Focus on the weakest dimension.${journalContext}`,
      messages: [
        {
          role: "user",
          content: `Current system prompt:
${currentPrompt.body}

${feedbackSection}

Rewrite the system prompt to improve the weakest dimension.

Respond with JSON:
{
  "newPrompt": "The improved system prompt text",
  "rationale": "Brief explanation of what you changed and why"
}`,
        },
      ],
    });

    const result = parseJSON<{ newPrompt: string; rationale: string }>(response);

    // Patch 1: Update prompt
    const version = ((currentPrompt.frontmatter.version as number) ?? 0) + 1;
    patches.push({
      file: "prompt.md",
      operation: "update",
      content: {
        path: "prompt.md",
        frontmatter: {
          type: "prompt",
          version,
          last_score: score.dimensions.composite ?? 0,
          updated: new Date().toISOString().split("T")[0],
        },
        body: result.newPrompt,
      },
      rationale: result.rationale,
    });

    // Patch 2: Record observation
    const padded = String(this.runCount).padStart(3, "0");
    patches.push({
      file: `memory/observations/run-${padded}.md`,
      operation: "create",
      content: {
        path: `memory/observations/run-${padded}.md`,
        frontmatter: {
          type: "observation",
          run: this.runCount,
          composite_score: score.dimensions.composite ?? 0,
          weakest_dimension: rubricSignal
            ? (rubricSignal.value as RubricSignalValue).weakest.name
            : "unknown",
          timestamp: new Date().toISOString(),
        },
        body: `## Change\n\n${result.rationale}\n\n## Scores\n\n${feedbackSection}`,
      },
      rationale: `Observation from run ${this.runCount}`,
    });

    return patches;
  }

  private formatRubric(rubric: RubricSignalValue): string {
    const lines = Object.entries(rubric.dimensions).map(
      ([name, dim]) => `- ${name}: ${dim.score}/1.0 — ${dim.feedback}`,
    );
    return `Rubric scores:\n${lines.join("\n")}\n\nWEAKEST: ${rubric.weakest.name} (${rubric.weakest.score}/1.0) — ${rubric.weakest.feedback}`;
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
