import type { CrmDataset } from './crmTypes'
import { createDemoDataset, demoAgencyId, demoUserId } from './seedData'

const storagePrefix = 'agencyiq:crm'

const getDatasetKey = (accountId: string, userId: string) => {
  return `${storagePrefix}:${accountId}:${userId}`
}

const migrateDataset = (dataset: CrmDataset): CrmDataset => {
  const seeded = createDemoDataset()

  if (!Array.isArray(dataset.clients) || dataset.clients.length < 8) {
    return {
      ...seeded,
      currentUser: {
        ...seeded.currentUser,
        role: dataset.currentUser?.role ?? seeded.currentUser.role,
      },
    }
  }

  const mergeById = <T extends { id: string }>(current: T[], seed: T[]) => {
    const currentIds = new Set(current.map((item) => item.id))
    return [...current, ...seed.filter((item) => !currentIds.has(item.id))]
  }

  return {
    ...dataset,
    users: Array.isArray(dataset.users) && dataset.users.length > 0 ? dataset.users : seeded.users,
    clients: mergeById(dataset.clients, seeded.clients).map((client) => ({
      ...client,
      status: client.status ?? 'Client',
    })),
    policies: mergeById(dataset.policies, seeded.policies),
    renewals: mergeById(dataset.renewals, seeded.renewals),
    tasks: mergeById(dataset.tasks, seeded.tasks),
    opportunities: mergeById(dataset.opportunities, seeded.opportunities),
    quoteRequests: Array.isArray(dataset.quoteRequests) ? dataset.quoteRequests : seeded.quoteRequests,
    carrierResources: Array.isArray(dataset.carrierResources)
      ? dataset.carrierResources
      : seeded.carrierResources,
    notes: Array.isArray(dataset.notes) ? dataset.notes : seeded.notes,
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
  const saved = localStorage.getItem(key)

  if (!saved) {
    const seeded = createDemoDataset()
    localStorage.setItem(key, JSON.stringify(seeded))
    return seeded
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
