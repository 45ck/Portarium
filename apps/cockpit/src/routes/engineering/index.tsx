import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering',
  beforeLoad: () => {
    throw redirect({
      to: shouldShowInternalCockpitSurfaces()
        ? ('/engineering/beads' as string)
        : ('/dashboard' as string),
    });
  },
});
