import React from 'react';
import type { WorkforceMemberSummary } from '@portarium/cockpit-types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WorkforceMemberCardProps {
  member: WorkforceMemberSummary;
  onClick?: () => void;
}

const availabilityColors: Record<string, string> = {
  available: 'bg-success',
  busy: 'bg-warning',
  offline: 'bg-muted-foreground',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function WorkforceMemberCard({ member, onClick }: WorkforceMemberCardProps) {
  return (
    <Card
      className={cn('shadow-none', onClick && 'cursor-pointer hover:bg-muted/50')}
      onClick={onClick}
      {...(onClick
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
    >
      <CardContent className="flex items-center gap-3 py-3">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[11px]">{initials(member.displayName)}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
              availabilityColors[member.availabilityStatus] ?? 'bg-muted-foreground',
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{member.displayName}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {member.capabilities.map((cap) => (
              <Badge key={cap} variant="secondary" className="text-[9px] px-1 py-0">
                {cap.split('.').pop()}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
