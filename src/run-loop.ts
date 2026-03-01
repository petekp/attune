// The orchestrator. Each call to step() runs one complete attuning cycle:
//
//   snapshot → execute → collect signals → evaluate → adapt → apply patches
//
// This is the heart of attune's self-improvement loop. The RunLoop doesn't
// know what task is being run, how quality is measured, or how prompts get
// rewritten. It just coordinates the flow between pluggable components.
//
// Run history is persisted as YAML files in history/, giving you a
// human-readable audit trail of every attuning cycle.

import { randomUUID } from "node:crypto";
import YAML from "yaml";
import type { TaskLoop, Evaluator, SignalCollector, Adapter, MemoryStore } from "./interfaces.js";
import type { RunRecord, Signal } from "./types.js";

export interface RunLoopConfig {
  taskLoop: TaskLoop;
  evaluator: Evaluator;
  signalCollectors: SignalCollector[];
  adapter: Adapter;
  memory: MemoryStore;
}

export class RunLoop {
  private config: RunLoopConfig;
  private runCount = 0;

  constructor(config: RunLoopConfig) {
    this.config = config;
  }

  async step(): Promise<RunRecord> {
    this.runCount++;
    const runId = randomUUID();

    // 1. Snapshot current memory state
    const memorySnapshot = await this.config.memory.snapshot();

    // 2. Execute the task
    const output = await this.config.taskLoop.execute(this.config.memory);
    output.runId = runId;

    // 3. Collect signals
    const signals: Signal[] = [];
    for (const collector of this.config.signalCollectors) {
      const collected = await collector.collect(output);
      for (const signal of collected) {
        signal.runId = runId;
        signals.push(signal);
      }
    }

    // 4. Evaluate
    const score = await this.config.evaluator.evaluate(output, signals);
    score.runId = runId;

    // 5. Adapt
    const patches = await this.config.adapter.adapt(
      signals,
      score,
      this.config.memory,
    );

    // 6. Apply patches
    await this.config.memory.applyPatches(patches);

    // 7. Build record
    const record: RunRecord = {
      id: runId,
      memorySnapshot,
      output,
      score,
      signals,
      patches,
      timestamp: new Date(),
    };

    // 8. Write run record to history
    await this.writeRunRecord(record);

    return record;
  }

  private async writeRunRecord(record: RunRecord): Promise<void> {
    const padded = String(this.runCount).padStart(3, "0");
    const yamlContent = YAML.stringify({
      id: record.id,
      timestamp: record.timestamp.toISOString(),
      score: record.score.dimensions,
      patches: record.patches.map((p) => ({
        file: p.file,
        operation: p.operation,
        rationale: p.rationale,
      })),
    });

    await this.config.memory.writeFile(`history/run-${padded}.yaml`, {
      path: `history/run-${padded}.yaml`,
      frontmatter: {},
      body: yamlContent,
    });
  }
}
