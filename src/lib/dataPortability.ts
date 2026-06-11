import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrmDataset } from '../data/crmTypes'
import type { CrmExportJob, CrmImportBatch } from './supabase'

export type ImportPreview = {
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
}

export type ImportField =
  | 'client_name'
  | 'primary_contact'
  | 'email'
  | 'phone'
  | 'mailing_address'
  | 'policy_type'
  | 'policy_number'
  | 'carrier'
  | 'effective_date'
  | 'expiration_date'
  | 'premium'
  | 'line_of_business'
  | 'notes'

export type ImportMapping = Partial<Record<ImportField, string>>

export const IMPORT_FIELDS: Array<{ key: ImportField; label: string; required?: boolean }> = [
  { key: 'client_name', label: 'Client Name', required: true },
  { key: 'primary_contact', label: 'Primary Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'mailing_address', label: 'Mailing Address' },
  { key: 'policy_type', label: 'Policy Type' },
  { key: 'policy_number', label: 'Policy Number' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'effective_date', label: 'Effective Date' },
  { key: 'expiration_date', label: 'Expiration Date' },
  { key: 'premium', label: 'Premium' },
  { key: 'line_of_business', label: 'Line of Business' },
  { key: 'notes', label: 'Notes' },
]

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const guessHeader = (headers: string[], candidates: string[]) => {
  const normalized = headers.map((header) => ({ header, normalized: normalizeHeader(header) }))
  return normalized.find((item) => candidates.some((candidate) => item.normalized.includes(candidate)))?.header ?? ''
}

export const guessImportMapping = (headers: string[]): ImportMapping => ({
  client_name: guessHeader(headers, ['clientname', 'insuredname', 'customername', 'accountname', 'name']),
  primary_contact: guessHeader(headers, ['primarycontact', 'contactname', 'contact']),
  email: guessHeader(headers, ['email', 'emailaddress']),
  phone: guessHeader(headers, ['phone', 'mobile', 'telephone']),
  mailing_address: guessHeader(headers, ['mailingaddress', 'address']),
  policy_type: guessHeader(headers, ['policytype', 'lineofbusiness', 'coverage']),
  policy_number: guessHeader(headers, ['policynumber', 'policyno', 'polnum']),
  carrier: guessHeader(headers, ['carrier', 'company', 'market']),
  effective_date: guessHeader(headers, ['effectivedate', 'effdate']),
  expiration_date: guessHeader(headers, ['expirationdate', 'expirydate', 'expdate', 'renewaldate']),
  premium: guessHeader(headers, ['premium', 'annualpremium']),
  line_of_business: guessHeader(headers, ['lineofbusiness', 'lob']),
  notes: guessHeader(headers, ['notes', 'remarks', 'description']),
})

export const parseCsvText = (csvText: string): ImportPreview => {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const next = csvText[index + 1]

    if (char === '"' && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(current.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      current = ''
    } else {
      current += char
    }
  }

  row.push(current.trim())
  if (row.some(Boolean)) rows.push(row)

  const headers = rows[0] ?? []
  const dataRows = rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
  )

  return { headers, rows: dataRows, rowCount: dataRows.length }
}

export const buildPortableDataset = (dataset: CrmDataset) => ({
  exportedAt: new Date().toISOString(),
  format: 'agencyiq-portable-json-v1',
  agency: dataset.agency,
  currentUser: dataset.currentUser,
  users: dataset.users,
  clients: dataset.clients,
  policies: dataset.policies,
  renewals: dataset.renewals,
  tasks: dataset.tasks,
  opportunities: dataset.opportunities,
  quoteRequests: dataset.quoteRequests,
  carrierResources: dataset.carrierResources,
  notes: dataset.notes,
  relatedParties: dataset.relatedParties,
  policyTransactions: dataset.policyTransactions,
  claims: dataset.claims,
  riskAssets: dataset.riskAssets,
  paymentLedger: dataset.paymentLedger,
  commissionStatements: dataset.commissionStatements,
  acordDrafts: dataset.acordDrafts,
  clientCloudFolders: dataset.clientCloudFolders,
})

