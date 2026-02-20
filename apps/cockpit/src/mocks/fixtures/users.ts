// ---------------------------------------------------------------------------
// Mock Users fixture
// ---------------------------------------------------------------------------

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

export const MOCK_USERS: UserSummary[] = [
  {
    userId: 'user-001',
    name: 'Alice Chen',
    email: 'alice.chen@meridian.io',
    role: 'Admin',
    status: 'active',
    lastActiveIso: '2026-02-20T09:15:00Z',
  },
  {
    userId: 'user-002',
    name: 'Bob Martinez',
    email: 'bob.martinez@meridian.io',
    role: 'Operator',
    status: 'active',
    lastActiveIso: '2026-02-20T08:42:00Z',
  },
  {
    userId: 'user-003',
    name: 'Dana Approver',
    email: 'dana.approver@meridian.io',
    role: 'Approver',
    status: 'active',
    lastActiveIso: '2026-02-19T17:30:00Z',
  },
  {
    userId: 'user-004',
    name: 'Eric Nakamura',
    email: 'eric.nakamura@meridian.io',
    role: 'Operator',
    status: 'active',
    lastActiveIso: '2026-02-20T07:10:00Z',
  },
  {
    userId: 'user-005',
    name: 'Fatima Al-Rashid',
    email: 'fatima.alrashid@meridian.io',
    role: 'Auditor',
    status: 'active',
    lastActiveIso: '2026-02-18T14:05:00Z',
  },
  {
    userId: 'user-006',
    name: 'Greg Novak',
    email: 'greg.novak@meridian.io',
    role: 'Operator',
    status: 'suspended',
    lastActiveIso: '2026-01-28T11:20:00Z',
  },
  {
    userId: 'user-007',
    name: 'Hannah Liu',
    email: 'hannah.liu@meridian.io',
    role: 'Approver',
    status: 'active',
    lastActiveIso: '2026-02-19T16:45:00Z',
  },
  {
    userId: 'user-008',
    name: 'Ivan Petrov',
    email: 'ivan.petrov@meridian.io',
    role: 'Auditor',
    status: 'active',
    lastActiveIso: '2026-02-17T10:00:00Z',
  },
  {
    userId: 'user-009',
    name: 'Julia Santos',
    email: 'julia.santos@meridian.io',
    role: 'Admin',
    status: 'active',
    lastActiveIso: '2026-02-20T06:55:00Z',
  },
  {
    userId: 'user-010',
    name: 'Kevin O\'Brien',
    email: 'kevin.obrien@meridian.io',
    role: 'Operator',
    status: 'suspended',
    lastActiveIso: '2026-02-01T09:30:00Z',
  },
];
