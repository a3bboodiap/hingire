import "server-only";
import { unzipSync, strFromU8 } from "fflate";

/** Pull plain text out of an uploaded CV or proof document. */
export async function extractText(bytes: Uint8Array, mime: string): Promise<string> {
  try {
    if (mime === "application/pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await pdfText(pdf, { mergePages: true });
      return typeof text === "string" ? text : String(text ?? "");
    }
    if (mime.endsWith("wordprocessingml.document")) {
      const files = unzipSync(bytes);
      const doc = files["word/document.xml"];
      if (!doc) return "";
      return strFromU8(doc)
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/[ \t]+/g, " ")
        .trim();
    }
    return "";
  } catch (e) {
    console.error("[extract-text]", (e as Error).message);
    return "";
  }
}

/** Magic-byte sniff: the declared Content-Type is not trusted. */
export function sniffMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) {
    try {
      const files = unzipSync(b);
      if (files["word/document.xml"]) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
    } catch { /* not a readable zip */ }
    return null;
  }
  return null;
}
