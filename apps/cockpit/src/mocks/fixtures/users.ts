import type { UserSummary } from '@/types/users';

export type { UserRole, UserStatus, UserSummary } from '@/types/users';

export const MOCK_USERS: UserSummary[] = [
  {
    userId: 'user-operator-riley',
    name: 'Riley Operator',
    email: 'riley.operator@platform.example.test',
    role: 'Operator',
    status: 'active',
    lastActiveIso: '2026-02-20T09:15:00Z',
  },
  {
    userId: 'user-approver-morgan',
    name: 'Morgan Approver',
    email: 'morgan.approver@platform.example.test',
    role: 'Approver',
    status: 'active',
    lastActiveIso: '2026-02-20T08:42:00Z',
  },
  {
    userId: 'user-auditor-casey',
    name: 'Casey Auditor',
    email: 'casey.auditor@platform.example.test',
    role: 'Auditor',
    status: 'active',
    lastActiveIso: '2026-02-19T17:30:00Z',
  },
  {
    userId: 'user-admin-jules',
    name: 'Jules Admin',
    email: 'jules.admin@platform.example.test',
    role: 'Admin',
    status: 'active',
    lastActiveIso: '2026-02-20T07:10:00Z',
  },
  {
    userId: 'user-operator-taylor',
    name: 'Taylor Operator',
    email: 'taylor.operator@platform.example.test',
    role: 'Operator',
    status: 'active',
    lastActiveIso: '2026-02-18T14:05:00Z',
  },
  {
    userId: 'user-approver-lee',
    name: 'Lee Approver',
    email: 'lee.approver@platform.example.test',
    role: 'Approver',
    status: 'active',
    lastActiveIso: '2026-02-19T16:45:00Z',
  },
  {
    userId: 'user-auditor-quinn',
    name: 'Quinn Auditor',
    email: 'quinn.auditor@platform.example.test',
    role: 'Auditor',
    status: 'active',
    lastActiveIso: '2026-02-17T10:00:00Z',
  },
  {
    userId: 'user-admin-avery',
    name: 'Avery Admin',
    email: 'avery.admin@platform.example.test',
    role: 'Admin',
    status: 'active',
    lastActiveIso: '2026-02-20T06:55:00Z',
  },
  {
    userId: 'user-operator-disabled',
    name: 'Disabled Operator',
    email: 'disabled.operator@platform.example.test',
    role: 'Operator',
    status: 'suspended',
    lastActiveIso: '2026-02-01T09:30:00Z',
  },
];
