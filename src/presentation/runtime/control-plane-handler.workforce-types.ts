import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';

export type HandlerArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

export type HandlerArgsWithMember = HandlerArgs &
  Readonly<{
    workforceMemberId: string;
  }>;

export type HandlerArgsWithHumanTask = HandlerArgs &
  Readonly<{
    humanTaskId: string;
  }>;
