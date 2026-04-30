export type UserRole = 'Operator' | 'Approver' | 'Auditor' | 'Admin';
export type UserStatus = 'active' | 'suspended';

export interface UserSummary {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActiveIso: string;
}
