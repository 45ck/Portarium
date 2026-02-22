import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { useUIStore } from '@/stores/ui-store';
import type { PersonaId } from '@/stores/ui-store';

const PERSONA_DEFAULT_ROUTE: Record<PersonaId, string> = {
  Operator: '/inbox',
  Approver: '/approvals',
  Auditor: '/evidence',
  Admin: '/dashboard',
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    const { activePersona } = useUIStore.getState();
    const to = PERSONA_DEFAULT_ROUTE[activePersona] ?? '/inbox';
    throw redirect({ to });
  },
});
