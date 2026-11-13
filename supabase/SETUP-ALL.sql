-- ===========================================================
-- Hingire — full database setup.
-- Paste this whole file into Supabase SQL Editor and Run.
-- It is migrations 0001-0005 concatenated, in order.
-- ===========================================================


-- ########## 0001_init.sql ##########

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

-- ########## 0002_rls.sql ##########

-- ============================================================================
-- Row Level Security — every table, no exceptions.
-- Default posture: a table with RLS on and no policy for a role denies that
-- role everything. Tables that must never be touched from the browser
-- (otp_codes, rate_limits, audit_log, moderators) therefore get NO policies
-- and are reachable only by the service role on the server.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Moderator registry. Deliberately a separate table: if "is moderator" lived
-- on profiles, a user with update rights on their own profile row could
-- promote themselves.
-- ---------------------------------------------------------------------------
create table public.moderators (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  added_at    timestamptz not null default now(),
  -- Security requirement: two-factor login for moderators and admins.
  mfa_enrolled boolean not null default false
);

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.moderators m where m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to authenticated;

-- A moderator only counts as one once they have enrolled a second factor.
create or replace function public.is_active_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.moderators m
    where m.user_id = (select auth.uid()) and m.mfa_enrolled
  );
$$;
revoke all on function public.is_active_moderator() from public;
grant execute on function public.is_active_moderator() to authenticated;

-- Has this user passed full KYC?
create or replace function public.has_passed_kyc()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.kyc_status = 'passed'
      and p.is_adult
      and not p.flagged_for_review
  );
$$;
revoke all on function public.has_passed_kyc() from public;
grant execute on function public.has_passed_kyc() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.cv_education    enable row level security;
alter table public.cv_experience   enable row level security;
alter table public.cv_skills       enable row level security;
alter table public.cv_languages    enable row level security;
alter table public.cv_certificates enable row level security;
alter table public.cv_preferences  enable row level security;
alter table public.cv_progress     enable row level security;
alter table public.companies       enable row level security;
alter table public.jobs            enable row level security;
alter table public.job_matches     enable row level security;
alter table public.ranking_logs    enable row level security;
alter table public.saved_jobs      enable row level security;
alter table public.dismissed_jobs  enable row level security;
alter table public.applications    enable row level security;
alter table public.rejections      enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_reports  enable row level security;
alter table public.job_comments    enable row level security;
alter table public.kyc_attempts    enable row level security;
alter table public.consents        enable row level security;
alter table public.otp_codes       enable row level security;
alter table public.rate_limits     enable row level security;
alter table public.audit_log       enable row level security;
alter table public.moderators      enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- Column-level grants stop a user rewriting their own verification state.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, email) on public.profiles to authenticated;
grant update (first_name, last_name, location, phone, feed_sort, onboarding_step)
  on public.profiles to authenticated;
grant delete on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_active_moderator());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- CV tables — plain "own rows only" on all four verbs
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'cv_education','cv_experience','cv_skills',
    'cv_languages','cv_certificates','cv_preferences','cv_progress'
  ] loop
    execute format($f$
      create policy %1$s_own on public.%1$s
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Catalog — readable by signed-in users, writable by nobody but the server.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.companies from anon, authenticated;
revoke insert, update, delete on public.jobs      from anon, authenticated;

create policy companies_read on public.companies
  for select to authenticated using (true);

create policy jobs_read on public.jobs
  for select to authenticated using (not closed);

-- ---------------------------------------------------------------------------
-- Ranking — the user may read their own rankings (EU AI Act: the subject can
-- see how a decision about them was made). Writes are server-side only.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.job_matches  from anon, authenticated;
revoke insert, update, delete on public.ranking_logs from anon, authenticated;

create policy job_matches_read_own on public.job_matches
  for select to authenticated using (user_id = (select auth.uid()));

create policy ranking_logs_read_own on public.ranking_logs
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Seeker activity — own rows only
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'saved_jobs','dismissed_jobs','applications','rejections','consents'
  ] loop
    execute format($f$
      create policy %1$s_own on public.%1$s
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- reviews
--   read   : approved reviews are public; authors see their own at any status;
--            active moderators see everything.
--   insert : own row only, must start life as 'pending', and the author must
--            have passed full KYC. This is enforced in the database, not just
--            in the route handler.
--   update : author may edit only while still pending; moderators may moderate.
-- ---------------------------------------------------------------------------
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant update (job_title, job_description, job_location, contract_type,
              months_worked, overall, pay_fairness, workload, learning,
              management, would_recommend, comment)
  on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

create policy reviews_read_approved on public.reviews
  for select to anon, authenticated
  using (status = 'approved');

create policy reviews_read_own on public.reviews
  for select to authenticated
  using (author_id = (select auth.uid()));

create policy reviews_read_moderator on public.reviews
  for select to authenticated
  using (public.is_active_moderator());

create policy reviews_insert_own_kyc on public.reviews
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'pending'
    and published_at is null
    and public.has_passed_kyc()
  );

