import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface ApprovalListPanelProps {
  items: ApprovalSummary[];
  pendingCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Denied', label: 'Denied' },
  { value: 'RequestChanges', label: 'Changes requested' },
];

export function ApprovalListPanel({
  items,
  pendingCount,
  selectedId,
  onSelect,
}: ApprovalListPanelProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    let result = items;
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) => a.prompt.toLowerCase().includes(q) || a.approvalId.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, statusFilter, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="shrink-0 border-b border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Approvals</h2>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search approvals…"
            className="h-8 text-xs pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-full text-xs h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No approvals match your filters.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence>
              {filtered.map((a) => {
                const isActive = a.approvalId === selectedId;
                const isOverdue = Boolean(a.dueAtIso && new Date(a.dueAtIso) < new Date());
                return (
                  <motion.li
                    key={a.approvalId}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2.5 transition-colors hover:bg-accent/50',
                        isActive && 'bg-accent border-l-2 border-l-primary',
                      )}
                      onClick={() => onSelect(a.approvalId)}
                    >
                      <p className="text-xs font-medium truncate leading-tight">{a.prompt}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <ApprovalStatusBadge status={a.status} />
                        {isOverdue && a.status === 'Pending' && (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1">
                            Overdue
                          </Badge>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(a.requestedAtIso), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
