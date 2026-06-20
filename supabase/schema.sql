create extension if not exists pgcrypto;

create table if not exists public.applications (
  id text not null,
  source text not null check (source in ('web', 'onboarding')),
  status text not null default 'new',
  course_id text,
  student_email text,
  student_name text,
  phone text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, source)
);

create index if not exists applications_source_updated_idx
  on public.applications (source, updated_at desc);

create index if not exists applications_student_email_idx
  on public.applications (student_email);

create table if not exists public.cookie_consents (
  id uuid primary key default gen_random_uuid(),
  consent_id text not null,
  decision jsonb not null default '{}'::jsonb,
  page text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists cookie_consents_consent_idx
  on public.cookie_consents (consent_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
before update on public.applications
for each row
execute function public.set_updated_at();

alter table public.applications enable row level security;
alter table public.cookie_consents enable row level security;

drop policy if exists "Public prototype can read applications" on public.applications;
drop policy if exists "Public prototype can insert applications" on public.applications;
drop policy if exists "Public prototype can update applications" on public.applications;

drop policy if exists "Public can store cookie consent" on public.cookie_consents;
-- Produkčná fáza 2:
-- 1. Dokumenty presunúť z JSON/dataUrl do Supabase Storage bucketu.
-- 2. Pridať samostatné tabuľky profiles, documents, messages a audit_log.
-- 3. Admin endpointy chrániť plnohodnotným admin session mechanizmom.
