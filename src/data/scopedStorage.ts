import type { CrmDataset } from './crmTypes'
import { createDemoDataset, demoAgencyId, demoUserId } from './seedData'
import { createBulkSeedData } from './bulkSeedData'

const storagePrefix = 'agencyiq:crm'
const SEED_VERSION = 'v3-bulk-100'
const SEED_VERSION_KEY = 'agencyiq:seed-version'

const getDatasetKey = (accountId: string, userId: string) => {
  return `${storagePrefix}:${accountId}:${userId}`
}

const mergeById = <T extends { id: string }>(current: T[], seed: T[]) => {
  const currentIds = new Set(current.map((item) => item.id))
  return [...current, ...seed.filter((item) => !currentIds.has(item.id))]
}

const migrateDataset = (dataset: CrmDataset): CrmDataset => {
  const seeded = createDemoDataset()
  const bulk = createBulkSeedData()

  const fullDataset = {
    ...seeded,
    clients: mergeById(seeded.clients, bulk.clients),
    policies: mergeById(seeded.policies, bulk.policies),
    renewals: mergeById(seeded.renewals, bulk.renewals),
    tasks: mergeById(seeded.tasks, bulk.tasks),
    notes: mergeById(seeded.notes, bulk.notes),
  }

  if (!Array.isArray(dataset.clients) || dataset.clients.filter((c) => c.id.startsWith('client-bulk-')).length < 50) {
    return {
      ...fullDataset,
      currentUser: {
        ...seeded.currentUser,
        role: dataset.currentUser?.role ?? seeded.currentUser.role,
      },
    }
  }

  return {
    ...dataset,
    users: Array.isArray(dataset.users) && dataset.users.length > 0 ? dataset.users : seeded.users,
    clients: mergeById(
      mergeById(dataset.clients, seeded.clients),
      bulk.clients,
    ).map((client) => ({ ...client, status: client.status ?? 'Client' })),
    policies: mergeById(mergeById(dataset.policies, seeded.policies), bulk.policies),
    renewals: mergeById(mergeById(dataset.renewals, seeded.renewals), bulk.renewals),
    tasks: mergeById(mergeById(dataset.tasks, seeded.tasks), bulk.tasks),
    opportunities: mergeById(dataset.opportunities, seeded.opportunities),
    quoteRequests: Array.isArray(dataset.quoteRequests) ? dataset.quoteRequests : seeded.quoteRequests,
    carrierResources: Array.isArray(dataset.carrierResources) ? dataset.carrierResources : seeded.carrierResources,
    notes: mergeById(mergeById(dataset.notes, seeded.notes), bulk.notes),
  }
}

const isCrmDataset = (value: unknown): value is CrmDataset => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CrmDataset>
  return Boolean(
    candidate.agency &&
      candidate.currentUser &&
      Array.isArray(candidate.clients) &&
      Array.isArray(candidate.policies) &&
      Array.isArray(candidate.renewals) &&
      Array.isArray(candidate.tasks) &&
      Array.isArray(candidate.opportunities),
  )
}

export const loadDataset = (
  accountId: string = demoAgencyId,
  userId: string = demoUserId,
): CrmDataset => {
  const key = getDatasetKey(accountId, userId)

  // Force fresh seed on version change
  if (localStorage.getItem(SEED_VERSION_KEY) !== SEED_VERSION) {
    localStorage.removeItem(key)
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION)
  }

  const saved = localStorage.getItem(key)

  if (!saved) {
    const seeded = createDemoDataset()
    const bulk = createBulkSeedData()
    const full: CrmDataset = {
      ...seeded,
      clients: mergeById(seeded.clients, bulk.clients),
      policies: mergeById(seeded.policies, bulk.policies),
      renewals: mergeById(seeded.renewals, bulk.renewals),
      tasks: mergeById(seeded.tasks, bulk.tasks),
      notes: mergeById(seeded.notes, bulk.notes),
    }
    localStorage.setItem(key, JSON.stringify(full))
    return full
  }

  try {
    const parsed: unknown = JSON.parse(saved)
    return isCrmDataset(parsed) ? migrateDataset(parsed) : createDemoDataset()
  } catch {
    return createDemoDataset()
  }
}

export const saveDataset = (dataset: CrmDataset) => {
  const key = getDatasetKey(dataset.agency.id, dataset.currentUser.id)
  localStorage.setItem(key, JSON.stringify(dataset))
}

export const createRecordId = (prefix: string) => {
  return `${prefix}-${crypto.randomUUID()}`
}
