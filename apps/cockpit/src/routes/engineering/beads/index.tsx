import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from '../../__root';
import { EngineeringShell } from '../engineering-shell';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/beads',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/dashboard' as string });
    }
  },
  component: () => <EngineeringShell />,
});
