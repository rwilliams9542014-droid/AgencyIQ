/*
  # AgencyIQ CRM Data Foundation

  This migration creates the production database layer for real agency data while
  leaving the current browser/localStorage demo flow untouched.

  Highlights:
  - Tenant tables: agency_accounts and account_users
  - CRM tables: clients, policies, renewals, tasks, notes, documents
  - Import/export/backup tables for onboarding and data portability
  - Audit log for sensitive operations
  - RLS policies scoped through account membership
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.agency_accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  slug               text UNIQUE,
  plan               text NOT NULL DEFAULT 'demo'
                       CHECK (plan IN ('demo','starter','pro','enterprise')),
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','trialing','past_due','suspended','closed')),
  owner_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_region        text NOT NULL DEFAULT 'us',
  backup_policy_days integer NOT NULL DEFAULT 30,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'producer'
                  CHECK (role IN ('owner','admin','producer','csr','readonly')),
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','invited','disabled')),
  invited_email text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_account_member(target_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_users au
    WHERE au.account_id = target_account_id
      AND au.user_id = auth.uid()
      AND au.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin(target_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_users au
    WHERE au.account_id = target_account_id
      AND au.user_id = auth.uid()
      AND au.status = 'active'
      AND au.role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.storage_account_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  first_folder text;
BEGIN
  first_folder := (storage.foldername(object_name))[1];
  RETURN first_folder::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.crm_clients (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  external_source          text,
  external_id              text,
  client_type              text CHECK (client_type IN ('personal','business')),
  display_name             text NOT NULL,
  primary_contact          text,
  first_name               text,
  middle_name              text,
  last_name                text,
  suffix                   text,
  dba_name                 text,
  business_type            text,
  tax_id_ref               text,
  ssn_last4                text,
  driver_license_number    text,
  driver_license_state     text,
  date_of_birth            date,
  email                    text,
  phone                    text,
  alternate_phone          text,
  preferred_contact_method text,
  mailing_address          text,
  physical_address         text,
  city                     text,
  state                    text,
  zip                      text,
  county                   text,
  website                  text,
  line_of_business         text,
  account_status           text NOT NULL DEFAULT 'active'
                             CHECK (account_status IN ('active','inactive','prospect')),
  health                   text NOT NULL DEFAULT 'strong'
                             CHECK (health IN ('strong','needs_review','at_risk')),
  annual_revenue           numeric(14,2),
  assigned_producer_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_csr_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_method           text,
  payment_plan             text,
  notes                    text,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_source, external_id)
);

CREATE TABLE IF NOT EXISTS public.crm_policies (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  client_id               uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  external_source         text,
  external_id             text,
  carrier                 text NOT NULL DEFAULT '',
  policy_type             text NOT NULL DEFAULT '',
  line_of_business        text,
  policy_number           text,
  effective_date          date,
  expiration_date         date NOT NULL,
  premium                 numeric(14,2) NOT NULL DEFAULT 0,
  renewal_premium         numeric(14,2),
  commission_rate         numeric(6,3),
  billing_type            text,
  payment_plan            text,
  payment_status          text,
  renewal_status          text,
  limits                  text,
  mortgagee_or_lienholder text,
  down_payment            numeric(14,2),
  monthly_payment         numeric(14,2),
  finance_company         text,
  status                  text NOT NULL DEFAULT 'active',
  producer_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  csr_user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  billing                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                   text,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_source, external_id)
);

CREATE TABLE IF NOT EXISTS public.crm_renewals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  policy_id   uuid NOT NULL REFERENCES public.crm_policies(id) ON DELETE CASCADE,
  due_date    date NOT NULL,
  status      text NOT NULL DEFAULT 'review_docs',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  client_id           uuid REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  related_policy_id   uuid REFERENCES public.crm_policies(id) ON DELETE SET NULL,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title               text NOT NULL,
  description         text,
  due_date            date,
  due_label           text,
  reminder_date       timestamptz,
  priority            text NOT NULL DEFAULT 'normal',
  status              text NOT NULL DEFAULT 'open',
  completed           boolean NOT NULL DEFAULT false,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_notes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  client_id          uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  related_policy_id  uuid REFERENCES public.crm_policies(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type               text,
  pinned             boolean NOT NULL DEFAULT false,
  body               text NOT NULL,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  client_id          uuid REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  related_policy_id  uuid REFERENCES public.crm_policies(id) ON DELETE SET NULL,
  uploaded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_bucket     text NOT NULL DEFAULT 'agencyiq-documents',
  storage_path       text NOT NULL,
  file_name          text NOT NULL,
  content_type       text,
  file_size          bigint,
  document_type      text,
  checksum_sha256    text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

CREATE TABLE IF NOT EXISTS public.crm_import_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  created_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_system       text NOT NULL DEFAULT 'csv',
  original_file_name  text NOT NULL DEFAULT '',
  storage_path        text,
  status              text NOT NULL DEFAULT 'uploaded'
                        CHECK (status IN ('uploaded','mapped','validated','importing','completed','failed','cancelled')),
  mapping             jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary             jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_import_rows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  batch_id         uuid NOT NULL REFERENCES public.crm_import_batches(id) ON DELETE CASCADE,
  row_number       integer NOT NULL,
  raw_data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  import_status    text NOT NULL DEFAULT 'pending'
                   CHECK (import_status IN ('pending','valid','invalid','imported','skipped','failed')),
  target_client_id uuid REFERENCES public.crm_clients(id) ON DELETE SET NULL,
  target_policy_id uuid REFERENCES public.crm_policies(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_export_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  export_type         text NOT NULL DEFAULT 'full'
                        CHECK (export_type IN ('full','clients','policies','notes','documents','audit')),
  format              text NOT NULL DEFAULT 'json'
                        CHECK (format IN ('json','csv','zip')),
  status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','running','completed','failed','expired')),
  storage_path        text,
  row_counts          jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at          timestamptz,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE TABLE IF NOT EXISTS public.crm_backup_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  backup_scope    text NOT NULL DEFAULT 'all_accounts'
                    CHECK (backup_scope IN ('all_accounts','single_account','schema_only','storage_only')),
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','completed','failed')),
  provider        text NOT NULL DEFAULT 'manual',
  storage_path    text,
  checksum_sha256 text,
  size_bytes      bigint,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  error_message   text
);

CREATE TABLE IF NOT EXISTS public.crm_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  actor_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid,
  ip_address      inet,
  user_agent      text,
  before_data     jsonb,
  after_data      jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agency_accounts','account_users','crm_clients','crm_policies','crm_renewals',
    'crm_tasks','crm_notes','crm_documents','crm_import_batches','crm_import_rows',
    'crm_export_jobs','crm_backup_runs','crm_audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY "Users can view accounts they belong to"
  ON public.agency_accounts FOR SELECT
  TO authenticated
  USING (public.is_account_member(id));

CREATE POLICY "Owners can update their agency account"
  ON public.agency_accounts FOR UPDATE
  TO authenticated
  USING (public.is_account_admin(id))
  WITH CHECK (public.is_account_admin(id));

CREATE POLICY "Users can view account memberships in their accounts"
  ON public.account_users FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id));

CREATE POLICY "Admins can manage account memberships"
  ON public.account_users FOR ALL
  TO authenticated
  USING (public.is_account_admin(account_id))
  WITH CHECK (public.is_account_admin(account_id));

CREATE POLICY "Members can read clients"
  ON public.crm_clients FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can insert clients"
  ON public.crm_clients FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "Members can update clients"
  ON public.crm_clients FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "Admins can delete clients"
  ON public.crm_clients FOR DELETE TO authenticated
  USING (public.is_account_admin(account_id));

CREATE POLICY "Members can read policies"
  ON public.crm_policies FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can insert policies"
  ON public.crm_policies FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "Members can update policies"
  ON public.crm_policies FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "Admins can delete policies"
  ON public.crm_policies FOR DELETE TO authenticated
  USING (public.is_account_admin(account_id));

CREATE POLICY "Members can read renewals"
  ON public.crm_renewals FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can write renewals"
  ON public.crm_renewals FOR ALL TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can read tasks"
  ON public.crm_tasks FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can write tasks"
  ON public.crm_tasks FOR ALL TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can read notes"
  ON public.crm_notes FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can write notes"
  ON public.crm_notes FOR ALL TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can read documents"
  ON public.crm_documents FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can write documents"
  ON public.crm_documents FOR ALL TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can read import batches"
  ON public.crm_import_batches FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can write import batches"
  ON public.crm_import_batches FOR ALL TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can read import rows"
  ON public.crm_import_rows FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can write import rows"
  ON public.crm_import_rows FOR ALL TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Members can read export jobs"
  ON public.crm_export_jobs FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));
CREATE POLICY "Members can create export jobs"
  ON public.crm_export_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));
CREATE POLICY "Members can update their export jobs"
  ON public.crm_export_jobs FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Admins can read backup runs"
  ON public.crm_backup_runs FOR SELECT TO authenticated
  USING (account_id IS NULL OR public.is_account_admin(account_id));

CREATE POLICY "Members can read audit logs"
  ON public.crm_audit_logs FOR SELECT TO authenticated
  USING (account_id IS NOT NULL AND public.is_account_member(account_id));

CREATE TRIGGER set_agency_accounts_updated_at
  BEFORE UPDATE ON public.agency_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_account_users_updated_at
  BEFORE UPDATE ON public.account_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_crm_clients_updated_at
  BEFORE UPDATE ON public.crm_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_crm_policies_updated_at
  BEFORE UPDATE ON public.crm_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_crm_renewals_updated_at
  BEFORE UPDATE ON public.crm_renewals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_crm_notes_updated_at
  BEFORE UPDATE ON public.crm_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_crm_documents_updated_at
  BEFORE UPDATE ON public.crm_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_crm_import_batches_updated_at
  BEFORE UPDATE ON public.crm_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_account_users_user ON public.account_users(user_id, status);
CREATE INDEX IF NOT EXISTS idx_account_users_account ON public.account_users(account_id, role);
CREATE INDEX IF NOT EXISTS idx_crm_clients_account_name ON public.crm_clients(account_id, display_name);
CREATE INDEX IF NOT EXISTS idx_crm_clients_account_status ON public.crm_clients(account_id, account_status);
CREATE INDEX IF NOT EXISTS idx_crm_policies_account_client ON public.crm_policies(account_id, client_id);
CREATE INDEX IF NOT EXISTS idx_crm_policies_expiration ON public.crm_policies(account_id, expiration_date);
CREATE INDEX IF NOT EXISTS idx_crm_policies_number ON public.crm_policies(account_id, policy_number);
CREATE INDEX IF NOT EXISTS idx_crm_renewals_due ON public.crm_renewals(account_id, due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee ON public.crm_tasks(account_id, assigned_to_user_id, completed);
CREATE INDEX IF NOT EXISTS idx_crm_notes_client ON public.crm_notes(account_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_documents_account ON public.crm_documents(account_id, client_id);
CREATE INDEX IF NOT EXISTS idx_crm_import_rows_batch ON public.crm_import_rows(batch_id, row_number);
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_account ON public.crm_export_jobs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_account ON public.crm_audit_logs(account_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('agencyiq-documents', 'agencyiq-documents', false, 52428800, NULL),
  ('agencyiq-imports', 'agencyiq-imports', false, 52428800, NULL),
  ('agencyiq-exports', 'agencyiq-exports', false, 1073741824, NULL),
  ('agencyiq-backups', 'agencyiq-backups', false, 1073741824, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can read account-scoped CRM storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('agencyiq-documents','agencyiq-imports','agencyiq-exports')
    AND public.is_account_member(public.storage_account_id(name))
  );

CREATE POLICY "Members can upload account-scoped CRM storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('agencyiq-documents','agencyiq-imports','agencyiq-exports')
    AND public.is_account_member(public.storage_account_id(name))
  );

CREATE POLICY "Members can update account-scoped CRM storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('agencyiq-documents','agencyiq-imports','agencyiq-exports')
    AND public.is_account_member(public.storage_account_id(name))
  )
  WITH CHECK (
    bucket_id IN ('agencyiq-documents','agencyiq-imports','agencyiq-exports')
    AND public.is_account_member(public.storage_account_id(name))
  );

CREATE POLICY "Admins can delete account-scoped CRM storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('agencyiq-documents','agencyiq-imports','agencyiq-exports')
    AND public.is_account_admin(public.storage_account_id(name))
  );
