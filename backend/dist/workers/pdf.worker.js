"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pdfkit_1 = __importDefault(require("pdfkit"));
const promises_1 = require("node:stream/promises");
async function generatePdfBuffer(task) {
    const timeoutMsRaw = process.env.PDF_TIMEOUT_MS;
    const timeoutMs = Number(timeoutMsRaw ?? 5000);
    const effectiveTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : 5000;
    const doc = new pdfkit_1.default({ autoFirstPage: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.fontSize(16).text(`UserId: ${task.userId}`);
    doc.end();
    let timeoutHandle = null;
    try {
        const generatePromise = (0, promises_1.finished)(doc).then(() => Buffer.concat(chunks));
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                try {
                    // Best-effort cleanup.
                    doc?.destroy?.();
                }
                catch {
                    // ignore
                }
                reject(new Error("PDF generation timeout"));
            }, effectiveTimeoutMs);
        });
        return await Promise.race([generatePromise, timeoutPromise]);
    }
    finally {
        if (timeoutHandle)
            clearTimeout(timeoutHandle);
    }
}
// Piscina (CommonJS) expects `module.exports = async (task) => ...`.
// We can't use `export =` here because we also export a type.
// eslint-disable-next-line @typescript-eslint/no-var-requires
module.exports = generatePdfBuffer;
//# sourceMappingURL=pdf.worker.js.map