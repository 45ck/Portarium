import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../../../__root';
import { EngineeringShell } from '../../engineering-shell';

function EngineeringBeadDetailRoute() {
  const { beadId } = Route.useParams();
  return <EngineeringShell selectedBeadId={beadId} />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/beads/$beadId',
  component: EngineeringBeadDetailRoute,
});
