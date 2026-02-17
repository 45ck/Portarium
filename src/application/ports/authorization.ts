import type { AppAction } from '../common/actions.js';
import type { AppContext } from '../common/context.js';

export interface AuthorizationPort {
  isAllowed(ctx: AppContext, action: AppAction): Promise<boolean>;
}
