import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals/$approvalId',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/approvals',
      search: { focus: params.approvalId },
    });
  },
});
