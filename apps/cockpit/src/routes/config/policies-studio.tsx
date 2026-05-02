import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { PolicyStudioPage } from '@/components/cockpit/policy-studio';
import { validatePolicyStudioSearch } from '@/lib/policy-studio-search';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/policies/studio',
  component: PolicyStudioPage,
  validateSearch: validatePolicyStudioSearch,
});
