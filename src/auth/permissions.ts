import type { UserProfile } from '../data/crmTypes'

export type Permission = 'viewOwnerAnalytics' | 'viewRevenueReports' | 'manageAgencyUsers'

const ownerPermissions: Permission[] = [
  'viewOwnerAnalytics',
  'viewRevenueReports',
  'manageAgencyUsers',
]

const adminPermissions: Permission[] = ['viewOwnerAnalytics', 'viewRevenueReports', 'manageAgencyUsers']

const producerPermissions: Permission[] = []

const csrPermissions: Permission[] = []

export const getPermissionsForUser = (user: UserProfile): Set<Permission> => {
  if (user.role === 'Agent/Owner' || user.role === 'Principal Agent') {
    return new Set(ownerPermissions)
  }

  if (user.role === 'Admin') {
    return new Set(adminPermissions)
  }

  if (user.role === 'Producer') {
    return new Set(producerPermissions)
  }

  return new Set(csrPermissions)
}

export const canViewOwnerAnalytics = (user: UserProfile) => {
  return getPermissionsForUser(user).has('viewOwnerAnalytics')
}