create policy reviews_update_own_pending on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()) and status = 'pending')
  with check (author_id = (select auth.uid()) and status = 'pending');

create policy reviews_delete_own on public.reviews
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- review_reports — anyone signed in may report (DSA); reporters see their own.
-- ---------------------------------------------------------------------------
revoke update, delete on public.review_reports from anon, authenticated;

create policy review_reports_insert on public.review_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy review_reports_read_own on public.review_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_active_moderator());

-- ---------------------------------------------------------------------------
-- job_comments
-- ---------------------------------------------------------------------------
create policy job_comments_read on public.job_comments
  for select to authenticated
  using (status = 'approved' or user_id = (select auth.uid()));

create policy job_comments_insert_own on public.job_comments
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy job_comments_modify_own on public.job_comments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy job_comments_delete_own on public.job_comments
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- kyc_attempts — the user can see their own attempt history (needed for the
-- "3 tries a day" counter in the UI). Only the server writes results.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.kyc_attempts from anon, authenticated;

create policy kyc_attempts_read_own on public.kyc_attempts
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Server-only tables. No policies on purpose: RLS with zero policies denies
-- anon and authenticated everything. Grants revoked as belt and braces.
-- ---------------------------------------------------------------------------
revoke all on public.otp_codes   from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke all on public.audit_log   from anon, authenticated;
revoke all on public.moderators  from anon, authenticated;
revoke all on sequence public.rate_limits_id_seq from anon, authenticated;
revoke all on sequence public.audit_log_id_seq   from anon, authenticated;

-- ---------------------------------------------------------------------------
-- New-user trigger: create the profile row the moment an auth user appears.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, email_verified)
  values (
    new.id,
    new.email,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  insert into public.cv_progress (user_id) values (new.id) on conflict do nothing;
  insert into public.cv_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_profiles_touch     before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger t_applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();
create trigger t_cv_prefs_touch     before update on public.cv_preferences
  for each row execute function public.touch_updated_at();
create trigger t_cv_progress_touch  before update on public.cv_progress
  for each row execute function public.touch_updated_at();

-- ########## 0003_storage.sql ##########

-- ============================================================================
-- Storage: two PRIVATE buckets. Files are only ever served through
-- short-lived signed URLs minted on the server after an ownership check.
--
-- Note there is deliberately NO bucket for ID documents or face scans.
-- The PRD forbids storing them: the prototype ID check holds the image in
-- memory for the length of one request and never writes it anywhere.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs',    'cvs',    false, 5242880, array[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'image/jpeg','image/png'
   ]),
  ('proofs', 'proofs', false, 5242880, array[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'image/jpeg','image/png'
   ])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored as "<user-id>/<random-name>.<ext>" — files are renamed on
-- save, so the original filename never reaches storage.
create policy cvs_own_rw on storage.objects
  for all to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Proof of work: the owner may write it; only the owner and an active
-- moderator may read it. Never exposed to other users or in reviews.
create policy proofs_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy proofs_read_own_or_moderator on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_active_moderator()
    )
  );

create policy proofs_delete_own_or_moderator on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_active_moderator()
    )
  );

-- ---------------------------------------------------------------------------
-- Retention: proof files are deleted within 30 days of the moderation
-- decision, and immediately when the account is deleted. This function is
-- called by the server (and can be attached to pg_cron on a paid plan).
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_proofs()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int := 0;
begin
  with due as (
    select id, proof_path from public.reviews
    where proof_path is not null
      and proof_delete_after is not null
      and proof_delete_after <= current_date
  )
  update public.reviews r
     set proof_path = null,
         proof_delete_after = null
    from due
   where r.id = due.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_expired_proofs() from public, anon, authenticated;

