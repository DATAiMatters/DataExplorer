import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SemanticSchema, DataBundle, ViewMode, ExplorerState } from '@/types';
import { defaultSchemas } from '@/data/schemas';

interface AppStore {
  // State
  schemas: SemanticSchema[];
  bundles: DataBundle[];
  viewMode: ViewMode;
  explorerState: ExplorerState;

  // Schema actions
  addSchema: (schema: SemanticSchema) => void;
  updateSchema: (id: string, updates: Partial<SemanticSchema>) => void;
  deleteSchema: (id: string) => void;
  resetSchemas: () => void;

  // Bundle actions
  addBundle: (bundle: DataBundle) => void;
  updateBundle: (id: string, updates: Partial<DataBundle>) => void;
  deleteBundle: (id: string) => void;

  // View actions
  setViewMode: (mode: ViewMode) => void;
  
  // Explorer actions
  setSelectedBundle: (id: string | null) => void;
  setZoomLevel: (level: number) => void;
  setFocusedNode: (nodeId: string | null) => void;
  pushBreadcrumb: (nodeId: string) => void;
  popBreadcrumb: () => void;
  resetBreadcrumb: () => void;

  // Import/Export
  exportConfig: () => string;
  importConfig: (json: string) => void;
}

const initialExplorerState: ExplorerState = {
  selectedBundleId: null,
  zoomLevel: 1,
  focusedNodeId: null,
  breadcrumb: [],
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      schemas: defaultSchemas,
      bundles: [],
      viewMode: 'bundles',
      explorerState: initialExplorerState,

      // Schema actions
      addSchema: (schema) =>
        set((state) => ({
          schemas: [...state.schemas, schema],
        })),

      updateSchema: (id, updates) =>
        set((state) => ({
          schemas: state.schemas.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      deleteSchema: (id) =>
        set((state) => ({
          schemas: state.schemas.filter((s) => s.id !== id),
        })),

      resetSchemas: () =>
        set({ schemas: defaultSchemas }),

      // Bundle actions
      addBundle: (bundle) =>
        set((state) => ({
          bundles: [...state.bundles, bundle],
        })),

      updateBundle: (id, updates) =>
        set((state) => ({
          bundles: state.bundles.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
          ),
        })),

      deleteBundle: (id) =>
        set((state) => ({
          bundles: state.bundles.filter((b) => b.id !== id),
          explorerState:
            state.explorerState.selectedBundleId === id
              ? initialExplorerState
              : state.explorerState,
        })),

      // View actions
      setViewMode: (mode) => set({ viewMode: mode }),

      // Explorer actions
      setSelectedBundle: (id) =>
        set((state) => ({
          explorerState: {
            ...state.explorerState,
            selectedBundleId: id,
            focusedNodeId: null,
            breadcrumb: [],
          },
        })),

      setZoomLevel: (level) =>
        set((state) => ({
          explorerState: { ...state.explorerState, zoomLevel: level },
        })),

      setFocusedNode: (nodeId) =>
        set((state) => ({
          explorerState: { ...state.explorerState, focusedNodeId: nodeId },
        })),

      pushBreadcrumb: (nodeId) =>
        set((state) => ({
          explorerState: {
            ...state.explorerState,
            breadcrumb: [...state.explorerState.breadcrumb, nodeId],
            focusedNodeId: nodeId,
          },
        })),

      popBreadcrumb: () =>
        set((state) => {
          const newBreadcrumb = state.explorerState.breadcrumb.slice(0, -1);
          return {
            explorerState: {
              ...state.explorerState,
              breadcrumb: newBreadcrumb,
              focusedNodeId: newBreadcrumb[newBreadcrumb.length - 1] || null,
            },
          };
        }),

      resetBreadcrumb: () =>
        set((state) => ({
          explorerState: {
            ...state.explorerState,
            breadcrumb: [],
            focusedNodeId: null,
          },
        })),

      // Import/Export
      exportConfig: () => {
        const state = get();
        return JSON.stringify(
          {
            schemas: state.schemas,
            bundles: state.bundles.map((b) => ({
              ...b,
              // Exclude raw data for smaller export
              source: {
                ...b.source,
                rawData: undefined,
                parsedData: undefined,
              },
            })),
          },
          null,
          2
        );
      },

      importConfig: (json) => {
        try {
          const config = JSON.parse(json);
          if (config.schemas) {
            set({ schemas: config.schemas });
          }
          // Note: bundles without data need to be re-uploaded
        } catch (e) {
          console.error('Failed to import config:', e);
        }
      },
    }),
    {
      name: 'data-explorer-storage',
      partialize: (state) => ({
        schemas: state.schemas,
        bundles: state.bundles.map((b) => ({
          ...b,
          source: {
            ...b.source,
            // Don't persist large raw data
            rawData: b.source.rawData.length > 100000 ? '' : b.source.rawData,
            parsedData: b.source.parsedData.length > 1000 ? [] : b.source.parsedData,
          },
        })),
      }),
    }
  )
);
