create table if not exists public.client_cloud_folders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  client_id uuid not null,
  provider text not null check (provider in ('google_drive', 'microsoft_onedrive', 'dropbox', 'box', 'other')),
  folder_name text not null,
  folder_url text not null check (folder_url ~ '^https://'),
  folder_id text,
  notes text,
  connected_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists client_cloud_folders_account_client_idx
  on public.client_cloud_folders (account_id, client_id)
  where active = true;

alter table public.client_cloud_folders enable row level security;

create policy "client cloud folders are account scoped"
  on public.client_cloud_folders
  for all
  using (account_id::text = auth.jwt() ->> 'account_id')
  with check (account_id::text = auth.jwt() ->> 'account_id');