-- ########## 0004_functions.sql ##########

-- ============================================================================
-- Server-side functions.
-- All are SECURITY DEFINER with a pinned search_path, and execute is granted
-- only to service_role unless a signed-in user genuinely needs to call them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Rate limiting: atomic increment of a fixed window, returns the new count.
-- ---------------------------------------------------------------------------
create or replace function public.bump_rate_limit(
  p_subject text,
  p_bucket text,
  p_window_start timestamptz,
  p_max int
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare new_count int;
begin
  insert into public.rate_limits (subject, bucket, window_start, count)
  values (p_subject, p_bucket, p_window_start, 1)
  on conflict (subject, bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into new_count;

  -- opportunistic cleanup of old windows
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return new_count;
end $$;
revoke all on function public.bump_rate_limit(text,text,timestamptz,int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public review aggregate per job. Counts APPROVED reviews only, so a pending
-- or rejected review can never move a public average.
-- ---------------------------------------------------------------------------
create or replace view public.job_review_stats
with (security_invoker = true) as
  select
    j.id as job_id,
    coalesce(round(avg(r.overall)::numeric, 1), 0)::numeric(3,1) as avg_rating,
    count(r.id)::int as review_count
  from public.jobs j
  left join public.reviews r
    on r.job_id = j.id and r.status = 'approved'
  group by j.id;

grant select on public.job_review_stats to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rejection summary input: aggregate counts, computed in the database so the
-- raw private entries never have to leave it in bulk.
-- ---------------------------------------------------------------------------
create or replace function public.rejection_stats(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  -- Caller may only ask about themselves.
  if p_user is distinct from (select auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', (select count(*) from public.rejections where user_id = p_user),
    'by_stage', coalesce((
      select jsonb_object_agg(stage, n)
      from (
        select stage::text as stage, count(*)::int as n
        from public.rejections where user_id = p_user group by stage
      ) s
    ), '{}'::jsonb),
    'role_types', coalesce((
      select jsonb_agg(jsonb_build_object('title', title, 'n', n))
      from (
        select coalesce(j.title, a.external_title, 'Unknown') as title, count(*)::int as n
        from public.rejections rj
        join public.applications a on a.id = rj.application_id
        left join public.jobs j on j.id = a.job_id
        where rj.user_id = p_user
        group by 1 order by 2 desc limit 5
      ) t
    ), '[]'::jsonb),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'n', n))
      from (
        select unnest(j.skills_wanted) as name, count(*)::int as n
        from public.rejections rj
        join public.applications a on a.id = rj.application_id
        join public.jobs j on j.id = a.job_id
        where rj.user_id = p_user
        group by 1 order by 2 desc limit 6
      ) sk
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;
revoke all on function public.rejection_stats(uuid) from public, anon;
grant execute on function public.rejection_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- GDPR: self-service data export. Returns everything held about the caller.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); result jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile',      (select to_jsonb(p) from public.profiles p where p.id = uid),
    'education',    coalesce((select jsonb_agg(to_jsonb(t)) from public.cv_education t where t.user_id = uid), '[]'::jsonb),
    'experience',   coalesce((select jsonb_agg(to_jsonb(t)) from public.cv_experience t where t.user_id = uid), '[]'::jsonb),
    'skills',       coalesce((select jsonb_agg(to_jsonb(t)) from public.cv_skills t where t.user_id = uid), '[]'::jsonb),
    'languages',    coalesce((select jsonb_agg(to_jsonb(t)) from public.cv_languages t where t.user_id = uid), '[]'::jsonb),
    'certificates', coalesce((select jsonb_agg(to_jsonb(t)) from public.cv_certificates t where t.user_id = uid), '[]'::jsonb),
    'preferences',  (select to_jsonb(t) from public.cv_preferences t where t.user_id = uid),
    'saved_jobs',   coalesce((select jsonb_agg(to_jsonb(t)) from public.saved_jobs t where t.user_id = uid), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(to_jsonb(t)) from public.applications t where t.user_id = uid), '[]'::jsonb),
    'rejections',   coalesce((select jsonb_agg(to_jsonb(t)) from public.rejections t where t.user_id = uid), '[]'::jsonb),
    'reviews',      coalesce((select jsonb_agg(to_jsonb(t)) from public.reviews t where t.author_id = uid), '[]'::jsonb),
    'comments',     coalesce((select jsonb_agg(to_jsonb(t)) from public.job_comments t where t.user_id = uid), '[]'::jsonb),
    'consents',     coalesce((select jsonb_agg(to_jsonb(t)) from public.consents t where t.user_id = uid), '[]'::jsonb),
    'kyc_attempts', coalesce((select jsonb_agg(to_jsonb(t)) from public.kyc_attempts t where t.user_id = uid), '[]'::jsonb),
    -- EU AI Act: the subject can see how each ranking decision about them was made
    'ranking_decisions', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select job_id, score, reason, engine, model, input_summary, created_at
        from public.ranking_logs where user_id = uid
        order by created_at desc limit 500
      ) t), '[]'::jsonb)
  ) into result;

  return result;
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- GDPR: self-service account deletion. Cascades clear every child row; the
-- caller's auth user is removed by the server with the service role straight
-- after, which is also what drops any remaining storage objects.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- profiles cascades to every table that references it
  delete from public.profiles where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ########## 0005_seed.sql ##########

