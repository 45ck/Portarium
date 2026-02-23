export type TriageAction = 'Approved' | 'Denied' | 'RequestChanges' | 'Skip';

export interface DragValidation {
  canApprove: boolean;
  canDeny: boolean;
  approveBlockReason: string | undefined;
  denyBlockReason: string | undefined;
  currentRationale: string;
}
