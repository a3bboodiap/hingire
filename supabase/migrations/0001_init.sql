-- ============================================================================
-- Job Finder App — initial schema
-- Security requirement: Row Level Security on EVERY table from the first
-- migration. Users may only read and write their own rows. Reviews are
-- publicly readable only when status = 'approved'.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type education_level  as enum ('high_school','bachelors','masters','other');
create type skill_level      as enum ('basic','good','advanced');
create type language_level   as enum ('A1','A2','B1','B2','C1','C2','native');
create type contract_type    as enum ('internship','part_time','full_time');
create type work_mode        as enum ('remote','hybrid','on_site');
create type application_stage as enum ('saved','applied','interview','offer','rejected');
create type rejection_stage  as enum ('cv_screen','assessment','interview','final_round');
create type review_status    as enum ('pending','approved','rejected');
create type kyc_status       as enum ('none','pending','passed','failed','manual_review');
create type otp_channel      as enum ('email','phone');
create type consent_kind     as enum ('terms','privacy','cookies','biometric','ai_ranking');

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- Note: date_of_birth is stored for the 18+ gate ONLY. It is never exposed to
-- the ranking pipeline (see lib/ai.ts: protected traits are stripped).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null,
  first_name        text,
  last_name         text,
  location          text,
  phone             text,
  date_of_birth     date,
  email_verified    boolean not null default false,
  phone_verified    boolean not null default false,
  is_adult          boolean not null default false,
  -- KYC: we store the RESULT only. Never document images, never face data.
  kyc_status        kyc_status not null default 'none',
  kyc_verified_at   timestamptz,
  kyc_provider_ref  text,
  kyc_over_18       boolean,
  kyc_name_match    boolean,
  flagged_for_review boolean not null default false,
  -- GDPR / EU AI Act: user may opt out of AI ranking and get a newest-first feed
  feed_sort         text not null default 'ai_rank' check (feed_sort in ('ai_rank','newest')),
  onboarding_step   text not null default 'info',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on column public.profiles.date_of_birth is
  'Used solely for the 18+ age gate. Excluded from all ranking inputs.';

