import { create } from 'zustand'
import type { DatasetId } from '@/mocks/fixtures/index'

const DATASET_STORAGE_KEY = 'portarium-dataset'

const DATASET_WORKSPACE_MAP: Record<DatasetId, string> = {
  'demo': 'ws-demo',
  'meridian-demo': 'ws-meridian',
  'meridian-full': 'ws-meridian',
}

export type PersonaId = 'Operator' | 'Approver' | 'Auditor' | 'Admin'

interface UIStore {
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  startRunOpen: boolean
  activeWorkspaceId: string
  activeDataset: DatasetId
  activePersona: PersonaId
  keyboardCheatsheetOpen: boolean
  setSidebarCollapsed: (v: boolean) => void
  setCommandPaletteOpen: (v: boolean) => void
  setStartRunOpen: (v: boolean) => void
  setActiveDataset: (id: DatasetId) => void
  setActiveWorkspaceId: (id: string) => void
  setActivePersona: (persona: PersonaId) => void
  setKeyboardCheatsheetOpen: (v: boolean) => void
}

function readStoredDataset(): DatasetId {
  const stored = localStorage.getItem(DATASET_STORAGE_KEY)
  if (stored === 'demo' || stored === 'meridian-demo' || stored === 'meridian-full') {
    return stored
  }
  return 'meridian-demo'
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  startRunOpen: false,
  activeWorkspaceId: DATASET_WORKSPACE_MAP[readStoredDataset()],
  activeDataset: readStoredDataset(),
  activePersona: 'Operator',
  keyboardCheatsheetOpen: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setStartRunOpen: (v) => set({ startRunOpen: v }),
  setActiveDataset: (id) => {
    localStorage.setItem(DATASET_STORAGE_KEY, id)
    window.location.reload()
  },
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setActivePersona: (persona) => set({ activePersona: persona }),
  setKeyboardCheatsheetOpen: (v) => set({ keyboardCheatsheetOpen: v }),
}))
