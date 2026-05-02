import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import {
  CapabilityPostureMatrixPage,
  validateCapabilityPostureSearch,
} from '@/components/cockpit/capability-posture-matrix';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/capability-posture',
  component: CapabilityPostureMatrixPage,
  validateSearch: validateCapabilityPostureSearch,
});
