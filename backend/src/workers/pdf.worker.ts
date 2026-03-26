import PDFDocument from "pdfkit";
import { finished } from "node:stream/promises";

export type PdfWorkerTaskData = {
  userId: string;
};

async function generatePdfBuffer(task: PdfWorkerTaskData): Promise<Buffer> {
  const timeoutMsRaw = process.env.PDF_TIMEOUT_MS;
  const timeoutMs = Number(timeoutMsRaw ?? 5000);
  const effectiveTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : 5000;

  const doc = new PDFDocument({ autoFirstPage: true });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk as Buffer));

  doc.fontSize(16).text(`UserId: ${task.userId}`);

  doc.end();

  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    const generatePromise = finished(doc).then(() => Buffer.concat(chunks));
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        try {
          // Best-effort cleanup.
          (doc as any)?.destroy?.();
        } catch {
          // ignore
        }
        reject(new Error("PDF generation timeout"));
      }, effectiveTimeoutMs);
    });

    return await Promise.race([generatePromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

// Piscina (CommonJS) expects `module.exports = async (task) => ...`.
// We can't use `export =` here because we also export a type.
// eslint-disable-next-line @typescript-eslint/no-var-requires
module.exports = generatePdfBuffer;

