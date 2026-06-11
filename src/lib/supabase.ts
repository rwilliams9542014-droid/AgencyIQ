import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const placeholderValues = new Set([
  '',
  'https://your-project-ref.supabase.co',
  'your-supabase-anon-key',
])

const hasRealSupabaseConfig =
  !placeholderValues.has(supabaseUrl ?? '') &&
  !placeholderValues.has(supabaseAnonKey ?? '')

export const supabaseConfigured = hasRealSupabaseConfig
export const supabaseFunctionsUrl = hasRealSupabaseConfig ? `${supabaseUrl}/functions/v1` : ''
export const supabasePublicAnonKey = hasRealSupabaseConfig ? supabaseAnonKey : ''

export const supabase =
  hasRealSupabaseConfig
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export type AgencyAccountRow = {
  id: string
  name: string
  slug: string | null
  plan: 'demo' | 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'trialing' | 'past_due' | 'suspended' | 'closed'
  owner_user_id: string | null
  data_region: string
  backup_policy_days: number
  created_at: string
  updated_at: string
}

export type AccountUserRow = {
  id: string
  account_id: string
  user_id: string
  role: 'owner' | 'admin' | 'producer' | 'csr' | 'readonly'
  status: 'active' | 'invited' | 'disabled'
  invited_email: string | null
  created_at: string
  updated_at: string
}

export type CrmImportBatch = {
  id: string
  account_id: string
  created_by_user_id: string | null
  source_system: string
  original_file_name: string
  storage_path: string | null
  status: 'uploaded' | 'mapped' | 'validated' | 'importing' | 'completed' | 'failed' | 'cancelled'
  mapping: Record<string, unknown>
  summary: Record<string, unknown>
  error_message: string | null
  created_at: string
  updated_at: string
}

export type CrmImportRow = {
  id: string
  account_id: string
  batch_id: string
  row_number: number
  raw_data: Record<string, unknown>
  normalized_data: Record<string, unknown>
  validation_errors: unknown[]
  import_status: 'pending' | 'valid' | 'invalid' | 'imported' | 'skipped' | 'failed'
  target_client_id: string | null
  target_policy_id: string | null
  created_at: string
}

export type CrmExportJob = {
  id: string
  account_id: string
  requested_by_user_id: string | null
  export_type: 'full' | 'clients' | 'policies' | 'notes' | 'documents' | 'audit'
  format: 'json' | 'csv' | 'zip'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'expired'
  storage_path: string | null
  row_counts: Record<string, unknown>
  expires_at: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export type CrmBackupRun = {
  id: string
  account_id: string | null
  backup_scope: 'all_accounts' | 'single_account' | 'schema_only' | 'storage_only'
  status: 'queued' | 'running' | 'completed' | 'failed'
  provider: string
  storage_path: string | null
  checksum_sha256: string | null
  size_bytes: number | null
  started_at: string
  completed_at: string | null
  error_message: string | null
}

export type IvansConnection = {
  id: string
  account_id: string
  carrier_name: string
  ivans_subscriber_id: string
  ivans_username: string
  ivans_password_ref: string
  api_endpoint: string
  last_sync_at: string | null
  next_sync_at: string | null
  sync_frequency_hours: number
  status: 'active' | 'paused' | 'error' | 'pending_setup'
  error_message: string
  created_at: string
  updated_at: string
}

export type IvansSyncLog = {
  id: string
  connection_id: string | null
  account_id: string
  triggered_by: 'scheduled' | 'manual'
  status: 'running' | 'completed' | 'failed'
  files_fetched: number
  policies_created: number
  policies_updated: number
  renewals_flagged: number
  error_detail: string
  started_at: string
  completed_at: string | null
}

export type IvansPolicySync = {
  id: string
  account_id: string
  connection_id: string | null
  policy_number: string
  insured_name: string
  carrier_name: string
  policy_type: string
  line_of_business: string
  acord_transaction: string
  effective_date: string | null
  expiration_date: string | null
  current_premium: number | null
  renewal_premium: number | null
  renewal_status: 'pending' | 'renewal_pending' | 'renewed' | 'cancelled' | 'non_renewed' | 'unknown'
  payment_plan: string
  billing_type: string
  mortgagee: string
  agent_notified: boolean
  crm_policy_id: string | null
  merge_status: 'unmatched' | 'matched' | 'merged' | 'skipped'
  raw_acord_data: Record<string, unknown> | null
  synced_at: string
  created_at: string
}

export type CarrierAccess = {
  id: string
  account_id: string
  carrier_name: string
  carrier_aliases: string[]
  portal_url: string | null
  policy_lookup_url: string | null
  billing_url: string | null
  claims_url: string | null
  producer_code: string | null
  agency_code: string | null
  username: string | null
  has_password?: boolean
  password_updated_at: string | null
  password_updated_by: string | null
  login_notes: string | null
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CarrierCredentialAuditLog = {
  id: string
  account_id: string
  carrier_id: string | null
  user_id: string | null
  action_type: 'created_credentials' | 'updated_credentials' | 'revealed_password' | 'copied_password' | 'opened_portal'
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
