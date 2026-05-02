import { create } from 'zustand';
import { purgeCockpitTenantData } from '@/lib/cockpit-tenant-data';
import {
  DATASET_STORAGE_KEY,
  resolveCockpitRuntime,
  resolveStoredDataset,
  workspaceIdForDataset,
  type DatasetId,
} from '@/lib/cockpit-runtime';

const TRIAGE_VIEW_STORAGE_KEY = 'portarium-triage-view';

export type PersonaId = 'Operator' | 'Approver' | 'Auditor' | 'Admin';

export type TriageViewMode =
  | 'default'
  | 'traffic-signals'
  | 'briefing'
  | 'risk-radar'
  | 'blast-map'
  | 'diff-view'
  | 'action-replay'
  | 'evidence-chain'
  | 'story-timeline'
  | 'policy-precedent'
  | 'robotics-safety'
  | 'finance-impact'
  | 'compliance-checklist'
  | 'agent-overview';

interface UIStore {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  startRunOpen: boolean;
  intentPlannerOpen: boolean;
  activeWorkspaceId: string;
  activeDataset: DatasetId;
  activePersona: PersonaId;
  keyboardCheatsheetOpen: boolean;
  triageViewMode: TriageViewMode;
  setSidebarCollapsed: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setStartRunOpen: (v: boolean) => void;
  setIntentPlannerOpen: (v: boolean) => void;
  setActiveDataset: (id: DatasetId) => void;
  setActiveWorkspaceId: (id: string) => void;
  setActivePersona: (persona: PersonaId) => void;
  setKeyboardCheatsheetOpen: (v: boolean) => void;
  setTriageViewMode: (mode: TriageViewMode) => void;
}

const VALID_TRIAGE_MODES: TriageViewMode[] = [
  'default',
  'traffic-signals',
  'briefing',
  'risk-radar',
  'blast-map',
  'diff-view',
  'action-replay',
  'evidence-chain',
  'story-timeline',
  'policy-precedent',
  'robotics-safety',
  'finance-impact',
  'compliance-checklist',
  'agent-overview',
];

function readStoredTriageView(): TriageViewMode {
  const stored = localStorage.getItem(TRIAGE_VIEW_STORAGE_KEY);
  if (stored && VALID_TRIAGE_MODES.includes(stored as TriageViewMode)) {
    return stored as TriageViewMode;
  }
  return 'briefing';
}

function readStoredDataset(): DatasetId {
  return resolveStoredDataset(import.meta.env, localStorage);
}

const initialDataset = readStoredDataset();

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  startRunOpen: false,
  intentPlannerOpen: false,
  activeWorkspaceId: workspaceIdForDataset(initialDataset),
  activeDataset: initialDataset,
  activePersona: 'Operator',
  keyboardCheatsheetOpen: false,
  triageViewMode: readStoredTriageView(),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setStartRunOpen: (v) => set({ startRunOpen: v }),
  setIntentPlannerOpen: (v) => set({ intentPlannerOpen: v }),
  setActiveDataset: (id) => {
    if (!resolveCockpitRuntime().allowDemoControls) {
      localStorage.setItem(DATASET_STORAGE_KEY, 'live');
      set({ activeDataset: 'live', activeWorkspaceId: workspaceIdForDataset('live') });
      return;
    }
    localStorage.setItem(DATASET_STORAGE_KEY, id);
    window.location.reload();
  },
  setActiveWorkspaceId: (id) =>
    set((state) => {
      if (state.activeWorkspaceId !== id) {
        void purgeCockpitTenantData();
      }
      return { activeWorkspaceId: id };
    }),
  setActivePersona: (persona) => set({ activePersona: persona }),
  setKeyboardCheatsheetOpen: (v) => set({ keyboardCheatsheetOpen: v }),
  setTriageViewMode: (mode) => {
    localStorage.setItem(TRIAGE_VIEW_STORAGE_KEY, mode);
    set({ triageViewMode: mode });
  },
}));