-- ============================================================================
-- Sample data.
--
-- Every company and job below is INVENTED. Never add a real company here:
-- the PRD forbids putting invented reviews on real companies, and these
-- reviews are invented. Everything is flagged is_sample = true.
-- ============================================================================

-- Sample reviews have no real author, so author_id becomes nullable but is
-- still required for anything a user writes.
alter table public.reviews alter column author_id drop not null;
alter table public.reviews
  add constraint reviews_author_or_sample
  check (author_id is not null or is_sample);

-- Sample reviews are inserted by the service role, which bypasses RLS, so the
-- "must have passed KYC" insert policy is untouched by this.

insert into public.companies (name, is_sample) values
  ('Lumen & Pike',        true),
  ('Verdabyte',           true),
  ('Olivetree Logistics', true),
  ('Northwind Studio',    true),
  ('Papersun Media',      true),
  ('Kestrel Analytics',   true),
  ('Bluefig Hospitality', true),
  ('Arcadia Health Tech', true),
  ('Tinderbox Games',     true),
  ('Marigold Retail Co',  true)
on conflict (name) do nothing;

with c as (select id, name from public.companies)
insert into public.jobs (
  company_id, title, description, location, pay_min, pay_max, currency,
  contract_type, work_mode, skills_wanted, languages_wanted,
  source_name, source_url, posted_at, is_sample
)
select c.id, j.title, j.description, j.location, j.pay_min, j.pay_max, 'EUR',
       j.contract_type::contract_type, j.work_mode::work_mode,
       j.skills, j.langs, 'Sample data', j.url,
       now() - (j.age_days || ' days')::interval, true
