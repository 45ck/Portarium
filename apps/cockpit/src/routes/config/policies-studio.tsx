import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { PolicyStudioPage } from '@/components/cockpit/policy-studio';
import { validatePolicyStudioSearch } from '@/lib/policy-studio-search';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/policies/studio',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/config/policies' });
    }
  },
  component: PolicyStudioPage,
  validateSearch: validatePolicyStudioSearch,
});
