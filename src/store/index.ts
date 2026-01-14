import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SemanticSchema, DataBundle, ViewMode, ExplorerState, AISettings, JournalEntry } from '@/types';
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
  journalEntries: JournalEntry[];
  preselectedSchemaId: string | null; // For pre-filling bundle creation
  _importInProgress?: boolean; // Internal flag to prevent truncation during import

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
  setPreselectedSchemaId: (id: string | null) => void;

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

  // Journal actions
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;

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
      journalEntries: [],
      preselectedSchemaId: null,

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
      setPreselectedSchemaId: (id) => set({ preselectedSchemaId: id }),

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

      // Journal actions
      addJournalEntry: (entry) =>
        set((state) => ({
          journalEntries: [...state.journalEntries, entry],
        })),

      updateJournalEntry: (id, updates) =>
        set((state) => ({
          journalEntries: state.journalEntries.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteJournalEntry: (id) =>
        set((state) => ({
          journalEntries: state.journalEntries.filter((e) => e.id !== id),
        })),

      // Import/Export
      exportConfig: () => {
        const state = get();
        return JSON.stringify(
          {
            version: '1.0',
            schemas: state.schemas,
            bundles: state.bundles, // Full data, no truncation
            relationshipTypeConfig: state.relationshipTypeConfig,
            aiSettings: {
              ...state.aiSettings,
              apiKey: '', // Strip API key for security
            },
            journalEntries: state.journalEntries,
          },
          null,
          2
        );
      },

      importConfig: (json) => {
        try {
          const config = JSON.parse(json);

          // Validate structure
          if (!config || typeof config !== 'object') {
            console.error('Invalid config: not an object');
            return;
          }

          // Set flag to prevent truncation during import
          set({ _importInProgress: true });

          // Import schemas
          if (Array.isArray(config.schemas)) {
            set({ schemas: config.schemas });
          }

          // Import bundles with full data
          if (Array.isArray(config.bundles)) {
            set({ bundles: config.bundles });
          }

          // Import relationships
          if (config.relationshipTypeConfig?.types) {
            set({ relationshipTypeConfig: config.relationshipTypeConfig });
          }

          // Import AI settings (preserve current apiKey if not in import)
          if (config.aiSettings) {
            const currentKey = get().aiSettings.apiKey;
            set({
              aiSettings: {
                ...config.aiSettings,
                apiKey: config.aiSettings.apiKey || currentKey,
              },
            });
          }

          // Import journal entries
          if (Array.isArray(config.journalEntries)) {
            set({ journalEntries: config.journalEntries });
          }

          // Clear flag after persistence completes
          setTimeout(() => set({ _importInProgress: false }), 100);
        } catch (e) {
          set({ _importInProgress: false });
          console.error('Failed to import config:', e);
        }
      },
    }),
    {
      name: 'data-explorer-storage',
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState) return persistedState;
        const state = persistedState as Partial<AppStore>;
        const storedSchemas = Array.isArray(state.schemas) ? state.schemas : [];
        const storedById = new Map(storedSchemas.map((schema) => [schema.id, schema]));
        const mergedSchemas = [
          ...defaultSchemas.map((schema) => storedById.get(schema.id) ?? schema),
          ...storedSchemas.filter((schema) => !schema.id.endsWith('-default')),
        ];
        return { ...state, schemas: mergedSchemas };
      },
      partialize: (state) => {
        // Don't truncate during import - preserve full data
        if (state._importInProgress) {
          return {
            schemas: state.schemas,
            bundles: state.bundles,
            relationshipTypeConfig: state.relationshipTypeConfig,
            aiSettings: state.aiSettings,
            journalEntries: state.journalEntries,
          };
        }

        // Normal auto-save truncation for localStorage (browser constraint)
        return {
          schemas: state.schemas,
          bundles: state.bundles.map((b) => ({
            ...b,
            source: {
              ...b.source,
              // Truncate for localStorage auto-persist (5MB limit)
              rawData: b.source.rawData.length > 5_000_000 ? '' : b.source.rawData,
              parsedData: b.source.parsedData.length > 10_000 ? [] : b.source.parsedData,
            },
          })),
          relationshipTypeConfig: state.relationshipTypeConfig,
          aiSettings: state.aiSettings,
          journalEntries: state.journalEntries,
        };
      },
    }
  )
);
