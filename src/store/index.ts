import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SemanticSchema,
  DataBundle,
  ViewMode,
  ExplorerState,
  AISettings,
  JournalEntry,
  JoinDefinition,
  VirtualBundle,
  JoinSuggestion,
} from '@/types';
import { defaultSchemas } from '@/data/schemas';
import {
  defaultRelationshipTypeConfig,
  type RelationshipTypeConfig,
  type RelationshipType,
} from '@/config/relationshipTypes';
import { LineageGraph } from '@/lib/lineageGraph';

interface AppStore {
  // State
  schemas: SemanticSchema[];
  bundles: DataBundle[];
  joins: JoinDefinition[];
  virtualBundles: VirtualBundle[];
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

  // Join actions
  addJoin: (join: JoinDefinition) => void;
  updateJoin: (id: string, updates: Partial<JoinDefinition>) => void;
  deleteJoin: (id: string) => void;

  // Virtual Bundle actions
  addVirtualBundle: (vBundle: VirtualBundle) => void;
  updateVirtualBundle: (id: string, updates: Partial<VirtualBundle>) => void;
  deleteVirtualBundle: (id: string) => void;

  // Lineage actions (computed from joins and bundles)
  getLineageGraph: () => LineageGraph;
  getUpstreamBundles: (bundleId: string) => DataBundle[];
  getDownstreamBundles: (bundleId: string) => (DataBundle | VirtualBundle)[];
  executeVirtualBundle: (virtualBundleId: string) => {
    data: Record<string, unknown>[];
    leftColumns: string[];
    rightColumns: string[];
    stats: {
      leftRows: number;
      rightRows: number;
      resultRows: number;
      matchedLeftRows: number;
      matchedRightRows: number;
    };
  };

  // AI-powered features (future Cognee integration)
  suggestJoins: () => Promise<JoinSuggestion[]>;

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
      joins: [],
      virtualBundles: [],
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

      // Join actions
      addJoin: (join) =>
        set((state) => ({
          joins: [...state.joins, join],
        })),

      updateJoin: (id, updates) =>
        set((state) => ({
          joins: state.joins.map((j) =>
            j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j
          ),
        })),

      deleteJoin: (id) =>
        set((state) => ({
          joins: state.joins.filter((j) => j.id !== id),
          // Also remove any virtual bundles that depend on this join
          virtualBundles: state.virtualBundles.filter(
            (vb) => !vb.sourceJoinIds.includes(id)
          ),
        })),

      // Virtual Bundle actions
      addVirtualBundle: (vBundle) =>
        set((state) => ({
          virtualBundles: [...state.virtualBundles, vBundle],
        })),

      updateVirtualBundle: (id, updates) =>
        set((state) => ({
          virtualBundles: state.virtualBundles.map((vb) =>
            vb.id === id ? { ...vb, ...updates, updatedAt: new Date().toISOString() } : vb
          ),
        })),

      deleteVirtualBundle: (id) =>
        set((state) => ({
          virtualBundles: state.virtualBundles.filter((vb) => vb.id !== id),
        })),

      // Lineage actions
      getLineageGraph: () => {
        const state = get();
        return LineageGraph.build(
          state.bundles,
          state.joins,
          state.virtualBundles,
          state.schemas
        );
      },

      getUpstreamBundles: (bundleId) => {
        const lineage = get().getLineageGraph();
        const upstreamNodes = lineage.getUpstreamBundles(bundleId);
        const state = get();
        return upstreamNodes
          .map((node) => state.bundles.find((b) => b.id === node.bundleId))
          .filter((b): b is DataBundle => b !== undefined);
      },

      getDownstreamBundles: (bundleId) => {
        const lineage = get().getLineageGraph();
        const downstreamNodes = lineage.getDownstreamBundles(bundleId);
        const state = get();
        return downstreamNodes
          .map((node) => {
            const bundle = state.bundles.find((b) => b.id === node.bundleId);
            if (bundle) return bundle;
            return state.virtualBundles.find((vb) => vb.id === node.bundleId);
          })
          .filter((b): b is DataBundle | VirtualBundle => b !== undefined);
      },

      // Execute a join and return the result data
      executeVirtualBundle: (virtualBundleId) => {
        const state = get();
        const vBundle = state.virtualBundles.find((vb) => vb.id === virtualBundleId);

        if (!vBundle) {
          throw new Error(`Virtual bundle ${virtualBundleId} not found`);
        }

        if (vBundle.type !== 'join') {
          throw new Error(`Virtual bundle type "${vBundle.type}" not yet supported`);
        }

        if (vBundle.sourceJoinIds.length === 0) {
          throw new Error('Virtual bundle has no source joins');
        }

        // For now, execute the first join
        // TODO: Support multiple chained joins
        const joinId = vBundle.sourceJoinIds[0];
        const join = state.joins.find((j) => j.id === joinId);

        if (!join) {
          throw new Error(`Join ${joinId} not found`);
        }

        const leftBundle = state.bundles.find((b) => b.id === join.leftBundleId);
        const rightBundle = state.bundles.find((b) => b.id === join.rightBundleId);

        if (!leftBundle || !rightBundle) {
          throw new Error('Source bundles not found');
        }

        // Import join execution utility
        const { executeJoin } = require('@/lib/joinUtils');
        return executeJoin(leftBundle, rightBundle, join);
      },

      // AI-powered join suggestions (placeholder for future Cognee integration)
      suggestJoins: async () => {
        // TODO: Integrate with Cognee backend when available
        // For now, return empty array
        // Future implementation:
        // - Send bundles to Cognee
        // - Cognee analyzes data and suggests relationships
        // - Return AI-powered join suggestions
        return [];
      },

      // Import/Export
      exportConfig: () => {
        const state = get();
        return JSON.stringify(
          {
            version: '1.0',
            schemas: state.schemas,
            bundles: state.bundles, // Full data, no truncation
            joins: state.joins,
            virtualBundles: state.virtualBundles,
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

          // Import joins
          if (Array.isArray(config.joins)) {
            set({ joins: config.joins });
          }

          // Import virtual bundles
          if (Array.isArray(config.virtualBundles)) {
            set({ virtualBundles: config.virtualBundles });
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
            joins: state.joins,
            virtualBundles: state.virtualBundles,
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
          joins: state.joins,
          virtualBundles: state.virtualBundles,
          relationshipTypeConfig: state.relationshipTypeConfig,
          aiSettings: state.aiSettings,
          journalEntries: state.journalEntries,
        };
      },
    }
  )
);
