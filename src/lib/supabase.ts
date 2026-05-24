import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
