import { z } from "zod";

/**
 * One place for every request shape. Route handlers never read an unvalidated
 * body, and nothing from the browser is trusted as an identity — note that no
 * schema here accepts a user_id: the server always takes that from the session.
 */

export const email = z.string().trim().toLowerCase().email().max(254);

// Deliberately permissive on format, strict on length: phone numbering plans
// vary and over-tight regexes reject legitimate numbers.
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()\-.]{6,20}$/, "Enter a valid phone number")
  .transform((s) => s.replace(/[^\d+]/g, ""));

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Free text that will be shown back to a human. Trim + cap, never HTML. */
export const text = (max: number, min = 0) =>
  z.string().trim().min(min).max(max);

export const uuid = z.string().uuid();

export const otpCode = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const contractType = z.enum(["internship", "part_time", "full_time"]);
export const workMode = z.enum(["remote", "hybrid", "on_site"]);
export const skillLevel = z.enum(["basic", "good", "advanced"]);
export const languageLevel = z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "native"]);
export const educationLevel = z.enum(["high_school", "bachelors", "masters", "other"]);
export const applicationStage = z.enum([
  "saved", "applied", "interview", "offer", "rejected",
]);
export const rejectionStage = z.enum([
  "cv_screen", "assessment", "interview", "final_round",
]);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const startAuthSchema = z.object({
  email,
  mode: z.enum(["login", "signup"]),
});

export const verifyEmailSchema = z.object({
  email,
  code: otpCode,
});

export const sendPhoneCodeSchema = z.object({ phone });
export const verifyPhoneCodeSchema = z.object({ code: otpCode });

// ---------------------------------------------------------------------------
// Screen 2 — Info (personal details)
// ---------------------------------------------------------------------------
export const infoSchema = z.object({
  first_name: text(60, 1),
  last_name: text(60, 1),
  location: text(120, 1),
  phone,
  date_of_birth: isoDate,
});

// ---------------------------------------------------------------------------
// Screen 3 — the six questionnaire steps
// ---------------------------------------------------------------------------
export const educationItem = z.object({
  level: educationLevel.nullable().optional(),
  school: text(140).optional(),
  field: text(140).optional(),
  start_year: z.number().int().min(1950).max(2100).nullable().optional(),
  end_year: z.number().int().min(1950).max(2100).nullable().optional(),
});

export const experienceItem = z.object({
  job_title: text(140).optional(),
  company: text(140).optional(),
  start_month: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  end_month: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  description: text(600).optional(),
});

export const skillItem = z.object({
  name: text(60, 1),
  level: skillLevel,
});

export const languageItem = z.object({
  language: text(60, 1),
  level: languageLevel,
});

export const certificateItem = z.object({
  name: text(140, 1),
  issuer: text(140).optional(),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
});

export const preferencesSchema = z.object({
  roles: z.array(text(80, 1)).max(10),
  cities: z.array(text(80, 1)).max(10),
  contract_types: z.array(contractType).max(3),
  min_pay: z.number().int().min(0).max(1_000_000).nullable().optional(),
  work_modes: z.array(workMode).max(3),
  earliest_start: isoDate.nullable().optional(),
});

export const cvStepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal(1), items: z.array(educationItem).max(10) }),
  z.object({ step: z.literal(2), items: z.array(experienceItem).max(15), none: z.boolean().optional() }),
  z.object({ step: z.literal(3), items: z.array(skillItem).max(40) }),
  z.object({ step: z.literal(4), items: z.array(languageItem).max(15) }),
  z.object({ step: z.literal(5), items: z.array(certificateItem).max(20) }),
  z.object({ step: z.literal(6), preferences: preferencesSchema }),
]);

// ---------------------------------------------------------------------------
// Feed, saves, applications
// ---------------------------------------------------------------------------
export const jobActionSchema = z.object({
  job_id: uuid,
  action: z.enum(["save", "dismiss", "unsave"]),
});

export const stageChangeSchema = z.object({
  application_id: uuid,
  stage: applicationStage,
});

export const externalApplicationSchema = z.object({
  external_title: text(140, 1),
  external_company: text(140, 1),
  stage: applicationStage.default("applied"),
});

export const applySchema = z.object({
  job_id: uuid,
  applied: z.boolean(),
});

export const rejectionSchema = z.object({
  application_id: uuid,
  rejected_on: isoDate,
  stage: rejectionStage,
  reason: text(300).optional(),
  note: text(1000).optional(),
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
const star = z.number().int().min(1).max(5);

export const reviewSchema = z.object({
  job_id: uuid,
  job_title: text(140, 2),
  job_description: text(2000, 10),
  job_location: text(140, 2),
  contract_type: contractType,
  months_worked: z.number().int().min(1).max(600),
  overall: star,
  pay_fairness: star,
  workload: star,
  learning: star,
  management: star,
  would_recommend: z.boolean(),
  comment: text(4000, 20),
  proof_path: z.string().trim().min(1).max(400),
});

export const reportSchema = z.object({
  review_id: uuid,
  reason: text(500, 5),
});

export const commentSchema = z.object({
  job_id: uuid,
  body: text(2000, 1),
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
export const consentSchema = z.object({
  biometric: z.boolean(),
  route: z.enum(["document", "electronic_id"]),
});

// ---------------------------------------------------------------------------
// Uploads — the server re-checks both of these against the real bytes.
// ---------------------------------------------------------------------------
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export type AllowedMime = keyof typeof ALLOWED_UPLOAD_TYPES;

export function isAllowedMime(t: string): t is AllowedMime {
  return t in ALLOWED_UPLOAD_TYPES;
}
