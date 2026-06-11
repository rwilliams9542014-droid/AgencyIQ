/*
  # Carrier Credential Vault

  Stores carrier portal access records and encrypted credential metadata.
  Passwords are encrypted/decrypted only by the carrier-access Edge Function.
*/

ALTER TABLE public.account_users
  ADD COLUMN IF NOT EXISTS can_view_carrier_credentials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_copy_carrier_credentials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_carrier_credentials boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.carrier_access (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  carrier_name          text NOT NULL,
  carrier_aliases       text[] NOT NULL DEFAULT '{}'::text[],
  portal_url            text,
  policy_lookup_url     text,
  billing_url           text,
  claims_url            text,
  producer_code         text,
  agency_code           text,
  username              text,
  encrypted_password    text,
  password_iv           text,
  password_auth_tag     text,
  password_updated_at   timestamptz,
  password_updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  login_notes           text,
  active                boolean NOT NULL DEFAULT true,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carrier_credential_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.agency_accounts(id) ON DELETE CASCADE,
  carrier_id  uuid REFERENCES public.carrier_access(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (
    action_type IN (
      'created_credentials',
      'updated_credentials',
      'revealed_password',
      'copied_password',
      'opened_portal'
    )
  ),
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carrier_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_credential_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.carrier_access_safe AS
SELECT
  id,
  account_id,
  carrier_name,
  carrier_aliases,
  portal_url,
  policy_lookup_url,
  billing_url,
  claims_url,
  producer_code,
  agency_code,
  username,
  (encrypted_password IS NOT NULL) AS has_password,
  password_updated_at,
  password_updated_by,
  login_notes,
  active,
  created_by,
  created_at,
  updated_at
FROM public.carrier_access;

CREATE POLICY "Members can read safe carrier access through function"
  ON public.carrier_access FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

CREATE POLICY "Credential managers can insert carrier access"
  ON public.carrier_access FOR INSERT TO authenticated
  WITH CHECK (
    public.is_account_admin(account_id)
    OR EXISTS (
      SELECT 1 FROM public.account_users au
      WHERE au.account_id = carrier_access.account_id
        AND au.user_id = auth.uid()
        AND au.status = 'active'
        AND au.can_manage_carrier_credentials
    )
  );

CREATE POLICY "Credential managers can update carrier access"
  ON public.carrier_access FOR UPDATE TO authenticated
  USING (
    public.is_account_admin(account_id)
    OR EXISTS (
      SELECT 1 FROM public.account_users au
      WHERE au.account_id = carrier_access.account_id
        AND au.user_id = auth.uid()
        AND au.status = 'active'
        AND au.can_manage_carrier_credentials
    )
  )
  WITH CHECK (
    public.is_account_admin(account_id)
    OR EXISTS (
      SELECT 1 FROM public.account_users au
      WHERE au.account_id = carrier_access.account_id
        AND au.user_id = auth.uid()
        AND au.status = 'active'
        AND au.can_manage_carrier_credentials
    )
  );

CREATE POLICY "Credential managers can delete carrier access"
  ON public.carrier_access FOR DELETE TO authenticated
  USING (
    public.is_account_admin(account_id)
    OR EXISTS (
      SELECT 1 FROM public.account_users au
      WHERE au.account_id = carrier_access.account_id
        AND au.user_id = auth.uid()
        AND au.status = 'active'
        AND au.can_manage_carrier_credentials
    )
  );

CREATE POLICY "Admins can read carrier credential audit logs"
  ON public.carrier_credential_audit_logs FOR SELECT TO authenticated
  USING (public.is_account_admin(account_id));

CREATE POLICY "Members can insert carrier credential audit logs"
  ON public.carrier_credential_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

CREATE TRIGGER set_carrier_access_updated_at
  BEFORE UPDATE ON public.carrier_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_carrier_access_account_name
  ON public.carrier_access(account_id, carrier_name);

CREATE INDEX IF NOT EXISTS idx_carrier_access_aliases
  ON public.carrier_access USING gin(carrier_aliases);

CREATE INDEX IF NOT EXISTS idx_carrier_credential_audit_account
  ON public.carrier_credential_audit_logs(account_id, created_at DESC);
