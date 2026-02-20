import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

interface ChainIntegrityBannerProps {
  status: 'verified' | 'broken' | 'pending';
}

const config: Record<
  ChainIntegrityBannerProps['status'],
  {
    icon: React.ElementType;
    title: string;
    description: string;
    variant: 'default' | 'destructive' | 'success';
  }
> = {
  verified: {
    icon: ShieldCheck,
    title: 'Chain integrity verified',
    description: 'All evidence entries pass SHA-256 hash verification.',
    variant: 'success',
  },
  broken: {
    icon: ShieldAlert,
    title: 'Chain integrity BROKEN',
    description: 'Evidence tampered -- hash chain verification failed.',
    variant: 'destructive',
  },
  pending: {
    icon: ShieldQuestion,
    title: 'Chain integrity pending verification',
    description: 'Verification is in progress.',
    variant: 'default',
  },
};

export function ChainIntegrityBanner({ status }: ChainIntegrityBannerProps) {
  const { icon: Icon, title, description, variant } = config[status];
  return (
    <Alert variant={variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