export const parsePortableDataset = (jsonText: string): CrmDataset => {
  const parsed = JSON.parse(jsonText) as Partial<CrmDataset> & { format?: string }
  if (parsed.format !== 'agencyiq-portable-json-v1') {
    throw new Error('This is not an AgencyIQ portable JSON export.')
  }

  if (!parsed.agency || !parsed.currentUser || !Array.isArray(parsed.clients) || !Array.isArray(parsed.policies)) {
    throw new Error('The AgencyIQ export is missing required client or policy data.')
  }

  return {
    agency: parsed.agency,
    currentUser: parsed.currentUser,
    users: Array.isArray(parsed.users) ? parsed.users : [parsed.currentUser],
    clients: parsed.clients,
    policies: parsed.policies,
    renewals: Array.isArray(parsed.renewals) ? parsed.renewals : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    quoteRequests: Array.isArray(parsed.quoteRequests) ? parsed.quoteRequests : [],
    carrierResources: Array.isArray(parsed.carrierResources) ? parsed.carrierResources : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    relatedParties: Array.isArray(parsed.relatedParties) ? parsed.relatedParties : [],
    policyTransactions: Array.isArray(parsed.policyTransactions) ? parsed.policyTransactions : [],
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    riskAssets: Array.isArray(parsed.riskAssets) ? parsed.riskAssets : [],
    paymentLedger: Array.isArray(parsed.paymentLedger) ? parsed.paymentLedger : [],
    commissionStatements: Array.isArray(parsed.commissionStatements) ? parsed.commissionStatements : [],
    acordDrafts: Array.isArray(parsed.acordDrafts) ? parsed.acordDrafts : [],
    clientCloudFolders: Array.isArray(parsed.clientCloudFolders) ? parsed.clientCloudFolders : [],
  }
}

export const downloadJsonExport = (dataset: CrmDataset) => {
  const blob = new Blob([JSON.stringify(buildPortableDataset(dataset), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agencyiq-full-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const createImportBatch = async (
  supabaseClient: SupabaseClient,
  accountId: string,
  file: File,
  preview: ImportPreview,
  mapping: ImportMapping,
): Promise<CrmImportBatch> => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser()

  const storagePath = `${accountId}/imports/${crypto.randomUUID()}-${file.name}`
  const upload = await supabaseClient.storage.from('agencyiq-imports').upload(storagePath, file, {
    upsert: false,
  })
  if (upload.error) throw upload.error

  const insert = await supabaseClient
    .from('crm_import_batches')
    .insert({
      account_id: accountId,
      created_by_user_id: user?.id ?? null,
      source_system: 'csv',
      original_file_name: file.name,
      storage_path: storagePath,
      status: 'mapped',
      mapping,
      summary: {
        headers: preview.headers,
        row_count: preview.rowCount,
      },
    })
    .select('*')
    .single()

  if (insert.error) throw insert.error

  const rows = preview.rows.slice(0, 1000).map((rawData, index) => ({
    account_id: accountId,
    batch_id: insert.data.id,
    row_number: index + 1,
    raw_data: rawData,
    normalized_data: Object.fromEntries(
      Object.entries(mapping)
        .filter(([, header]) => header)
        .map(([field, header]) => [field, rawData[header as string] ?? '']),
    ),
    validation_errors: mapping.client_name ? [] : ['Client Name mapping is required'],
    import_status: mapping.client_name ? 'valid' : 'invalid',
  }))

  if (rows.length > 0) {
    const rowInsert = await supabaseClient.from('crm_import_rows').insert(rows)
    if (rowInsert.error) throw rowInsert.error
  }

  return insert.data as CrmImportBatch
}

export const createExportJob = async (
  supabaseClient: SupabaseClient,
  accountId: string,
  exportType: CrmExportJob['export_type'] = 'full',
  format: CrmExportJob['format'] = 'json',
): Promise<CrmExportJob> => {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser()

  const insert = await supabaseClient
    .from('crm_export_jobs')
    .insert({
      account_id: accountId,
      requested_by_user_id: user?.id ?? null,
      export_type: exportType,
      format,
      status: 'queued',
      row_counts: {},
    })
    .select('*')
    .single()

  if (insert.error) throw insert.error
  return insert.data as CrmExportJob
}
