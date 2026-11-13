import { z } from "zod";

/**
 * Output shapes for the six AI tasks in the PRD's "AI features" section.
 *
 * Every task returns structured JSON with fixed fields so the app can check
 * the output instead of trusting free text. These same schemas generate the
 * tool definition sent to the model, so the contract cannot drift.
 */

const nullableText = (max: number) => z.string().max(max).nullable();

// --- 1. CV reader ----------------------------------------------------------
// Anything it could not find is left empty, and the UI highlights it.
// It must ignore date of birth, gender, nationality and photo: there are no
// fields for them here, so there is nowhere for them to go.
export const cvReadSchema = z.object({
  education: z.array(z.object({
    level: z.enum(["high_school", "bachelors", "masters", "other"]).nullable(),
    school: nullableText(140),
    field: nullableText(140),
    start_year: z.number().int().min(1950).max(2100).nullable(),
    end_year: z.number().int().min(1950).max(2100).nullable(),
  })).max(10),
  experience: z.array(z.object({
    job_title: nullableText(140),
    company: nullableText(140),
    start_month: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
    end_month: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
    description: nullableText(600),
  })).max(15),
  skills: z.array(z.object({
    name: z.string().min(1).max(60),
    level: z.enum(["basic", "good", "advanced"]),
  })).max(40),
  languages: z.array(z.object({
    language: z.string().min(1).max(60),
    level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "native"]),
  })).max(15),
  certificates: z.array(z.object({
    name: z.string().min(1).max(140),
    issuer: nullableText(140),
    year: z.number().int().min(1950).max(2100).nullable(),
  })).max(20),
  preferences: z.object({
    roles: z.array(z.string().max(80)).max(10),
    cities: z.array(z.string().max(80)).max(10),
    contract_types: z.array(z.enum(["internship", "part_time", "full_time"])).max(3),
    min_pay: z.number().int().min(0).max(1_000_000).nullable(),
    work_modes: z.array(z.enum(["remote", "hybrid", "on_site"])).max(3),
    earliest_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }),
  /** Field paths the reader could not fill, so the UI can highlight them. */
  blank_fields: z.array(z.string().max(60)).max(40),
  /** Set if the document tried to issue instructions rather than describe a person. */
  contained_instructions: z.boolean(),
});
export type CvRead = z.infer<typeof cvReadSchema>;

// --- 2. Match score and reason --------------------------------------------
export const matchSchema = z.object({
  score: z.number().int().min(0).max(100),
  // "one plain sentence on why it fits, naming the matching skills or languages"
  reason: z.string().min(3).max(200),
  matched_skills: z.array(z.string().max(60)).max(8),
  matched_languages: z.array(z.string().max(40)).max(5),
});
export type MatchResult = z.infer<typeof matchSchema>;

// --- 3. ID photo check (prototype only) ------------------------------------
// The app, not the model, decides pass or fail from these fields.
export const idCheckSchema = z.object({
  is_id_document: z.boolean(),
  document_type: z.enum(["passport", "national_id", "residence_card", "other", "none"]),
  all_corners_visible: z.boolean(),
  text_readable: z.boolean(),
  blur_or_glare: z.boolean(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  full_name: nullableText(140),
  reason: z.string().max(300),
});
export type IdCheck = z.infer<typeof idCheckSchema>;

// --- 4. Proof of work pre-check -------------------------------------------
// A moderator still makes the final decision.
export const proofCheckSchema = z.object({
  company_name_found: z.boolean(),
  person_name_found: z.boolean(),
  dates_found: z.boolean(),
  start_date: nullableText(20),
  end_date: nullableText(20),
  document_kind: z.enum([
    "contract", "payslip", "certificate", "internship_agreement",
    "reference_letter", "work_email", "other", "unreadable",
  ]),
  moderator_note: z.string().max(600),
});
export type ProofCheck = z.infer<typeof proofCheckSchema>;

// --- 5. Review pre-screen --------------------------------------------------
export const reviewScreenSchema = z.object({
  personal_names: z.boolean(),
  insults: z.boolean(),
  personal_data: z.boolean(),
  off_topic: z.boolean(),
  /** Short, factual, for the moderator — not shown to the public. */
  note: z.string().max(400),
});
export type ReviewScreen = z.infer<typeof reviewScreenSchema>;

// --- 6. Rejection summary --------------------------------------------------
// Patterns only, no advice.
export const rejectionSummarySchema = z.object({
  most_common_stage: z.enum([
    "cv_screen", "assessment", "interview", "final_round", "none",
  ]),
  recurring_skills: z.array(z.string().max(60)).max(6),
  recurring_role_types: z.array(z.string().max(80)).max(5),
  /** Two or three short sentences. */
  summary: z.string().max(400),
});
export type RejectionSummary = z.infer<typeof rejectionSummarySchema>;
