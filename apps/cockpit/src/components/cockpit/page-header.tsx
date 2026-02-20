import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumb?: { label: string; to?: string }[];
  icon?: React.ReactNode;
}

export function PageHeader({ title, description, action, breadcrumb, icon }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {breadcrumb && breadcrumb.length > 0 && (
        <>
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumb.map((item, i) => (
                <BreadcrumbItem key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  {i === breadcrumb.length - 1 ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : item.to ? (
                    <BreadcrumbLink href={item.to}>{item.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <Separator />
        </>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {icon && <span className="inline-flex shrink-0">{icon}</span>}
            <span>{title}</span>
          </h1>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
