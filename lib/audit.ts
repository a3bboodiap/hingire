import "server-only";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

/**
 * Security event log.
 *
 * Rule: no personal data. Record what happened and to which user id, never
 * names, emails, phone numbers, codes, document contents or review text.
 */
export type AuditEvent =
  | "signup"
  | "login"
  | "login_failed"
  | "otp_sent"
  | "otp_verified"
  | "otp_failed"
  | "age_gate_blocked"
  | "cv_uploaded"
  | "cv_file_deleted"
  | "ranking_computed"
  | "job_saved"
  | "job_dismissed"
  | "application_stage_changed"
  | "rejection_logged"
  | "kyc_consent"
  | "kyc_attempt"
  | "kyc_rate_limited"
  | "review_submitted"
  | "review_blocked_unverified"
  | "review_reported"
  | "proof_uploaded"
  | "proof_deleted"
  | "data_exported"
  | "account_deleted"
  | "rate_limited"
  | "csrf_blocked"
  | "upload_rejected";

export async function audit(
  event: AuditEvent,
  userId: string | null,
  meta: Record<string, string | number | boolean | null> = {},
) {
  if (!adminConfigured()) {
    console.info(`[audit] ${event}`, { userId, ...meta });
    return;
  }
  try {
    await createAdminClient().from("audit_log").insert({
      user_id: userId,
      event,
      meta,
    });
  } catch (e) {
    console.error(`[audit] failed to write ${event}:`, (e as Error).message);
  }
}
