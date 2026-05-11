-- EXF Evaluator — Initial Schema
-- Run: supabase db push

-- Enable required extensions
create extension if not exists "pg_trgm"; -- for text search

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('super_admin', 'program_admin', 'staff', 'viewer');
create type form_status as enum ('draft', 'active', 'closed');
create type submission_status as enum ('draft', 'submitted', 'reviewed');
create type summary_type as enum ('submission', 'trend', 'impact', 'report_section');
create type report_status as enum ('draft', 'final');
create type import_status as enum ('pending', 'processing', 'review', 'complete', 'failed');

-- ============================================================
-- PROGRAMS
-- ============================================================

create table programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  logo_url     text,
  brand_color  text default '#ea580c', -- orange default
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

-- ============================================================
-- PROGRAM MEMBERSHIPS
-- ============================================================

create table program_memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references programs(id) on delete cascade,
  role        user_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  unique (user_id, program_id)
);

create index idx_memberships_user on program_memberships(user_id);
create index idx_memberships_program on program_memberships(program_id);

-- ============================================================
-- FORM TEMPLATES
-- ============================================================

create table form_templates (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid references programs(id) on delete cascade, -- null = global (super_admin)
  name         text not null,
  description  text,
  schema       jsonb not null default '{"pages":[{"id":"page-1","title":"Page 1","fields":[]}]}',
  created_by   uuid references auth.users(id) on delete set null,
  is_archived  boolean not null default false,
  is_global    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_templates_program on form_templates(program_id);

-- ============================================================
-- FORMS
-- ============================================================

create table forms (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references programs(id) on delete cascade,
  template_id  uuid references form_templates(id) on delete set null,
  name         text not null,
  description  text,
  slug         text not null unique,
  schema       jsonb not null default '{"pages":[{"id":"page-1","title":"Page 1","fields":[]}]}',
  settings     jsonb not null default '{}',
  -- settings shape: { maxSubmissions, onePerEmail, opensAt, closesAt, tokenExpiryDays,
  --                   redirectUrl, notificationEmails, allowRespondentView, customCss }
  status       form_status not null default 'draft',
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_forms_program on forms(program_id);
create index idx_forms_slug on forms(slug);

-- ============================================================
-- SUBMISSION TOKENS
-- ============================================================

create table submission_tokens (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references forms(id) on delete cascade,
  email       text not null,
  token       uuid not null unique default gen_random_uuid(),
  expires_at  timestamptz not null default (now() + interval '30 days'),
  used_at     timestamptz,
  sent_at     timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  metadata    jsonb not null default '{}', -- pre-fill data from CSV
  created_at  timestamptz not null default now()
);

create index idx_tokens_form on submission_tokens(form_id);
create index idx_tokens_token on submission_tokens(token);
create index idx_tokens_email on submission_tokens(email);

-- ============================================================
-- SUBMISSIONS
-- ============================================================

create table submissions (
  id               uuid primary key default gen_random_uuid(),
  form_id          uuid not null references forms(id) on delete cascade,
  token_id         uuid references submission_tokens(id) on delete set null,
  submitted_by     uuid references auth.users(id) on delete set null,
  respondent_email text,
  data             jsonb not null default '{}',
  status           submission_status not null default 'draft',
  submitted_at     timestamptz,
  ip_address       inet,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_submissions_form on submissions(form_id);
create index idx_submissions_token on submissions(token_id);
create index idx_submissions_user on submissions(submitted_by);
create index idx_submissions_status on submissions(status);

-- ============================================================
-- AI SUMMARIES
-- ============================================================

create table ai_summaries (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references programs(id) on delete cascade,
  form_id       uuid references forms(id) on delete cascade,
  date_from     date not null,
  date_to       date not null,
  summary_type  summary_type not null,
  content       text not null,
  model_version text not null default 'claude-sonnet-4-20250514',
  created_at    timestamptz not null default now()
);

create index idx_summaries_program on ai_summaries(program_id);
create index idx_summaries_form on ai_summaries(form_id);

-- ============================================================
-- REPORTS
-- ============================================================

create table reports (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references programs(id) on delete cascade,
  name        text not null,
  date_from   date not null,
  date_to     date not null,
  status      report_status not null default 'draft',
  content     jsonb not null default '{"sections":[]}',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  exported_at timestamptz
);

create index idx_reports_program on reports(program_id);

-- ============================================================
-- IMPORT JOBS
-- ============================================================

create table import_jobs (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references programs(id) on delete cascade,
  file_url         text not null,
  file_name        text not null,
  status           import_status not null default 'pending',
  detected_schema  jsonb,
  column_mappings  jsonb,
  preview_data     jsonb,
  error_log        text,
  row_count        integer,
  imported_count   integer,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_imports_program on import_jobs(program_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  program_id  uuid references programs(id) on delete cascade,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  diff        jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index idx_audit_program on audit_log(program_id);
create index idx_audit_user on audit_log(user_id);
create index idx_audit_entity on audit_log(entity_type, entity_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_forms_updated_at
  before update on forms
  for each row execute function set_updated_at();

create trigger trg_form_templates_updated_at
  before update on form_templates
  for each row execute function set_updated_at();

create trigger trg_submissions_updated_at
  before update on submissions
  for each row execute function set_updated_at();

create trigger trg_reports_updated_at
  before update on reports
  for each row execute function set_updated_at();

create trigger trg_import_jobs_updated_at
  before update on import_jobs
  for each row execute function set_updated_at();
