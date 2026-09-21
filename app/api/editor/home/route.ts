import { contentRepository } from "@/lib/content/storage";
import { checkEditorRequest } from "@/lib/content/access";
import { ContentConflictError } from "@/lib/content/repository";
import { InvalidContentError, object, parseWorkingCopy, timestamp } from "@/lib/content/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = checkEditorRequest(request);
  if (denied) return denied;
  return Response.json(await contentRepository.read(), { headers: { "Cache-Control": "no-store" } });
}

async function write(request: Request, publishing: boolean) {
  const denied = checkEditorRequest(request, true);
  if (denied) return denied;
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "JSON is required." }, { status: 415 });
  }
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1_000_000) {
      return Response.json({ error: "Content exceeds 1 MB." }, { status: 413 });
    }
    const body = object(JSON.parse(raw));
    const content = publishing
      ? await contentRepository.publish(timestamp(body.expectedSavedAt))
      : await contentRepository.saveDraft(
          parseWorkingCopy(body.snapshot),
          body.expectedSavedAt === null ? null : timestamp(body.expectedSavedAt),
        );
    return Response.json(content, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof ContentConflictError ? 409
      : error instanceof InvalidContentError || error instanceof SyntaxError ? 400 : 500;
    return Response.json({ error: status === 500 ? "Content storage failed. Your working copy has not been cleared." : (error as Error).message }, { status });
  }
}

export async function PUT(request: Request) { return write(request, false); }
export async function POST(request: Request) { return write(request, true); }
