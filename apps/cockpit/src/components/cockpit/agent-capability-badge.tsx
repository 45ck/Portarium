import type { AgentCapability } from '@portarium/cockpit-types'
import { Badge } from '@/components/ui/badge'
import { Eye, Pencil, Tag, Sparkles, Search, Code2, Bell } from 'lucide-react'

interface AgentCapabilityBadgeProps {
  capability: AgentCapability
}

const config: Record<AgentCapability, { icon: React.ElementType; label: string }> = {
  'read:external':  { icon: Eye,      label: 'Read' },
  'write:external': { icon: Pencil,   label: 'Write' },
  'classify':       { icon: Tag,      label: 'Classify' },
  'generate':       { icon: Sparkles, label: 'Generate' },
  'analyze':        { icon: Search,   label: 'Analyze' },
  'execute-code':   { icon: Code2,    label: 'Execute' },
  'notify':         { icon: Bell,     label: 'Notify' },
}

export function AgentCapabilityBadge({ capability }: AgentCapabilityBadgeProps) {
  const { icon: Icon, label } = config[capability]
  return (
    <Badge variant="secondary" className="text-[10px]">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
