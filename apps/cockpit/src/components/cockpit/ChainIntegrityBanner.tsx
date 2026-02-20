import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle, Loader2, ShieldAlert } from 'lucide-react'

const config = {
  verified: {
    variant: 'ok' as const,
    title: 'Chain Integrity Verified',
    description: 'All evidence entries have been verified and the hash chain is intact.',
    icon: CheckCircle,
    role: undefined,
  },
  failed: {
    variant: 'danger' as const,
    title: 'Chain Integrity Failed',
    description: 'Possible tampering detected \u2014 one or more hash links are broken.',
    icon: ShieldAlert,
    role: 'alert' as const,
  },
  pending: {
    variant: 'default' as const,
    title: 'Verifying chain integrity\u2026',
    description: 'Checking evidence hash chain. This may take a moment.',
    icon: Loader2,
    role: undefined,
  },
}

export function ChainIntegrityBanner({
  status,
}: {
  status: 'verified' | 'failed' | 'pending'
}) {
  const { variant, title, description, icon: Icon, role } = config[status]

  return (
    <Alert variant={variant} role={role}>
      <div className="flex items-start gap-2">
        <Icon
          className={`h-5 w-5 flex-shrink-0 ${status === 'pending' ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </div>
      </div>
    </Alert>
  )
}