from (values
  ('Lumen & Pike', 'Marketing Intern',
   'Support the marketing team with social posts, a weekly newsletter and simple campaign reports. You will own the content calendar with help from your mentor. No prior agency experience needed.',
   'Madrid', 900, 1100, 'internship', 'hybrid',
   array['social media','canva','excel','copywriting','communication'],
   array['spanish','english'], 'https://example.invalid/jobs/lumen-pike-marketing-intern', 2),

  ('Verdabyte', 'Junior Data Analyst',
   'Clean and analyse product usage data, build dashboards and answer questions from the product team. SQL is used daily; Python is a bonus. Structured onboarding over the first month.',
   'Barcelona', 1600, 2000, 'full_time', 'hybrid',
   array['sql','excel','python','data analysis','tableau'],
   array['english'], 'https://example.invalid/jobs/verdabyte-junior-data-analyst', 5),

  ('Olivetree Logistics', 'Operations Assistant',
   'Keep shipments moving: track deliveries, update the system, and sort out problems with carriers over phone and email. Busy, practical, and you learn the whole chain quickly.',
   'Valencia', 1300, 1500, 'full_time', 'on_site',
   array['excel','customer service','time management','data entry','problem solving'],
   array['spanish','english'], 'https://example.invalid/jobs/olivetree-operations-assistant', 1),

  ('Northwind Studio', 'Junior UI Designer',
   'Work on screens for client apps under an art director. Figma all day, with a weekly critique. Portfolio matters more than years of experience.',
   'Remote', 1400, 1800, 'full_time', 'remote',
   array['figma','photoshop','illustrator','communication','teamwork'],
   array['english'], 'https://example.invalid/jobs/northwind-junior-ui-designer', 8),

  ('Papersun Media', 'Content Writing Intern',
   'Write short articles and social copy for lifestyle brands. You get a style guide, an editor and real bylines. Two days a week in the office.',
   'Seville', 700, 900, 'internship', 'hybrid',
   array['copywriting','seo','research','social media','content'],
   array['spanish','english'], 'https://example.invalid/jobs/papersun-content-intern', 3),

  ('Kestrel Analytics', 'Research Assistant (Part-time)',
   'Help a small research team gather and tidy data for client reports. Flexible hours around study, 20 hours a week. Heavy on spreadsheets and careful note-taking.',
   'Madrid', 800, 1000, 'part_time', 'hybrid',
   array['excel','research','data entry','spss','time management'],
   array['english','spanish'], 'https://example.invalid/jobs/kestrel-research-assistant', 11),

  ('Bluefig Hospitality', 'Front of House Team Member',
   'Greet guests, take orders and keep the floor running during service. Training provided, including barista basics. Shifts include evenings and weekends.',
   'Malaga', 1100, 1300, 'part_time', 'on_site',
   array['customer service','teamwork','communication','cash handling','barista'],
   array['spanish','english'], 'https://example.invalid/jobs/bluefig-front-of-house', 4),

  ('Arcadia Health Tech', 'Junior Software Engineer',
   'Build features in a TypeScript and React codebase for a clinic scheduling product. Pair programming twice a week, code review on everything. Graduates welcome.',
   'Barcelona', 1900, 2400, 'full_time', 'hybrid',
   array['typescript','react','git','sql','problem solving'],
   array['english'], 'https://example.invalid/jobs/arcadia-junior-software-engineer', 6),

  ('Tinderbox Games', 'QA Tester Intern',
   'Play builds, find bugs, write them up clearly and re-test fixes. You will sit with the dev team and see how a game gets finished. Six-month internship.',
   'Remote', 600, 800, 'internship', 'remote',
   array['communication','research','problem solving','teamwork','data entry'],
   array['english'], 'https://example.invalid/jobs/tinderbox-qa-intern', 9),

  ('Marigold Retail Co', 'Sales Assistant',
   'Help customers find what they need, keep the shop floor tidy and handle the till. Good first job: structured training and a supportive store manager.',
   'Zaragoza', 1200, 1400, 'full_time', 'on_site',
   array['sales','customer service','cash handling','stock control','teamwork'],
   array['spanish'], 'https://example.invalid/jobs/marigold-sales-assistant', 7)
) as j(company, title, description, location, pay_min, pay_max,
       contract_type, work_mode, skills, langs, url, age_days)
on c.name = j.company
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sample reviews. Invented, on invented companies, flagged is_sample and
-- approved so they are visible. No reviewer name is stored or shown.
-- ---------------------------------------------------------------------------
with j as (
  select jobs.id as job_id, jobs.company_id, jobs.title, jobs.location,
         jobs.contract_type, companies.name as company
  from public.jobs
  join public.companies on companies.id = jobs.company_id
)
insert into public.reviews (
  author_id, job_id, company_id, job_title, job_description, job_location,
  contract_type, months_worked, overall, pay_fairness, workload, learning,
  management, would_recommend, comment, status, year_label, is_sample,
  published_at, proof_checked
)
select null, j.job_id, j.company_id, j.title, r.desc, j.location,
       j.contract_type, r.months, r.overall, r.pay, r.workload, r.learning,
       r.mgmt, r.rec, r.comment, 'approved'::review_status, r.yr, true,
       now() - (r.age || ' days')::interval, true
