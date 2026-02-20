import { create } from 'zustand'

interface UIStore {
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
  activeWorkspaceId: string
  setSidebarCollapsed: (v: boolean) => void
  setCommandPaletteOpen: (v: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeWorkspaceId: 'ws-demo',
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
}))
