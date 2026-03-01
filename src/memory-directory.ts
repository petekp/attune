// Filesystem-backed implementation of MemoryStore. The memory directory
// is a plain folder of markdown files. No database, no custom format.
// This means you can inspect, edit, and version-control the AI's state
// with standard tools (git, grep, your editor).
//
// Uses gray-matter for YAML frontmatter parsing and minimatch for
// glob-based file filtering.
//
// Why filesystem over a DB: the audience for attune is developers who
// want to understand and debug their AI's self-improvement. Plain files
// make state transparent. The tradeoff is no concurrent write safety,
// which is fine for single-loop execution.

import { readFile as fsReadFile, writeFile as fsWriteFile, readdir, mkdir } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import matter from "gray-matter";
import { minimatch } from "minimatch";
import type { MemoryFile, FileManifest, MemorySnapshot, MemoryPatch } from "./types.js";
import type { MemoryStore } from "./interfaces.js";

export class MemoryDirectory implements MemoryStore {
  constructor(private basePath: string) {}

  async readFile(relativePath: string): Promise<MemoryFile> {
    const fullPath = join(this.basePath, relativePath);
    const raw = await fsReadFile(fullPath, "utf-8");
    const { data, content } = matter(raw);

    return {
      path: relativePath,
      frontmatter: data as Record<string, unknown>,
      body: content.trim(),
    };
  }

  async writeFile(relativePath: string, file: MemoryFile): Promise<void> {
    const fullPath = join(this.basePath, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });

    const output = Object.keys(file.frontmatter).length > 0
      ? matter.stringify(file.body, file.frontmatter)
      : file.body;

    await fsWriteFile(fullPath, output, "utf-8");
  }

  async listFiles(glob?: string): Promise<string[]> {
    const results: string[] = [];
    await this.walkDir(this.basePath, results);
    if (glob) {
      return results.filter((f) => minimatch(f, glob));
    }
    return results;
  }

  /**
   * Returns frontmatter for matching files without reading their bodies.
   * This saves tokens when components only need metadata (type, version,
   * timestamps) to decide which files to read in full.
   */
  async scanFrontmatter(glob?: string): Promise<FileManifest[]> {
    const files = await this.listFiles(glob ?? "**/*.md");
    const manifests: FileManifest[] = [];

    for (const filePath of files) {
      const fullPath = join(this.basePath, filePath);
      const raw = await fsReadFile(fullPath, "utf-8");
      const { data } = matter(raw);
      manifests.push({
        path: filePath,
        frontmatter: data as Record<string, unknown>,
      });
    }

    return manifests;
  }

  async getPrompt(): Promise<MemoryFile> {
    return this.readFile("prompt.md");
  }

  /**
   * Returns the adapter's journal, or an empty file if none exists yet.
   * Graceful fallback is intentional: on the first run there's no journal,
   * and callers shouldn't need to handle that edge case.
   */
  async getJournal(): Promise<MemoryFile> {
    try {
      return await this.readFile("memory/journal.md");
    } catch {
      return { path: "memory/journal.md", frontmatter: {}, body: "" };
    }
  }

  /**
   * Captures a frozen copy of all markdown files in the directory.
   * Only .md files are included. YAML history files and other artifacts
   * are excluded to keep snapshots focused on the state that matters
   * for attuning (prompts, journal, observations).
   */
  async snapshot(): Promise<MemorySnapshot> {
    const filePaths = await this.listFiles();
    const files: MemoryFile[] = [];

    for (const filePath of filePaths) {
      if (filePath.endsWith(".md")) {
        files.push(await this.readFile(filePath));
      }
    }

    return {
      id: randomUUID(),
      files,
      timestamp: new Date(),
    };
  }

  async applyPatches(patches: MemoryPatch[]): Promise<void> {
    for (const patch of patches) {
      switch (patch.operation) {
        case "create":
        case "update":
          await this.writeFile(patch.file, patch.content);
          break;
        case "append": {
          let existing: MemoryFile;
          try {
            existing = await this.readFile(patch.file);
          } catch {
            existing = { path: patch.file, frontmatter: {}, body: "" };
          }
          await this.writeFile(patch.file, {
            path: patch.file,
            frontmatter: patch.content.frontmatter,
            body: existing.body + patch.content.body,
          });
          break;
        }
      }
    }
  }

  private async walkDir(currentDir: string, results: string[]): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await this.walkDir(fullPath, results);
      } else {
        results.push(relative(this.basePath, fullPath));
      }
    }
  }
}
