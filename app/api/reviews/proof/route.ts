import { withUser } from "@/lib/route-helpers";
import { ok, fail, ERR } from "@/lib/http";
import { MAX_UPLOAD_BYTES, isAllowedMime, ALLOWED_UPLOAD_TYPES } from "@/lib/validation";
import { sniffMime, extractText } from "@/lib/extract-text";
import { checkProof } from "@/lib/ai/tasks";
import { canPublishReviews } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Proof of work upload + pre-check.
 * Private bucket, renamed on save, stored under the user's own folder so the
 * storage policy scopes it even if a path were tampered with.
 */
export async function POST(request: Request) {
  return withUser("upload", async ({ user, profile, supabase }) => {
    if (!canPublishReviews(profile)) {
      await audit("review_blocked_unverified", user.id, { at: "proof_upload" });
      return fail(403, "You need to verify your identity before uploading proof.");
    }

    let form: FormData;
    try { form = await request.formData(); } catch { return fail(400, ERR.invalid); }

    const file = form.get("file");
    const company = String(form.get("company") ?? "").slice(0, 140);
    const months = Number(form.get("months_worked") ?? 0);
    if (!(file instanceof File)) return fail(400, "No file was uploaded.");
    if (file.size > MAX_UPLOAD_BYTES) return fail(413, ERR.tooLarge);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffMime(bytes);
    if (!mime || !isAllowedMime(mime)) {
      await audit("upload_rejected", user.id, { reason: "bad_type" });
      return fail(415, ERR.badType);
    }

    const ext = ALLOWED_UPLOAD_TYPES[mime];
    // Renamed on save: the original filename never reaches storage.
    const path = `${user.id}/${randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("proofs")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) return fail(500, "Could not store that file.");

    await audit("proof_uploaded", user.id, { kind: mime });

    const text = mime.startsWith("image/") ? "" : await extractText(bytes, mime);
    const personName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

    const check = await checkProof({
      text: text || "(image document — text could not be extracted)",
      company,
      personName,
      monthsWorked: months,
    });

    return ok({
      path,
      engine: check.engine,
      company_name_found: check.data.company_name_found,
      person_name_found: check.data.person_name_found,
      dates_found: check.data.dates_found,
      document_kind: check.data.document_kind,
    });
  });
}
