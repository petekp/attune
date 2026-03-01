import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryDirectory } from "../src/memory-directory.js";

let dir: string;
let memory: MemoryDirectory;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "attune-test-"));
  memory = new MemoryDirectory(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true });
});

describe("MemoryDirectory", () => {
  describe("readFile", () => {
    it("parses a markdown file with YAML frontmatter", async () => {
      await writeFile(
        join(dir, "prompt.md"),
        `---
type: prompt
version: 1
---
You are a helpful assistant.`,
      );

      const file = await memory.readFile("prompt.md");

      expect(file.path).toBe("prompt.md");
      expect(file.frontmatter.type).toBe("prompt");
      expect(file.frontmatter.version).toBe(1);
      expect(file.body).toBe("You are a helpful assistant.");
    });

    it("handles files with no frontmatter", async () => {
      await writeFile(join(dir, "plain.md"), "Just a plain file.");

      const file = await memory.readFile("plain.md");

      expect(file.frontmatter).toEqual({});
      expect(file.body).toBe("Just a plain file.");
    });

    it("throws when the file does not exist", async () => {
      await expect(memory.readFile("missing.md")).rejects.toThrow();
    });
  });

  describe("writeFile", () => {
    it("writes a markdown file with frontmatter", async () => {
      await memory.writeFile("test.md", {
        path: "test.md",
        frontmatter: { type: "test", version: 1 },
        body: "Hello world.",
      });

      const file = await memory.readFile("test.md");
      expect(file.frontmatter.type).toBe("test");
      expect(file.body).toBe("Hello world.");
    });

    it("creates nested directories as needed", async () => {
      await memory.writeFile("memory/strategies.md", {
        path: "memory/strategies.md",
        frontmatter: { type: "strategy" },
        body: "Be concise.",
      });

      const file = await memory.readFile("memory/strategies.md");
      expect(file.body).toBe("Be concise.");
    });
  });

  describe("listFiles", () => {
    it("lists all files in the directory", async () => {
      await memory.writeFile("prompt.md", {
        path: "prompt.md",
        frontmatter: {},
        body: "prompt",
      });
      await memory.writeFile("memory/journal.md", {
        path: "memory/journal.md",
        frontmatter: {},
        body: "journal",
      });

      const files = await memory.listFiles();
      expect(files).toContain("prompt.md");
      expect(files).toContain("memory/journal.md");
    });

    it("filters by glob pattern", async () => {
      await memory.writeFile("prompt.md", {
        path: "prompt.md",
        frontmatter: {},
        body: "prompt",
      });
      await mkdir(join(dir, "history"), { recursive: true });
      await writeFile(join(dir, "history/run-001.yaml"), "id: 1");

      const mdFiles = await memory.listFiles("**/*.md");
      expect(mdFiles).toContain("prompt.md");
      expect(mdFiles).not.toContain("history/run-001.yaml");
    });
  });

  describe("scanFrontmatter", () => {
    it("returns frontmatter for all markdown files without loading bodies", async () => {
      await memory.writeFile("prompt.md", {
        path: "prompt.md",
        frontmatter: { type: "prompt", version: 1 },
        body: "A very long prompt body that should not be loaded...",
      });
      await memory.writeFile("memory/journal.md", {
        path: "memory/journal.md",
        frontmatter: { type: "journal", entries: 5 },
        body: "Journal content...",
      });

      const manifests = await memory.scanFrontmatter();

      expect(manifests).toHaveLength(2);
      const prompt = manifests.find((m) => m.path === "prompt.md");
      expect(prompt?.frontmatter.type).toBe("prompt");
      // FileManifest has no body property
      expect((prompt as any).body).toBeUndefined();
    });
  });

  describe("getPrompt", () => {
    it("reads prompt.md", async () => {
      await memory.writeFile("prompt.md", {
        path: "prompt.md",
        frontmatter: { type: "prompt" },
        body: "You are a helpful assistant.",
      });

      const prompt = await memory.getPrompt();
      expect(prompt.body).toBe("You are a helpful assistant.");
    });
  });

  describe("getJournal", () => {
    it("reads memory/journal.md", async () => {
      await memory.writeFile("memory/journal.md", {
        path: "memory/journal.md",
        frontmatter: { type: "journal" },
        body: "## Principles\n\n- Focus on weakest dimension.",
      });

      const journal = await memory.getJournal();
      expect(journal.body).toContain("Focus on weakest dimension");
    });

    it("returns empty file when journal does not exist", async () => {
      const journal = await memory.getJournal();
      expect(journal.body).toBe("");
      expect(journal.frontmatter).toEqual({});
    });
  });

  describe("snapshot", () => {
    it("captures all files with their contents", async () => {
      await memory.writeFile("prompt.md", {
        path: "prompt.md",
        frontmatter: { version: 1 },
        body: "Be helpful.",
      });
      await memory.writeFile("memory/journal.md", {
        path: "memory/journal.md",
        frontmatter: {},
        body: "No entries yet.",
      });

      const snap = await memory.snapshot();

      expect(snap.id).toBeTruthy();
      expect(snap.files).toHaveLength(2);
      expect(snap.timestamp).toBeInstanceOf(Date);

      const promptFile = snap.files.find((f) => f.path === "prompt.md");
      expect(promptFile?.body).toBe("Be helpful.");
    });
  });

  describe("applyPatches", () => {
    it("creates a new file", async () => {
      await memory.applyPatches([
        {
          file: "prompt.md",
          operation: "create",
          content: {
            path: "prompt.md",
            frontmatter: { type: "prompt", version: 1 },
            body: "New prompt.",
          },
          rationale: "Initial prompt",
        },
      ]);

      const file = await memory.readFile("prompt.md");
      expect(file.body).toBe("New prompt.");
    });

    it("updates an existing file", async () => {
      await memory.writeFile("prompt.md", {
        path: "prompt.md",
        frontmatter: { version: 1 },
        body: "Old prompt.",
      });

      await memory.applyPatches([
        {
          file: "prompt.md",
          operation: "update",
          content: {
            path: "prompt.md",
            frontmatter: { version: 2 },
            body: "Updated prompt.",
          },
          rationale: "Improved clarity",
        },
      ]);

      const file = await memory.readFile("prompt.md");
      expect(file.body).toBe("Updated prompt.");
      expect(file.frontmatter.version).toBe(2);
    });

    it("appends to an existing file", async () => {
      await memory.writeFile("memory/journal.md", {
        path: "memory/journal.md",
        frontmatter: { type: "journal" },
        body: "## Principles\n\n- Be concise.",
      });

      await memory.applyPatches([
        {
          file: "memory/journal.md",
          operation: "append",
          content: {
            path: "memory/journal.md",
            frontmatter: { type: "journal" },
            body: "\n- Focus on weakest dimension.",
          },
          rationale: "Learned from run 3",
        },
      ]);

      const file = await memory.readFile("memory/journal.md");
      expect(file.body).toContain("Be concise.");
      expect(file.body).toContain("Focus on weakest dimension.");
    });

    it("applies multiple patches in order", async () => {
      await memory.applyPatches([
        {
          file: "prompt.md",
          operation: "create",
          content: { path: "prompt.md", frontmatter: { version: 1 }, body: "Prompt." },
          rationale: "Create prompt",
        },
        {
          file: "memory/observation.md",
          operation: "create",
          content: { path: "memory/observation.md", frontmatter: {}, body: "Observed X." },
          rationale: "Record observation",
        },
      ]);

      const files = await memory.listFiles("**/*.md");
      expect(files).toHaveLength(2);
    });
  });
});
