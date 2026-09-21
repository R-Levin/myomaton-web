import "server-only";
import path from "node:path";
import { JsonFileContentRepository } from "./json-file-repository";
import type { ContentRepository } from "./repository";

// The adapter shares a per-file write queue across development hot reloads.
export const contentRepository: ContentRepository = new JsonFileContentRepository(
    process.env.MYOMATON_CONTENT_DIR || path.join(process.cwd(), "runtime-content"),
  );
