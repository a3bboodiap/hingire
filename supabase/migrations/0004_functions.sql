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
