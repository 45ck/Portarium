import { useState } from 'react';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkforceMemberSummary } from '@portarium/cockpit-types';

interface OwnerPickerProps {
  members: WorkforceMemberSummary[];
  currentMemberId?: string;
  onSelect: (memberId: string) => void;
  label?: string;
}

export function OwnerPicker({
  members,
  currentMemberId,
  onSelect,
  label = 'Assign owner',
}: OwnerPickerProps) {
  const [open, setOpen] = useState(false);
  const current = members.find((m) => m.workforceMemberId === currentMemberId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs justify-between gap-1">
          {current ? (
            <span className="flex items-center gap-1.5">
              <User className="h-3 w-3" />
              {current.displayName}
            </span>
          ) : (
            <span className="text-muted-foreground">{label}</span>
          )}
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search members..." className="h-8 text-xs" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.workforceMemberId}
                  value={member.displayName}
                  onSelect={() => {
                    onSelect(member.workforceMemberId);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="truncate">{member.displayName}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] ml-auto shrink-0',
                        member.availabilityStatus === 'available' && 'border-success text-success',
                        member.availabilityStatus === 'busy' && 'border-warning text-warning',
                        member.availabilityStatus === 'offline' &&
                          'border-muted-foreground text-muted-foreground',
                      )}
                    >
                      {member.availabilityStatus}
                    </Badge>
                  </div>
                  <Check
                    className={cn(
                      'h-3 w-3 shrink-0',
                      currentMemberId === member.workforceMemberId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