-- ---------------------------------------------------------------------------
-- CV tables (the 6-step questionnaire)
-- ---------------------------------------------------------------------------
create table public.cv_education (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  level       education_level,
  school      text,
  field       text,
  start_year  int check (start_year between 1950 and 2100),
  end_year    int check (end_year between 1950 and 2100),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.cv_experience (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  job_title   text,
  company     text,
  start_month date,
  end_month   date,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.cv_skills (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  level      skill_level not null default 'basic',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.cv_languages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  language   text not null,
  level      language_level not null,
  created_at timestamptz not null default now(),
  unique (user_id, language)
);

create table public.cv_certificates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  issuer     text,
  year       int check (year between 1950 and 2100),
  created_at timestamptz not null default now()
);

create table public.cv_preferences (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  roles           text[] not null default '{}',
  cities          text[] not null default '{}',
  contract_types  contract_type[] not null default '{}',
  min_pay         int check (min_pay >= 0),
  work_modes      work_mode[] not null default '{}',
  earliest_start  date,
  updated_at      timestamptz not null default now()
);

-- Step completion tracking so a half-finished questionnaire can resume
create table public.cv_progress (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  current_step   int not null default 1 check (current_step between 1 and 7),
  completed_steps int[] not null default '{}',
  -- fields the CV reader could not find, so the UI can highlight them
  blank_fields   jsonb not null default '[]'::jsonb,
  filled_from_cv boolean not null default false,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog: companies + jobs. Shared read-only reference data.
-- ---------------------------------------------------------------------------
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_sample  boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.companies is
  'Prototype rows are invented companies flagged is_sample. Never add a real company here while sample reviews exist.';

create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  title         text not null,
  description   text not null,
  location      text not null,
  pay_min       int,
  pay_max       int,
  currency      text not null default 'EUR',
  contract_type contract_type not null,
  work_mode     work_mode not null,
  skills_wanted text[] not null default '{}',
  languages_wanted text[] not null default '{}',
  -- Legal: every listing links to its source
  source_name   text not null,
  source_url    text not null,
  posted_at     timestamptz not null default now(),
  closed        boolean not null default false,
  is_sample     boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Ranking. job_matches is the cache; ranking_logs is the EU AI Act audit trail.
-- ---------------------------------------------------------------------------
create table public.job_matches (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  score       int not null check (score between 0 and 100),
  reason      text not null,
  engine      text not null default 'offline',
  computed_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table public.ranking_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  score       int not null,
  reason      text not null,
  engine      text not null,
  model       text,
  -- what was sent to the ranker, so a human can review the decision
  input_summary jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
comment on table public.ranking_logs is
  'EU AI Act: CV-based job ranking is high-risk. Every ranking decision is logged with its inputs and reason so it can be reviewed by a human.';

-- ---------------------------------------------------------------------------
-- Seeker activity
-- ---------------------------------------------------------------------------
create table public.saved_jobs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.dismissed_jobs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  job_id           uuid references public.jobs(id) on delete set null,
  -- for jobs the user applied to elsewhere
  external_title   text,
  external_company text,
  stage            application_stage not null default 'saved',
  applied_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint app_has_target check (job_id is not null or external_title is not null)
);
create unique index applications_user_job_uniq
  on public.applications (user_id, job_id) where job_id is not null;

create table public.rejections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  rejected_on    date not null default current_date,
  stage          rejection_stage not null,
  reason         text,
  note           text,
  created_at     timestamptz not null default now(),
  unique (application_id)
);
comment on table public.rejections is
  'Private to the user. Never shown to employers and never surfaced in reviews.';

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  job_title       text not null,
  job_description text not null,
  job_location    text not null,
  contract_type   contract_type not null,
  months_worked   int not null check (months_worked between 1 and 600),
  overall         int not null check (overall between 1 and 5),
  pay_fairness    int not null check (pay_fairness between 1 and 5),
  workload        int not null check (workload between 1 and 5),
  learning        int not null check (learning between 1 and 5),
  management      int not null check (management between 1 and 5),
  would_recommend boolean not null,
  comment         text not null,
  status          review_status not null default 'pending',
  moderation_note text,
  -- removal reason, shown to the author (Digital Services Act)
  removal_reason  text,
  ai_flags        jsonb not null default '{}'::jsonb,
  proof_path      text,
  proof_checked   boolean not null default false,
  proof_delete_after date,
  -- public label only: "Verified reviewer · Internship · 2025"
  year_label      int not null,
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  published_at    timestamptz,
  -- one review per person per job
  unique (author_id, job_id)
);

create table public.review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- Comments shown under a job on the Soulmates detail screen
create table public.job_comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  status     review_status not null default 'approved',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Verification, consent, abuse control, audit
-- ---------------------------------------------------------------------------
create table public.kyc_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  route      text not null check (route in ('document','electronic_id')),
  result     text not null check (result in ('passed','failed','manual_review')),
  reason     text,
  created_at timestamptz not null default now()
);
comment on table public.kyc_attempts is
  'Attempt metadata only. No document images, no face data, no extracted ID numbers.';

create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       consent_kind not null,
  granted    boolean not null,
  created_at timestamptz not null default now()
);

create table public.otp_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  channel    otp_channel not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  consumed   boolean not null default false,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);
comment on column public.otp_codes.code_hash is
  'SHA-256 of the code. The plaintext code is never stored.';

create table public.rate_limits (
  id          bigserial primary key,
  subject     text not null,          -- user id, or hashed ip for anonymous routes
  bucket      text not null,          -- 'login' | 'review' | 'kyc' | 'ai' | ...
  window_start timestamptz not null,
  count       int not null default 0,
  unique (subject, bucket, window_start)
);

create table public.audit_log (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  event      text not null,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.audit_log is
  'Security events without personal data. Never log names, emails, codes or document contents.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index on public.cv_education   (user_id);
create index on public.cv_experience  (user_id);
create index on public.cv_skills      (user_id);
create index on public.cv_languages   (user_id);
create index on public.cv_certificates(user_id);
create index on public.saved_jobs     (user_id);
create index on public.dismissed_jobs (user_id);
create index on public.applications   (user_id, stage);
create index on public.rejections     (user_id);
create index on public.reviews        (job_id) where status = 'approved';
create index on public.reviews        (author_id);
create index on public.job_matches    (user_id, score desc);
create index on public.ranking_logs   (user_id, created_at desc);
create index on public.kyc_attempts   (user_id, created_at desc);
create index on public.otp_codes      (user_id, channel, created_at desc);
create index on public.jobs           (closed, posted_at desc);
