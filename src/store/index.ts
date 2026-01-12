import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SemanticSchema, DataBundle, ViewMode, ExplorerState, AISettings } from '@/types';
import { defaultSchemas } from '@/data/schemas';
import {
  defaultRelationshipTypeConfig,
  type RelationshipTypeConfig,
  type RelationshipType,
} from '@/config/relationshipTypes';

interface AppStore {
  // State
  schemas: SemanticSchema[];
  bundles: DataBundle[];
  viewMode: ViewMode;
  explorerState: ExplorerState;
  relationshipTypeConfig: RelationshipTypeConfig;
  aiSettings: AISettings;

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

  // Relationship type actions
  addRelationshipType: (type: RelationshipType) => void;
  updateRelationshipType: (name: string, updates: Partial<RelationshipType>) => void;
  deleteRelationshipType: (name: string) => void;
  resetRelationshipTypes: () => void;

  // AI settings actions
  setAISettings: (settings: Partial<AISettings>) => void;

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
      relationshipTypeConfig: defaultRelationshipTypeConfig,
      aiSettings: {
        enabled: false,
        provider: 'openai-compatible',
        endpoint: '',
        apiKey: '',
        model: '',
        maxTokens: 1000,
      },

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

      // Relationship type actions
      addRelationshipType: (type) =>
        set((state) => ({
          relationshipTypeConfig: {
            ...state.relationshipTypeConfig,
            types: [...state.relationshipTypeConfig.types, type],
          },
        })),

      updateRelationshipType: (name, updates) =>
        set((state) => ({
          relationshipTypeConfig: {
            ...state.relationshipTypeConfig,
            types: state.relationshipTypeConfig.types.map((t) =>
              t.name === name ? { ...t, ...updates } : t
            ),
          },
        })),

      deleteRelationshipType: (name) =>
        set((state) => ({
          relationshipTypeConfig: {
            ...state.relationshipTypeConfig,
            types: state.relationshipTypeConfig.types.filter((t) => t.name !== name),
          },
        })),

      resetRelationshipTypes: () =>
        set({ relationshipTypeConfig: defaultRelationshipTypeConfig }),

      // AI settings actions
      setAISettings: (settings) =>
        set((state) => ({
          aiSettings: { ...state.aiSettings, ...settings },
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
        relationshipTypeConfig: state.relationshipTypeConfig,
        aiSettings: state.aiSettings,
      }),
    }
  )
);
