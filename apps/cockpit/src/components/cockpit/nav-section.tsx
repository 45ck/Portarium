interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSectionProps {
  label: string;
  items: NavItem[];
}

export function NavSection({ label, items }: NavSectionProps) {
  return (
    <div className="space-y-0.5">
      <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      {items.map((item) => (
        <a
          key={item.to}
          href={item.to}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="h-4 min-w-4 px-1 text-[11px] rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              {item.badge}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

export type { NavItem, NavSectionProps };
