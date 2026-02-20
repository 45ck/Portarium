import type { Meta, StoryObj } from '@storybook/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle, AlertTriangle, Info, XCircle, Bell } from 'lucide-react'

const meta: Meta = {
  title: 'Primitives/Alert',
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj

export const AllVariants: Story = {
  render: () => (
    <div className="bg-background p-4 space-y-3 max-w-lg">
      <Alert>
        <Bell className="size-4" />
        <AlertTitle>Default</AlertTitle>
        <AlertDescription>Workflow RUN-2041 has been queued for execution.</AlertDescription>
      </Alert>
      <Alert variant="success">
        <CheckCircle className="size-4" />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Invoice reconciliation completed — 14 steps passed.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertTitle>Approval Required</AlertTitle>
        <AlertDescription>RUN-2041 is waiting for your approval before proceeding to step 8.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <XCircle className="size-4" />
        <AlertTitle>Run Failed</AlertTitle>
        <AlertDescription>Step 6 (Validate Invoice) returned an unhandled error. Check evidence chain.</AlertDescription>
      </Alert>
      <Alert variant="info">
        <Info className="size-4" />
        <AlertTitle>Chain Integrity Verified</AlertTitle>
        <AlertDescription>All 14 evidence entries verified. SHA-256 chain intact.</AlertDescription>
      </Alert>
    </div>
  ),
}
