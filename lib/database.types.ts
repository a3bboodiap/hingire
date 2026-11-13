/**
 * Database types.
 *
 * Kept in step with supabase/migrations/*.sql by hand. Once you have the
 * Supabase CLI linked you can regenerate with:
 *   supabase gen types typescript --linked > lib/database.types.ts
 */
export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type EducationLevel = "high_school" | "bachelors" | "masters" | "other";
export type SkillLevel = "basic" | "good" | "advanced";
export type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "native";
export type ContractType = "internship" | "part_time" | "full_time";
export type WorkMode = "remote" | "hybrid" | "on_site";
export type ApplicationStage = "saved" | "applied" | "interview" | "offer" | "rejected";
export type RejectionStage = "cv_screen" | "assessment" | "interview" | "final_round";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type KycStatus = "none" | "pending" | "passed" | "failed" | "manual_review";
export type OtpChannel = "email" | "phone";
export type ConsentKind = "terms" | "privacy" | "cookies" | "biometric" | "ai_ranking";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  location: string | null;
  phone: string | null;
  date_of_birth: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  is_adult: boolean;
  kyc_status: KycStatus;
  kyc_verified_at: string | null;
  kyc_provider_ref: string | null;
  kyc_over_18: boolean | null;
  kyc_name_match: boolean | null;
  flagged_for_review: boolean;
  feed_sort: "ai_rank" | "newest";
  onboarding_step: string;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  location: string;
  pay_min: number | null;
  pay_max: number | null;
  currency: string;
  contract_type: ContractType;
  work_mode: WorkMode;
  skills_wanted: string[];
  languages_wanted: string[];
  source_name: string;
  source_url: string;
  posted_at: string;
  closed: boolean;
  is_sample: boolean;
};

export type ReviewRow = {
  id: string;
  author_id: string;
  job_id: string;
  company_id: string;
  job_title: string;
  job_description: string;
  job_location: string;
  contract_type: ContractType;
  months_worked: number;
  overall: number;
  pay_fairness: number;
  workload: number;
  learning: number;
  management: number;
  would_recommend: boolean;
  comment: string;
  status: ReviewStatus;
  moderation_note: string | null;
  removal_reason: string | null;
  ai_flags: Json;
  proof_path: string | null;
  proof_checked: boolean;
  proof_delete_after: string | null;
  year_label: number;
  is_sample: boolean;
  created_at: string;
  published_at: string | null;
};

export type ApplicationRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  external_title: string | null;
  external_company: string | null;
  stage: ApplicationStage;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RejectionRow = {
  id: string;
  user_id: string;
  application_id: string;
  rejected_on: string;
  stage: RejectionStage;
  reason: string | null;
  note: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      companies: Table<{ id: string; name: string; is_sample: boolean; created_at: string }>;
      jobs: Table<JobRow>;
      cv_education: Table<{
        id: string; user_id: string; level: EducationLevel | null; school: string | null;
        field: string | null; start_year: number | null; end_year: number | null;
        sort_order: number; created_at: string;
      }>;
      cv_experience: Table<{
        id: string; user_id: string; job_title: string | null; company: string | null;
        start_month: string | null; end_month: string | null; description: string | null;
        sort_order: number; created_at: string;
      }>;
      cv_skills: Table<{
        id: string; user_id: string; name: string; level: SkillLevel; created_at: string;
      }>;
      cv_languages: Table<{
        id: string; user_id: string; language: string; level: LanguageLevel; created_at: string;
      }>;
      cv_certificates: Table<{
        id: string; user_id: string; name: string; issuer: string | null;
        year: number | null; created_at: string;
      }>;
      cv_preferences: Table<{
        user_id: string; roles: string[]; cities: string[];
        contract_types: ContractType[]; min_pay: number | null;
        work_modes: WorkMode[]; earliest_start: string | null; updated_at: string;
      }>;
      cv_progress: Table<{
        user_id: string; current_step: number; completed_steps: number[];
        blank_fields: Json; filled_from_cv: boolean; updated_at: string;
      }>;
      job_matches: Table<{
        user_id: string; job_id: string; score: number; reason: string;
        engine: string; computed_at: string;
      }>;
      ranking_logs: Table<{
        id: string; user_id: string; job_id: string; score: number; reason: string;
        engine: string; model: string | null; input_summary: Json; created_at: string;
      }>;
      saved_jobs: Table<{ id: string; user_id: string; job_id: string; created_at: string }>;
      dismissed_jobs: Table<{ id: string; user_id: string; job_id: string; created_at: string }>;
      applications: Table<ApplicationRow>;
      rejections: Table<RejectionRow>;
      reviews: Table<ReviewRow>;
      review_reports: Table<{
        id: string; review_id: string; reporter_id: string | null;
        reason: string; created_at: string;
      }>;
      job_comments: Table<{
        id: string; user_id: string; job_id: string; body: string;
        status: ReviewStatus; created_at: string;
      }>;
      kyc_attempts: Table<{
        id: string; user_id: string; route: "document" | "electronic_id";
        result: "passed" | "failed" | "manual_review"; reason: string | null; created_at: string;
      }>;
      consents: Table<{
        id: string; user_id: string; kind: ConsentKind; granted: boolean; created_at: string;
      }>;
      otp_codes: Table<{
        id: string; user_id: string; channel: OtpChannel; code_hash: string;
        expires_at: string; consumed: boolean; attempts: number; created_at: string;
      }>;
      rate_limits: Table<{
        id: number; subject: string; bucket: string; window_start: string; count: number;
      }>;
      audit_log: Table<{
        id: number; user_id: string | null; event: string; meta: Json; created_at: string;
      }>;
      moderators: Table<{ user_id: string; added_at: string; mfa_enrolled: boolean }>;
    };
    Views: {
      job_review_stats: {
        Row: { job_id: string; avg_rating: number; review_count: number };
        Relationships: [];
      };
    };
    Functions: {
      bump_rate_limit: {
        Args: {
          p_subject: string; p_bucket: string; p_window_start: string; p_max: number;
        };
        Returns: number;
      };
      rejection_stats: { Args: { p_user: string }; Returns: Json };
      export_my_data: { Args: Record<string, never>; Returns: Json };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      purge_expired_proofs: { Args: Record<string, never>; Returns: number };
      is_moderator: { Args: Record<string, never>; Returns: boolean };
      is_active_moderator: { Args: Record<string, never>; Returns: boolean };
      has_passed_kyc: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      education_level: EducationLevel;
      skill_level: SkillLevel;
      language_level: LanguageLevel;
      contract_type: ContractType;
      work_mode: WorkMode;
      application_stage: ApplicationStage;
      rejection_stage: RejectionStage;
      review_status: ReviewStatus;
      kyc_status: KycStatus;
      otp_channel: OtpChannel;
      consent_kind: ConsentKind;
    };
    CompositeTypes: Record<string, never>;
  };
};
