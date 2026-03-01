import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RunLoop } from "../src/run-loop.js";
import { MemoryDirectory } from "../src/memory-directory.js";
import type { TaskLoop, Evaluator, SignalCollector, Adapter } from "../src/interfaces.js";
import type { MemoryPatch } from "../src/types.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "runloop-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true });
});

function stubTaskLoop(): TaskLoop {
  return {
    async execute(memory) {
      const prompt = await memory.getPrompt();
      return { runId: "", data: `output from: ${prompt.body}` };
    },
  };
}

function stubEvaluator(): Evaluator {
  return {
    async evaluate(output) {
      return { runId: output.runId, dimensions: { quality: 0.7, composite: 0.7 } };
    },
  };
}

function stubSignalCollector(): SignalCollector {
  return {
    async collect(output) {
      return [{ runId: output.runId, source: "automated", timing: "immediate", value: "ok" }];
    },
  };
}

function stubAdapter(): Adapter {
  let callCount = 0;
  return {
    async adapt(_signals, _score, _memory): Promise<MemoryPatch[]> {
      callCount++;
      return [
        {
          file: "prompt.md",
          operation: "update",
          content: {
            path: "prompt.md",
            frontmatter: { type: "prompt", version: callCount },
            body: `adapted prompt v${callCount}`,
          },
          rationale: `adaptation #${callCount}`,
        },
      ];
    },
  };
}

describe("RunLoop", () => {
  it("executes one full cycle and produces a RunRecord", async () => {
    const memory = new MemoryDirectory(dir);
    await memory.writeFile("prompt.md", {
      path: "prompt.md",
      frontmatter: { type: "prompt" },
      body: "initial prompt",
    });

    const loop = new RunLoop({
      taskLoop: stubTaskLoop(),
      evaluator: stubEvaluator(),
      signalCollectors: [stubSignalCollector()],
      adapter: stubAdapter(),
      memory,
    });

    const record = await loop.step();

    expect(record.id).toBeTruthy();
    expect(record.output.data).toBe("output from: initial prompt");
    expect(record.score.dimensions.quality).toBe(0.7);
    expect(record.signals).toHaveLength(1);
    expect(record.patches).toHaveLength(1);
    expect(record.timestamp).toBeInstanceOf(Date);
  });

  it("advances state between steps", async () => {
    const memory = new MemoryDirectory(dir);
    await memory.writeFile("prompt.md", {
      path: "prompt.md",
      frontmatter: { type: "prompt" },
      body: "initial prompt",
    });

    const loop = new RunLoop({
      taskLoop: stubTaskLoop(),
      evaluator: stubEvaluator(),
      signalCollectors: [stubSignalCollector()],
      adapter: stubAdapter(),
      memory,
    });

    const first = await loop.step();
    const second = await loop.step();

    expect(first.output.data).toBe("output from: initial prompt");
    expect(second.output.data).toBe("output from: adapted prompt v1");
  });

  it("writes run records to history/ as YAML files", async () => {
    const memory = new MemoryDirectory(dir);
    await memory.writeFile("prompt.md", {
      path: "prompt.md",
      frontmatter: { type: "prompt" },
      body: "initial prompt",
    });

    const loop = new RunLoop({
      taskLoop: stubTaskLoop(),
      evaluator: stubEvaluator(),
      signalCollectors: [stubSignalCollector()],
      adapter: stubAdapter(),
      memory,
    });

    await loop.step();

    const files = await memory.listFiles("history/**");
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files[0]).toMatch(/^history\/run-.*\.yaml$/);
  });
});
