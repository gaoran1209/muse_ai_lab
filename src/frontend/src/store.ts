import { create } from 'zustand';
import type { CanvasItem, Viewport } from './types';

// ==================== 画布 Store ====================

interface CanvasStore {
  // 状态
  items: CanvasItem[];
  viewport: Viewport;
  selectedIds: string[];
  isPanning: boolean;

  // 操作
  addItem: (item: CanvasItem) => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  deleteItem: (id: string) => void;
  deleteSelected: () => void;
  clearAll: () => void;
  selectItem: (id: string) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  setViewport: (viewport: Partial<Viewport>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPanning: (isPanning: boolean) => void;
  togglePanMode: () => void;
}

const defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 };

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // 初始状态
  items: [],
  viewport: defaultViewport,
  selectedIds: [],
  isPanning: false,

  // 操作
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? ({ ...item, ...updates } as CanvasItem) : item
      ),
    })),

  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),

  deleteSelected: () =>
    set((state) => ({
      items: state.items.filter((item) => !state.selectedIds.includes(item.id)),
      selectedIds: [],
    })),

  clearAll: () => set({ items: [], selectedIds: [], viewport: defaultViewport }),

  selectItem: (id) => set({ selectedIds: [id] }),

  deselectAll: () => set({ selectedIds: [] }),

  isSelected: (id) => get().selectedIds.includes(id),

  setViewport: (viewport) =>
    set((state) => ({ viewport: { ...state.viewport, ...viewport } })),

  zoomIn: () =>
    set((state) => ({
      viewport: { ...state.viewport, zoom: Math.min(5, state.viewport.zoom + 0.1) },
    })),

  zoomOut: () =>
    set((state) => ({
      viewport: { ...state.viewport, zoom: Math.max(0.1, state.viewport.zoom - 0.1) },
    })),

  setPanning: (isPanning) => set({ isPanning }),

  togglePanMode: () => set((state) => ({ isPanning: !state.isPanning })),
}));
