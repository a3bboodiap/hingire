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
