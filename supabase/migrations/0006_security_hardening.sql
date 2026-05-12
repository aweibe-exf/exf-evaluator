-- ============================================================
-- Security hardening: tighten submissions RLS + audit_log
-- ============================================================

-- 1. Drop the over-permissive submissions SELECT policy that included 'viewer'
--    role. Viewers should not have access to raw submission data (PII, responses).
--    Only super_admin, program_admin, and staff need to read individual submissions.

drop policy if exists "submissions: program members (staff+) can view" on submissions;

create policy "submissions: staff+ can view"
  on submissions for select
  using (
    is_super_admin()
    or submitted_by = auth.uid()
    or exists (
      select 1 from forms f
      join program_memberships pm on pm.program_id = f.program_id
      where f.id = submissions.form_id
        and pm.user_id = auth.uid()
        and pm.role in ('super_admin', 'program_admin', 'staff')
    )
  );

-- 2. Explicitly deny INSERT on audit_log from authenticated users.
--    Audit entries must only be written via the service role (API routes).
--    This is belt-and-suspenders — RLS with no insert policy already blocks it,
--    but an explicit deny makes the intent unambiguous.

drop policy if exists "audit_log: deny direct insert" on audit_log;

create policy "audit_log: deny direct insert"
  on audit_log for insert
  with check (false);
