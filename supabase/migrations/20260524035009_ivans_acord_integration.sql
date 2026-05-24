/*
  # IVANS / ACORD Integration Schema

  ## Overview
  Adds the full data infrastructure for IVANS Cloud download integration and ACORD
  file parsing. Enables agents to sync carrier policy data, renewal notices, and
  premium updates directly into the CRM.

  ## New Tables

  ### 1. `ivans_connections`
  Per-agency carrier credentials for IVANS polling. One row per carrier per account.
  - status: active | paused | error | pending_setup

  ### 2. `ivans_sync_log`
  Audit trail for every IVANS poll attempt (last 90 days). Agents see exactly when
  data was fetched and what changed.

  ### 3. `ivans_download_queue`
  Queue of ACORD files waiting to be parsed. Raw content cleared after parse.

  ### 4. `ivans_policy_sync`
  Stores parsed policy data from IVANS/ACORD downloads, keyed by policy number.
  This is the canonical "what carrier sent us" record that the agent can then
  accept/merge into their CRM policy record.

  ## Security
  - RLS on all tables
  - All rows scoped to account_id from JWT
  - Sync log and download queue are written by service role (edge functions)
*/

-- ─── ivans_connections ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ivans_connections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            text NOT NULL,
  carrier_name          text NOT NULL DEFAULT '',
  ivans_subscriber_id   text NOT NULL DEFAULT '',
  ivans_username        text NOT NULL DEFAULT '',
  ivans_password_ref    text NOT NULL DEFAULT '',
  api_endpoint          text NOT NULL DEFAULT 'https://www.ivansinsurance.com/ivanscloud/api',
  last_sync_at          timestamptz,
  next_sync_at          timestamptz,
  sync_frequency_hours  integer NOT NULL DEFAULT 24,
  status                text NOT NULL DEFAULT 'pending_setup'
                          CHECK (status IN ('active','paused','error','pending_setup')),
  error_message         text NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ivans_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view their IVANS connections"
  ON ivans_connections FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id'));

CREATE POLICY "Account members can add IVANS connections"
  ON ivans_connections FOR INSERT
  TO authenticated
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id'));

CREATE POLICY "Account members can update their IVANS connections"
  ON ivans_connections FOR UPDATE
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id'))
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id'));

CREATE POLICY "Account members can delete their IVANS connections"
  ON ivans_connections FOR DELETE
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id'));

-- ─── ivans_sync_log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ivans_sync_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       uuid REFERENCES ivans_connections(id) ON DELETE SET NULL,
  account_id          text NOT NULL,
  triggered_by        text NOT NULL DEFAULT 'scheduled'
                        CHECK (triggered_by IN ('scheduled','manual')),
  status              text NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','completed','failed')),
  files_fetched       integer NOT NULL DEFAULT 0,
  policies_created    integer NOT NULL DEFAULT 0,
  policies_updated    integer NOT NULL DEFAULT 0,
  renewals_flagged    integer NOT NULL DEFAULT 0,
  error_detail        text NOT NULL DEFAULT '',
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

ALTER TABLE ivans_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view their sync log"
  ON ivans_sync_log FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id'));

-- ─── ivans_download_queue ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ivans_download_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid REFERENCES ivans_connections(id) ON DELETE SET NULL,
  account_id      text NOT NULL,
  file_name       text NOT NULL DEFAULT '',
  acord_format    text NOT NULL DEFAULT 'XML'
                    CHECK (acord_format IN ('XML','AL3','Unknown')),
  raw_content     text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','parsed','error')),
  parse_error     text NOT NULL DEFAULT '',
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  parsed_at       timestamptz
);

ALTER TABLE ivans_download_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view their download queue"
  ON ivans_download_queue FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id'));

-- ─── ivans_policy_sync ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ivans_policy_sync (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            text NOT NULL,
  connection_id         uuid REFERENCES ivans_connections(id) ON DELETE SET NULL,
  queue_item_id         uuid REFERENCES ivans_download_queue(id) ON DELETE SET NULL,
  policy_number         text NOT NULL DEFAULT '',
  insured_name          text NOT NULL DEFAULT '',
  carrier_name          text NOT NULL DEFAULT '',
  policy_type           text NOT NULL DEFAULT '',
  line_of_business      text NOT NULL DEFAULT '',
  acord_transaction     text NOT NULL DEFAULT '',
  effective_date        date,
  expiration_date       date,
  current_premium       numeric(12,2),
  renewal_premium       numeric(12,2),
  renewal_status        text NOT NULL DEFAULT 'pending'
                          CHECK (renewal_status IN ('pending','renewal_pending','renewed','cancelled','non_renewed','unknown')),
  payment_plan          text NOT NULL DEFAULT '',
  billing_type          text NOT NULL DEFAULT '',
  mortgagee             text NOT NULL DEFAULT '',
  agent_notified        boolean NOT NULL DEFAULT false,
  crm_policy_id         text,
  merge_status          text NOT NULL DEFAULT 'unmatched'
                          CHECK (merge_status IN ('unmatched','matched','merged','skipped')),
  raw_acord_data        jsonb,
  synced_at             timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ivans_policy_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view their synced policies"
  ON ivans_policy_sync FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id'));

CREATE POLICY "Account members can update merge status"
  ON ivans_policy_sync FOR UPDATE
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id'))
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id'));

-- ─── Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ivans_connections_account
  ON ivans_connections(account_id);

CREATE INDEX IF NOT EXISTS idx_ivans_sync_log_account
  ON ivans_sync_log(account_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ivans_sync_log_connection
  ON ivans_sync_log(connection_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ivans_queue_status
  ON ivans_download_queue(status, fetched_at);

CREATE INDEX IF NOT EXISTS idx_ivans_queue_account
  ON ivans_download_queue(account_id);

CREATE INDEX IF NOT EXISTS idx_ivans_policy_sync_account
  ON ivans_policy_sync(account_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_ivans_policy_sync_policy_number
  ON ivans_policy_sync(policy_number);

CREATE INDEX IF NOT EXISTS idx_ivans_policy_sync_merge
  ON ivans_policy_sync(merge_status, renewal_status);
