import { createContext, useContext } from 'react';
import {
  PORTARIUM_COCKPIT_SHELL_PROFILE,
  type CockpitShellProfile,
} from '@/lib/shell/navigation';

export const ActiveCockpitShellProfileContext = createContext<CockpitShellProfile>(
  PORTARIUM_COCKPIT_SHELL_PROFILE,
);

export function useActiveCockpitShellProfile(): CockpitShellProfile {
  return useContext(ActiveCockpitShellProfileContext);
}
