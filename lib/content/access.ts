export function editorAvailable() {
  return process.env.NODE_ENV === "development";
}

// Replace this boundary with authentication/authorization when the editor is hosted.
export function checkEditorRequest(request: Request, writing = false): Response | null {
  if (!editorAvailable()) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  // Next's development server may normalize request.url to localhost even when
  // the browser used 127.0.0.1. Host is the authority actually requested.
  const origin = `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (writing && (request.headers.get("origin") !== origin ||
      request.headers.get("sec-fetch-site") === "cross-site")) {
    return Response.json({ error: "Same-origin requests are required." }, { status: 403 });
  }
  return null;
}