from j join (values
  ('Marketing Intern', 'Ran the content calendar and the weekly newsletter.', 6, 4, 3, 4, 5, 4, true,
   'Genuinely learned a lot. I was given real work in week two rather than filing things. Pay is low for the hours, which is the main downside, but the mentoring was excellent and I left with a portfolio.', 2025, 40),
  ('Marketing Intern', 'Social media and campaign reporting.', 4, 3, 2, 3, 4, 3, true,
   'Good people and a relaxed office. The internship pay barely covered transport and lunch. Work itself was varied and nobody treated me like free labour.', 2024, 120),
  ('Junior Data Analyst', 'Dashboards and ad-hoc analysis for the product team.', 14, 5, 5, 4, 5, 5, true,
   'Best first job I could have asked for. Proper code review on SQL, a real onboarding plan, and my manager protected my time when other teams piled on requests. Pay was fair for a junior role in the city.', 2025, 25),
  ('Junior Data Analyst', 'Reporting and data cleaning.', 9, 4, 4, 3, 4, 4, true,
   'Steady, well-organised team. Some weeks are repetitive data cleaning, which nobody pretends otherwise about. Flexible hybrid policy that was actually respected.', 2024, 200),
  ('Operations Assistant', 'Shipment tracking and carrier issues.', 11, 3, 3, 2, 3, 3, false,
   'Busy is an understatement. You learn the whole supply chain fast, but the phone does not stop and cover during holidays was thin. Fine if you want pace, hard if you want calm.', 2025, 55),
  ('Operations Assistant', 'Day-to-day operations support.', 18, 4, 3, 2, 4, 4, true,
   'Hard work and you earn your money, but the team genuinely helps each other. Got promoted after a year, which I did not expect.', 2024, 160),
  ('Junior UI Designer', 'Client app screens in Figma.', 8, 4, 4, 4, 5, 3, true,
   'Weekly critiques made me a much better designer in under a year. Fully remote and it worked. Direction from above could swing late in a project, which meant some rework.', 2025, 33),
  ('Content Writing Intern', 'Articles and social copy for lifestyle clients.', 5, 2, 1, 3, 3, 2, false,
   'The bylines were real and that helped my portfolio. But the pay is very low even for an internship, and feedback was inconsistent depending on who edited you that week.', 2025, 70),
  ('Content Writing Intern', 'Short-form content and SEO.', 6, 4, 2, 3, 5, 4, true,
   'Learned more about SEO here in six months than in two years of coursework. Low pay is the trade-off and they are upfront about it.', 2024, 240),
  ('Research Assistant (Part-time)', 'Data gathering for client reports.', 10, 5, 4, 5, 4, 5, true,
   'Genuinely flexible around exams, which is rare. Work is detailed and quiet. If you like spreadsheets and being left alone to concentrate, it is ideal.', 2025, 48),
  ('Front of House Team Member', 'Service, orders and floor.', 7, 3, 3, 2, 3, 2, false,
   'Shifts get changed at short notice, which made planning anything difficult. The team itself was great and training on coffee was proper. Tips help.', 2025, 60),
  ('Front of House Team Member', 'Front of house during service.', 13, 4, 4, 3, 3, 4, true,
   'Fast-paced but fair. Breaks were respected, which I hear is not normal in hospitality. Good first job for confidence.', 2024, 180),
  ('Junior Software Engineer', 'Features in a TypeScript and React codebase.', 16, 5, 5, 4, 5, 5, true,
   'Code review on everything and nobody made me feel stupid for asking. Pairing twice a week accelerated things enormously. Pay was at the top of the junior band locally.', 2025, 20),
  ('Junior Software Engineer', 'Frontend work on the scheduling product.', 12, 4, 4, 3, 5, 4, true,
   'Solid engineering culture and real tests. Some legacy corners of the codebase are rough and documentation lags behind. Still a great place to start.', 2024, 150),
  ('QA Tester Intern', 'Testing builds and writing up bugs.', 6, 3, 2, 3, 4, 3, true,
   'Seeing a game ship is a brilliant experience. Crunch near milestones was real, and as an intern you feel it too. Pay is at the bottom of the scale.', 2025, 44),
  ('Sales Assistant', 'Shop floor, customers and till.', 15, 4, 4, 3, 3, 5, true,
   'The store manager made the job. Clear training, fair rota, and problems got dealt with rather than ignored. Standing all day is the hardest part.', 2025, 36),
  ('Sales Assistant', 'Customer service and stock.', 8, 2, 2, 2, 2, 2, false,
   'Understaffed most shifts, so you are covering two sections at once. Nothing malicious, just stretched thin. Would not go back.', 2024, 210)
) as r(job_title, desc, months, overall, pay, workload, learning, mgmt, rec, comment, yr, age)
on r.job_title = j.title
on conflict do nothing;
