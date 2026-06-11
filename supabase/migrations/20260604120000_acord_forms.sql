create table if not exists public.acord_forms (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.agency_accounts(id) on delete cascade,
  client_id text not null,
  form_type text not null,
  form_title text not null,
  answers_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'generated', 'completed')),
  generated_file_name text,
  generated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acord_forms_account_client_idx
  on public.acord_forms(account_id, client_id);

create index if not exists acord_forms_status_idx
  on public.acord_forms(account_id, status);

alter table public.acord_forms enable row level security;

create policy "Users can read ACORD forms for their accounts"
  on public.acord_forms
  for select
  using (
    exists (
      select 1
      from public.account_users au
      where au.account_id = acord_forms.account_id
        and au.user_id = auth.uid()
        and au.status = 'active'
    )
  );

create policy "Users can insert ACORD forms for their accounts"
  on public.acord_forms
  for insert
  with check (
    exists (
      select 1
      from public.account_users au
      where au.account_id = acord_forms.account_id
        and au.user_id = auth.uid()
        and au.status = 'active'
    )
  );

create policy "Users can update ACORD forms for their accounts"
  on public.acord_forms
  for update
  using (
    exists (
      select 1
      from public.account_users au
      where au.account_id = acord_forms.account_id
        and au.user_id = auth.uid()
        and au.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.account_users au
      where au.account_id = acord_forms.account_id
        and au.user_id = auth.uid()
        and au.status = 'active'
    )
  );
