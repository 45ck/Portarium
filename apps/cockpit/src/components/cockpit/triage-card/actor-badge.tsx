import { User, Bot, Workflow } from 'lucide-react';

function inferActorType(userId: string): { label: string; Icon: typeof User } {
  const lower = userId.toLowerCase();
  if (lower.startsWith('agent-') || lower.startsWith('bot-') || lower.includes('automation'))
    return { label: 'Agent', Icon: Bot };
  if (lower.startsWith('wf-') || lower.startsWith('workflow-') || lower.includes('orchestrat'))
    return { label: 'Workflow', Icon: Workflow };
  if (lower === 'system' || lower.startsWith('sys-')) return { label: 'System', Icon: Bot };
  return { label: 'User', Icon: User };
}

export function ActorBadge({ userId }: { userId: string }) {
  const { label, Icon } = inferActorType(userId);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted shrink-0">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </span>
      <span className="font-medium text-foreground">{userId}</span>
      <span className="text-muted-foreground">({label})</span>
    </span>
  );
}
