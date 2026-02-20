import { Link } from '@tanstack/react-router';
import {
  Bot,
  Brain,
  FileCheck2,
  Plug,
  Route,
  ShieldCheck,
  Network,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface RelatedEntity {
  type:
    | 'run'
    | 'approval'
    | 'workitem'
    | 'agent'
    | 'robot'
    | 'workforce'
    | 'workflow'
    | 'evidence'
    | 'adapter';
  id: string;
  label: string;
  href?: string;
  badge?: string;
  sublabel?: string;
}

export interface RelatedEntitiesProps {
  entities: RelatedEntity[];
  title?: string;
}

const ENTITY_ICON: Record<RelatedEntity['type'], typeof Bot> = {
  run: Route,
  approval: ShieldCheck,
  workitem: FileCheck2,
  agent: Brain,
  robot: Bot,
  workforce: User,
  workflow: Network,
  evidence: FileCheck2,
  adapter: Plug,
};

const ENTITY_LABEL: Record<RelatedEntity['type'], string> = {
  run: 'Runs',
  approval: 'Approvals',
  workitem: 'Work Items',
  agent: 'Agents',
  robot: 'Robots',
  workforce: 'Workforce',
  workflow: 'Workflows',
  evidence: 'Evidence',
  adapter: 'Adapters',
};

export function RelatedEntities({ entities, title = 'Connected to' }: RelatedEntitiesProps) {
  if (entities.length === 0) return null;

  const grouped = new Map<RelatedEntity['type'], RelatedEntity[]>();
  for (const entity of entities) {
    const list = grouped.get(entity.type) ?? [];
    list.push(entity);
    grouped.set(entity.type, list);
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...grouped.entries()].map(([type, items]) => {
          const Icon = ENTITY_ICON[type];
          return (
            <div key={type} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span>{ENTITY_LABEL[type]}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((entity) => {
                  const content = (
                    <>
                      <span>{entity.label}</span>
                      {entity.sublabel && (
                        <span className="text-muted-foreground ml-1">{entity.sublabel}</span>
                      )}
                      {entity.badge && (
                        <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                          {entity.badge}
                        </Badge>
                      )}
                    </>
                  );

                  if (entity.href) {
                    return (
                      <Link
                        key={entity.id}
                        to={entity.href}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-muted/50 transition-colors"
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <span
                      key={entity.id}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs bg-muted/30"
                    >
                      {content}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
