import { useState } from 'react'
import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { HumanTaskStatusBadge } from '@/components/cockpit/human-task-status-badge'
import { OwnerPicker } from '@/components/cockpit/owner-picker'
import type { HumanTaskSummary, WorkforceMemberSummary } from '@portarium/cockpit-types'
import { ClipboardList, User, ExternalLink, AlertTriangle } from 'lucide-react'

interface HumanTaskDrawerProps {
  task: HumanTaskSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  workforceMembers: WorkforceMemberSummary[]
  onAssign: (taskId: string, memberId: string) => void
  onComplete: (taskId: string, note?: string) => void
  onEscalate: (taskId: string, reason?: string) => void
}

export function HumanTaskDrawer({
  task,
  open,
  onOpenChange,
  workforceMembers,
  onAssign,
  onComplete,
  onEscalate,
}: HumanTaskDrawerProps) {
  const [showEscalateForm, setShowEscalateForm] = useState(false)
  const [escalateReason, setEscalateReason] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const [showCompleteForm, setShowCompleteForm] = useState(false)

  if (!task) return null

  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date()
  const assignee = workforceMembers.find((m) => m.workforceMemberId === task.assigneeId)
  const canComplete = task.status === 'assigned' || task.status === 'in-progress'
  const canEscalate = task.status !== 'completed' && task.status !== 'escalated'
  const canAssign = task.status !== 'completed'

  const taskId = task.humanTaskId

  function handleComplete() {
    onComplete(taskId, completionNote || undefined)
    setCompletionNote('')
    setShowCompleteForm(false)
    onOpenChange(false)
  }

  function handleEscalate() {
    onEscalate(taskId, escalateReason || undefined)
    setEscalateReason('')
    setShowEscalateForm(false)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[450px] sm:max-w-[450px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <SheetTitle className="text-sm">Human Task</SheetTitle>
          </div>
          <SheetDescription className="sr-only">Human task detail view</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {/* Status + ID */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">{task.humanTaskId}</span>
            <HumanTaskStatusBadge status={task.status} />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Description</p>
            <p className="text-sm">{task.description}</p>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Assignee</p>
            {assignee ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-sm">{assignee.displayName}</span>
                <Badge variant="outline" className="text-[10px]">
                  {assignee.availabilityStatus}
                </Badge>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">Unassigned</span>
            )}
            {canAssign && (
              <OwnerPicker
                members={workforceMembers}
                currentMemberId={task.assigneeId}
                onSelect={(memberId) => onAssign(task.humanTaskId, memberId)}
                label="Assign"
              />
            )}
          </div>

          {/* Required Capabilities */}
          {task.requiredCapabilities.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Required Capabilities</p>
              <div className="flex flex-wrap gap-1">
                {task.requiredCapabilities.map((cap) => (
                  <Badge key={cap} variant="secondary" className="text-[10px]">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Due Date */}
          {task.dueAt && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Due Date</p>
              <div className="flex items-center gap-1.5">
                {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                  {format(new Date(task.dueAt), 'MMM d, yyyy HH:mm')}
                  {isOverdue ? ' — overdue' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Linked Run */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Linked Run</p>
            <Link
              to={'/runs/$runId' as string}
              params={{ runId: task.runId }}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              onClick={() => onOpenChange(false)}
            >
              {task.runId}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Linked Work Item */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Linked Work Item</p>
            <Link
              to={'/work-items/$workItemId' as string}
              params={{ workItemId: task.workItemId }}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              onClick={() => onOpenChange(false)}
            >
              {task.workItemId}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Evidence Anchor */}
          {task.evidenceAnchorId && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Evidence Anchor</p>
              <span className="text-sm font-mono">{task.evidenceAnchorId}</span>
            </div>
          )}

          {/* Complete form */}
          {showCompleteForm && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs font-medium">Completion Note (optional)</p>
              <Textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Add a note..."
                className="text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleComplete}>
                  Confirm Complete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCompleteForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Escalate form */}
          {showEscalateForm && (
            <div className="space-y-2 rounded-md border border-destructive/30 p-3">
              <p className="text-xs font-medium text-destructive">Escalation Reason</p>
              <Textarea
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Reason for escalation..."
                className="text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleEscalate}>
                  Confirm Escalate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowEscalateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t">
          <div className="flex gap-2 w-full">
            {canComplete && !showCompleteForm && !showEscalateForm && (
              <Button size="sm" onClick={() => setShowCompleteForm(true)}>
                Complete
              </Button>
            )}
            {canEscalate && !showEscalateForm && !showCompleteForm && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowEscalateForm(true)}
              >
                Escalate
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
