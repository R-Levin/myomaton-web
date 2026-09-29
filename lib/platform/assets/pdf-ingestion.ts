// PDF.js parses the document structure without rendering, extraction or editing.
export async function preparePdf(input: Buffer) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(input.subarray(0, 12).toString("ascii")) || !/%%EOF\s*$/.test(input.subarray(-1024).toString("ascii"))) throw new Error("Invalid PDF envelope.");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Explicit import makes the Node parser worker visible to the bundler/tracer.
  // The package registers its in-process WorkerMessageHandler on import.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const task = getDocument({ data: new Uint8Array(input), stopAtErrors: true, useSystemFonts: false, verbosity: 0 });
  try {
    const doc = await task.promise;
    if (doc.numPages < 1) throw new Error("PDF has no pages.");
    for (let i = 1; i <= doc.numPages; i++) await doc.getPage(i);
    return { bytes: input, type: "document" as const, mimeType: "application/pdf", width: null, height: null };
  } finally { await task.destroy(); }
}
