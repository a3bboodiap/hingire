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
