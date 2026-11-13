import { withUser } from "@/lib/route-helpers";
import { ok, fail, ERR } from "@/lib/http";
import { MAX_UPLOAD_BYTES } from "@/lib/validation";
import { sniffMime } from "@/lib/extract-text";
import { checkIdPhoto } from "@/lib/ai/tasks";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { peekRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { isAdult } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Prototype ID check.
 *
 * The image is held in memory for this request only. It is never written to
 * storage and never logged — the PRD forbids storing ID documents, and we
 * keep only the outcome.
 *
 * The model reports observations. THIS CODE decides pass or fail:
 * any "no", a date of birth that does not match the account, or under 18.
 */
export async function POST(request: Request) {
  return withUser("kyc", async ({ user, profile, supabase }) => {
    let form: FormData;
    try { form = await request.formData(); } catch { return fail(400, ERR.invalid); }

    const file = form.get("photo");
    if (!(file instanceof File)) return fail(400, "No photo was captured.");
    if (file.size > MAX_UPLOAD_BYTES) return fail(413, ERR.tooLarge);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffMime(bytes);
    if (mime !== "image/jpeg" && mime !== "image/png") {
      return fail(415, "That is not a photo we can read. Use the camera.");
    }

    const check = await checkIdPhoto({
      mediaType: mime,
      data: Buffer.from(bytes).toString("base64"),
    });
    const o = check.data;

    // ---- the app decides, not the model ----
    const reasons: string[] = [];
    if (!o.is_id_document) reasons.push("that does not look like a passport, national ID or residence card");
    if (o.document_type === "none" || o.document_type === "other") reasons.push("we could not tell which kind of document it is");
    if (!o.all_corners_visible) reasons.push("all four corners need to be inside the frame");
    if (!o.text_readable) reasons.push("the text is not readable");
    if (o.blur_or_glare) reasons.push("there is blur or glare on the document");
    if (!o.date_of_birth) reasons.push("we could not read the date of birth");
    else {
      if (profile.date_of_birth && o.date_of_birth !== profile.date_of_birth) {
        reasons.push("the date of birth does not match the one on your account");
      }
      if (!isAdult(o.date_of_birth)) reasons.push("the document shows you are under 18");
    }

    const passed = reasons.length === 0;
    const dobMismatch = Boolean(
      profile.date_of_birth && o.date_of_birth && o.date_of_birth !== profile.date_of_birth,
    );

    const detail = passed
      ? "Document check passed."
      : `We could not accept that photo because ${reasons.join(", and ")}.` +
        (o.reason ? ` ${o.reason}` : "");

    if (adminConfigured()) {
      const admin = createAdminClient();
      await admin.from("kyc_attempts").insert({
        user_id: user.id, route: "document",
        result: passed ? "passed" : dobMismatch ? "manual_review" : "failed",
        reason: passed ? null : reasons.join("; "),
      } as never);

      // KYC policy: a mismatched date of birth flags the account for a human.
      await admin.from("profiles").update({
        kyc_status: passed ? "passed" : dobMismatch ? "manual_review" : "failed",
        kyc_verified_at: passed ? new Date().toISOString() : null,
        kyc_over_18: o.date_of_birth ? isAdult(o.date_of_birth) : null,
        kyc_name_match: o.full_name
          ? normalise(o.full_name).includes(normalise(profile.last_name ?? ""))
          : null,
        kyc_provider_ref: `prototype:${check.engine}`,
        flagged_for_review: dobMismatch,
      }).eq("id", user.id);
    } else {
      await supabase.from("profiles").update({}).eq("id", user.id);
    }

    await audit("kyc_attempt", user.id, {
      route: "document", passed, engine: check.engine, dobMismatch,
    });

    const { used, max } = await peekRateLimit(`user:${user.id}`, "kyc");

    // The image goes out of scope here. Nothing was stored.
    return ok({
      passed,
      detail,
      engine: check.engine,
      manualReview: dobMismatch,
      attemptsUsed: used,
      attemptsMax: max,
    });
  });
}

function normalise(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}
