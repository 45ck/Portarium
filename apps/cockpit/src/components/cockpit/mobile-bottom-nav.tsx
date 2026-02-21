import { useState } from 'react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Inbox, CheckSquare, Play, LayoutDashboard, Menu } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { EntityIcon } from '@/components/domain/entity-icon';
import { useUIStore } from '@/stores/ui-store';
import { usePendingCount } from '@/hooks/use-pending-count';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  matchPath: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inbox', to: '/inbox', icon: <Inbox className="h-5 w-5" />, matchPath: '/inbox' },
  {
    label: 'Approvals',
    to: '/approvals',
    icon: <CheckSquare className="h-5 w-5" />,
    matchPath: '/approvals',
  },
  { label: 'Runs', to: '/runs', icon: <Play className="h-5 w-5" />, matchPath: '/runs' },
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    matchPath: '/dashboard',
  },
];

const MORE_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Inbox', to: '/inbox' },
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Work Items', to: '/work-items' },
    ],
  },
  {
    label: 'Work',
    items: [
      { label: 'Runs', to: '/runs' },
      { label: 'Workflows', to: '/workflows' },
      { label: 'Approvals', to: '/approvals' },
      { label: 'Evidence', to: '/evidence' },
    ],
  },
  {
    label: 'Workforce',
    items: [
      { label: 'Members', to: '/workforce' },
      { label: 'Queues', to: '/workforce/queues' },
    ],
  },
  {
    label: 'Config',
    items: [
      { label: 'Agents', to: '/config/agents' },
      { label: 'Adapters', to: '/config/adapters' },
      { label: 'Credentials', to: '/config/credentials' },
      { label: 'Settings', to: '/config/settings' },
    ],
  },
  {
    label: 'Explore',
    items: [
      { label: 'Objects', to: '/explore/objects' },
      { label: 'Events', to: '/explore/events' },
      { label: 'Observability', to: '/explore/observability' },
      { label: 'Governance', to: '/explore/governance' },
    ],
  },
];

// Wrapper to avoid TS errors with unregistered routes
const TypedLink = Link as React.ComponentType<{
  to: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}>;

export function MobileBottomNav() {
  const { activeWorkspaceId } = useUIStore();
  const pendingCount = usePendingCount(activeWorkspaceId);
  const matchRoute = useMatchRoute();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeIndex = NAV_ITEMS.findIndex((item) =>
    matchRoute({ to: item.matchPath, fuzzy: true }),
  );

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14">
          {NAV_ITEMS.map((item, i) => {
            const isActive = i === activeIndex;
            return (
              <TypedLink
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-pill"
                    className="absolute inset-x-3 top-0 h-0.5 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  className={cn(
                    'transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {item.icon}
                  {item.label === 'Inbox' && pendingCount > 0 && (
                    <span className="absolute top-1.5 right-1/2 translate-x-4 -translate-y-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center leading-none">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </motion.div>
                <span
                  className={cn(
                    'text-[10px] leading-none',
                    isActive ? 'text-primary font-medium' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              </TypedLink>
            );
          })}

          {/* More button */}
          <button
            type="button"
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            onClick={() => setMoreOpen(true)}
          >
            <motion.div whileTap={{ scale: 0.85 }} className="text-muted-foreground">
              <Menu className="h-5 w-5" />
            </motion.div>
            <span className="text-[10px] text-muted-foreground leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Navigation</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 space-y-4">
            {MORE_SECTIONS.map((section) => (
              <div key={section.label}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <TypedLink
                      key={item.to}
                      to={item.to}
                      className="block px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
                      onClick={() => setMoreOpen(false)}
                    >
                      {item.label}
                    </TypedLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
