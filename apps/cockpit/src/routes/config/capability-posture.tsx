import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import {
  CapabilityPostureMatrixPage,
  validateCapabilityPostureSearch,
} from '@/components/cockpit/capability-posture-matrix';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/capability-posture',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/config/policies' });
    }
  },
  component: CapabilityPostureMatrixPage,
  validateSearch: validateCapabilityPostureSearch,
});
