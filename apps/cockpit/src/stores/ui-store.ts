import { create } from 'zustand';
import type { DatasetId } from '@/mocks/fixtures/index';

const DATASET_STORAGE_KEY = 'portarium-dataset';
const TRIAGE_VIEW_STORAGE_KEY = 'portarium-triage-view';

const DATASET_WORKSPACE_MAP: Record<DatasetId, string> = {
  demo: 'ws-demo',
  'meridian-demo': 'ws-meridian',
  'meridian-full': 'ws-meridian',
};

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
  | 'story-timeline';

interface UIStore {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  startRunOpen: boolean;
  activeWorkspaceId: string;
  activeDataset: DatasetId;
  activePersona: PersonaId;
  keyboardCheatsheetOpen: boolean;
  triageViewMode: TriageViewMode;
  setSidebarCollapsed: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setStartRunOpen: (v: boolean) => void;
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
];

function readStoredTriageView(): TriageViewMode {
  const stored = localStorage.getItem(TRIAGE_VIEW_STORAGE_KEY);
  if (stored && VALID_TRIAGE_MODES.includes(stored as TriageViewMode)) {
    return stored as TriageViewMode;
  }
  return 'default';
}

function readStoredDataset(): DatasetId {
  const stored = localStorage.getItem(DATASET_STORAGE_KEY);
  if (stored === 'demo' || stored === 'meridian-demo' || stored === 'meridian-full') {
    return stored;
  }
  return 'meridian-demo';
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  startRunOpen: false,
  activeWorkspaceId: DATASET_WORKSPACE_MAP[readStoredDataset()],
  activeDataset: readStoredDataset(),
  activePersona: 'Operator',
  keyboardCheatsheetOpen: false,
  triageViewMode: readStoredTriageView(),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setStartRunOpen: (v) => set({ startRunOpen: v }),
  setActiveDataset: (id) => {
    localStorage.setItem(DATASET_STORAGE_KEY, id);
    window.location.reload();
  },
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setActivePersona: (persona) => set({ activePersona: persona }),
  setKeyboardCheatsheetOpen: (v) => set({ keyboardCheatsheetOpen: v }),
  setTriageViewMode: (mode) => {
    localStorage.setItem(TRIAGE_VIEW_STORAGE_KEY, mode);
    set({ triageViewMode: mode });
  },
}));
