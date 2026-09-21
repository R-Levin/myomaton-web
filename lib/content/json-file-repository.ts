import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { HomepageContent, WorkingCopy } from "@/types/content";
import { ContentConflictError, type ContentRepository } from "./repository";
import { parseHomepageContent, parseWorkingCopy } from "./validation";

const emptyContent = (): HomepageContent => ({ schemaVersion: 1, draft: null, published: null });
const runtime = globalThis as typeof globalThis & { myomatonWriteQueues?: Map<string, Promise<unknown>> };
const queues = runtime.myomatonWriteQueues ??= new Map<string, Promise<unknown>>();

export class JsonFileContentRepository implements ContentRepository {
  private readonly filename: string;

  constructor(private readonly directory: string) {
    this.filename = path.resolve(directory, "homepage.json");
  }

  async read(): Promise<HomepageContent> {
    try {
      return parseHomepageContent(JSON.parse(await readFile(this.filename, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyContent();
      throw error; // Never replace a damaged document with an empty one.
    }
  }

  private serialize(operation: () => Promise<HomepageContent>) {
    const result = (queues.get(this.filename) ?? Promise.resolve()).then(operation);
    queues.set(this.filename, result.catch(() => undefined));
    return result;
  }

  private async write(content: HomepageContent) {
    await mkdir(this.directory, { recursive: true });
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(content, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      await rename(temporary, this.filename);
    } finally {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
    return content;
  }

  saveDraft(snapshot: WorkingCopy, expectedSavedAt: string | null) {
    const validated = parseWorkingCopy(snapshot);
    return this.serialize(async () => {
      const content = await this.read();
      if ((content.draft?.savedAt ?? null) !== expectedSavedAt) {
        throw new ContentConflictError("The saved draft changed in another editor. Reload before saving.");
      }
      const savedAt = new Date(Math.max(Date.now(), Date.parse(content.draft?.savedAt ?? "1970-01-01") + 1)).toISOString();
      return this.write({ ...content, draft: { snapshot: validated, savedAt } });
    });
  }

  publish(expectedSavedAt: string) {
    return this.serialize(async () => {
      const content = await this.read();
      if (!content.draft || content.draft.savedAt !== expectedSavedAt) {
        throw new ContentConflictError("Save Draft first, or reload if the saved draft changed.");
      }
      return this.write({ ...content, published: {
        ...content.draft, publishedAt: new Date().toISOString(),
      } });
    });
  }
}
