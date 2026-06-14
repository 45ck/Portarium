import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { ApprovalsPage, validateApprovalsSearch } from './index';

function ApprovalSwipeRouteComponent() {
  return <ApprovalsPage search={Route.useSearch()} surface="swipe" />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals/swipe',
  component: ApprovalSwipeRouteComponent,
  validateSearch: validateApprovalsSearch,
});
