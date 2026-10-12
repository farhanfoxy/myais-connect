export const memberRoles = [
  'APPLICANT',
  'ORDINARY_MEMBER',
  'LIFETIME_MEMBER',
  'ASSOCIATE_MEMBER',
  'HONORARY_MEMBER',
] as const;

export const committeeRoles = [
  'PRESIDENT',
  'DEPUTY_PRESIDENT',
  'SECRETARY',
  'ASSISTANT_SECRETARY',
  'TREASURER',
  'COMMITTEE_MEMBER',
  'SYSTEM_ADMINISTRATOR',
] as const;

export type MemberRole = typeof memberRoles[number];
export type CommitteeRole = typeof committeeRoles[number];
export type CanonicalRole = MemberRole | CommitteeRole;
export type RoleFamily = 'member' | 'committee';

export const applicationReviewerRoles = [
  'PRESIDENT',
  'DEPUTY_PRESIDENT',
  'SECRETARY',
  'ASSISTANT_SECRETARY',
  'COMMITTEE_MEMBER',
  'SYSTEM_ADMINISTRATOR',
] as const;

export const finalApproverRoles = ['PRESIDENT', 'SYSTEM_ADMINISTRATOR'] as const;
export const paymentReviewerRoles = ['TREASURER', 'SYSTEM_ADMINISTRATOR'] as const;
export const eventManagerRoles = [
  'PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'SYSTEM_ADMINISTRATOR',
] as const;
export const announcementManagerRoles = eventManagerRoles;
export const reportRoles = ['PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'TREASURER', 'SYSTEM_ADMINISTRATOR'] as const;
export const memberDirectoryRoles = ['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY',
  'SYSTEM_ADMINISTRATOR'] as const;
export const auditViewerRoles = ['PRESIDENT', 'SYSTEM_ADMINISTRATOR'] as const;

export function canReviewApplications(role: string | null): boolean {
  return (applicationReviewerRoles as readonly string[]).includes(role ?? '');
}

export function canFinallyApprove(role: string | null): boolean {
  return (finalApproverRoles as readonly string[]).includes(role ?? '');
}

export function canReviewPayments(role: string | null): boolean {
  return (paymentReviewerRoles as readonly string[]).includes(role ?? '');
}

export function canManageEvents(role: string | null): boolean {
  return (eventManagerRoles as readonly string[]).includes(role ?? '');
}
export function canManageAnnouncements(role: string | null): boolean {
  return (announcementManagerRoles as readonly string[]).includes(role ?? '');
}
export function canAccessReports(role: string | null): boolean {
  return (reportRoles as readonly string[]).includes(role ?? '');
}
export function canAccessMemberDirectory(role: string | null): boolean {
  return (memberDirectoryRoles as readonly string[]).includes(role ?? '');
}
export function canViewAuditLog(role: string | null): boolean {
  return (auditViewerRoles as readonly string[]).includes(role ?? '');
}

export function roleFamily(role: string | null): RoleFamily | null {
  if ((memberRoles as readonly string[]).includes(role ?? '')) return 'member';
  if ((committeeRoles as readonly string[]).includes(role ?? '')) return 'committee';
  return null;
}

export function canonicalDestination(role: string | null): '/dashboard' | '/admin' | '/access-denied' {
  const family = roleFamily(role);
  if (family === 'member') return '/dashboard';
  if (family === 'committee') return '/admin';
  return '/access-denied';
}

export function humanizeEnum(value: string | null): string {
  if (!value) return 'Not assigned';
  return value.toLowerCase().split('_').map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}
