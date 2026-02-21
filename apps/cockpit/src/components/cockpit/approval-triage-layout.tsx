import type { ApprovalSummary } from '@portarium/cockpit-types';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { ApprovalListPanel } from '@/components/cockpit/approval-list-panel';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface ApprovalTriageLayoutProps {
  items: ApprovalSummary[];
  pendingCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}

export function ApprovalTriageLayout({
  items,
  pendingCount,
  selectedId,
  onSelect,
  children,
}: ApprovalTriageLayoutProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-3">
        <PageHeader
          title="Approvals"
          icon={<EntityIcon entityType="approval" size="md" decorative />}
        />
      </div>

      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <ApprovalListPanel
            items={items}
            pendingCount={pendingCount}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full overflow-y-auto p-4">{children}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
