import { withUser } from "@/lib/route-helpers";
import { ok, fail, ERR } from "@/lib/http";
import { MAX_UPLOAD_BYTES, isAllowedMime } from "@/lib/validation";
import { extractText, sniffMime } from "@/lib/extract-text";
import { readCv } from "@/lib/ai/tasks";
import { saveCvRead } from "@/lib/cv-store";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * "Skip: upload my CV instead".
 *
 * The file is read into memory, turned into answers, and dropped. It is never
 * written to storage, which is the strongest possible reading of the PRD's
 * "delete the uploaded CV file once its answers are saved".
 */
export async function POST(request: Request) {
  return withUser("upload", async ({ user, supabase }) => {
    let form: FormData;
    try { form = await request.formData(); }
    catch { return fail(400, ERR.invalid); }

    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "No file was uploaded.");
    if (file.size === 0) return fail(400, "That file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) {
      await audit("upload_rejected", user.id, { reason: "too_large" });
      return fail(413, ERR.tooLarge);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Trust the bytes, not the browser's Content-Type.
    const sniffed = sniffMime(bytes);
    if (!sniffed || !isAllowedMime(sniffed)) {
      await audit("upload_rejected", user.id, { reason: "bad_type" });
      return fail(415, ERR.badType);
    }
    if (sniffed.startsWith("image/")) {
      return fail(415, "We cannot read a CV from a photo yet. Upload a PDF or Word file.");
    }

    const text = await extractText(bytes, sniffed);
    if (text.trim().length < 50) {
      return fail(422, "We could not read that file. Please fill in the questions instead.", {
        unreadable: true,
      });
    }

    await audit("cv_uploaded", user.id, { kind: sniffed });

    const result = await readCv(text);
    await saveCvRead(supabase, user.id, result.data);

    // The bytes go out of scope here; nothing was ever persisted.
    await audit("cv_file_deleted", user.id, {});

    return ok({
      engine: result.engine,
      note: result.note ?? null,
      blank_fields: result.data.blank_fields,
      contained_instructions: result.data.contained_instructions,
    });
  });
}
