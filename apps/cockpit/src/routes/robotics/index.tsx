import { createRoute, Link } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { PageHeader } from '@/components/cockpit/page-header'
import { EntityIcon } from '@/components/domain/entity-icon'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, MapPin, Target, ShieldCheck, Radio } from 'lucide-react'

const ROBOTICS_SECTIONS = [
  {
    title: 'Robots',
    description: 'Fleet status, battery levels, and live heartbeats for all registered robots.',
    href: '/robotics/robots',
    icon: <Bot className="h-5 w-5" />,
  },
  {
    title: 'Operations Map',
    description: 'Real-time geofenced map of robot locations across all warehouse sites.',
    href: '/robotics/map',
    icon: <MapPin className="h-5 w-5" />,
  },
  {
    title: 'Missions',
    description: 'Dispatched mission queue with status tracking and execution-tier breakdown.',
    href: '/robotics/missions',
    icon: <Target className="h-5 w-5" />,
  },
  {
    title: 'Safety',
    description: 'Speed constraints, approval thresholds, and E-Stop audit log.',
    href: '/robotics/safety',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: 'Gateways',
    description: 'OpenClaw gateway connectivity and SPIFFE/X.509 attestation status.',
    href: '/robotics/gateways',
    icon: <Radio className="h-5 w-5" />,
  },
]

function RoboticsIndexPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Robotics"
        description="Fleet management, mission control, and safety governance"
        icon={<EntityIcon entityType="robot" size="md" decorative />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROBOTICS_SECTIONS.map((section) => (
          <Link key={section.href} to={section.href as string}>
            <Card className="shadow-none hover:bg-muted/40 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{section.icon}</span>
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{section.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics',
  component: RoboticsIndexPage,
})
