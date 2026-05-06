import { create } from 'zustand';
import { purgeCockpitTenantData } from '@/lib/cockpit-tenant-data';
import {
  DATASET_STORAGE_KEY,
  DEFAULT_DEMO_DATASET_ID,
  resolveCockpitRuntime,
  resolveStoredDataset,
  workspaceIdForDataset,
  type DatasetId,
} from '@/lib/cockpit-runtime';
import { isTriageModeSelectableByDefault } from '@/lib/triage-runtime';

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
  if (
    stored &&
    VALID_TRIAGE_MODES.includes(stored as TriageViewMode) &&
    isTriageModeSelectableByDefault(stored as TriageViewMode)
  ) {
    return stored as TriageViewMode;
  }
  return 'default';
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
    const runtime = resolveCockpitRuntime();
    if (!runtime.allowDemoControls) {
      localStorage.setItem(DATASET_STORAGE_KEY, 'live');
      set({ activeDataset: 'live', activeWorkspaceId: workspaceIdForDataset('live') });
      return;
    }
    const nextDataset = id === 'platform-showcase' ? id : DEFAULT_DEMO_DATASET_ID;
    localStorage.setItem(DATASET_STORAGE_KEY, nextDataset);
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
    if (!isTriageModeSelectableByDefault(mode)) {
      localStorage.setItem(TRIAGE_VIEW_STORAGE_KEY, 'default');
      set({ triageViewMode: 'default' });
      return;
    }
    localStorage.setItem(TRIAGE_VIEW_STORAGE_KEY, mode);
    set({ triageViewMode: mode });
  },
}));
