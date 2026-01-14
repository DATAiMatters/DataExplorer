// ============================================
// SEMANTIC SCHEMA TYPES
// ============================================

export type DataType = 'hierarchy' | 'tabular' | 'network' | 'timeline' | 'treemap' | 'heatmap' | 'geographic' | 'flow';

export interface SemanticRole {
  id: string;
  name: string;
  description: string;
  required: boolean;
  multiple?: boolean;
  dataType?: 'string' | 'number' | 'boolean' | 'date';
}

export interface SemanticSchema {
  id: string;
  dataType: DataType;
  name: string;
  description: string;
  roles: SemanticRole[];
}

// ============================================
// COLUMN MAPPING TYPES
// ============================================

export interface ColumnMapping {
  sourceColumn: string;
  roleId: string;
  displayName: string;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'trim';
}

// ============================================
// DATA BUNDLE TYPES
// ============================================

export interface DataSource {
  type: 'csv' | 'json';
  fileName: string;
  rawData: string;
  parsedData: Record<string, unknown>[];
  columns: string[];
}

export interface DataBundle {
  id: string;
  name: string;
  description?: string;
  schemaId: string;
  source: DataSource;
  mappings: ColumnMapping[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// VISUALIZATION DATA TYPES
// ============================================

// Hierarchy-specific types
export interface HierarchyNode {
  id: string;
  label: string;
  parentId: string | null;
  metrics: Record<string, number>;
  children?: HierarchyNode[];
  depth?: number;
}

// Tabular-specific types
export interface QualityIssue {
  type: 'high_nulls' | 'low_cardinality' | 'outliers' | 'format_inconsistency' | 'duplicates';
  severity: 'error' | 'warning' | 'info';
  message: string;
  count?: number;
}

export interface TabularProfile {
  column: string;
  displayName: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  nullCount: number;
  uniqueCount: number;
  totalCount: number;
  topValues?: { value: string; count: number }[];
  numericStats?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  };
  qualityScore: number; // 0-100
  qualityIssues: QualityIssue[];
}

// Network-specific types
export interface NetworkNode {
  id: string;
  label: string;
  group?: string;
  metrics?: Record<string, number>;
}

export interface NetworkEdge {
  source: string;
  target: string;
  weight?: number;
  label?: string;
  relationshipType?: string;
  cardinality?: string;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

// ============================================
// AI INTEGRATION TYPES
// ============================================

export type AIProvider = 'openai-compatible' | 'anthropic' | 'ollama';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface AIPreset {
  provider: AIProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
}

// ============================================
// JOURNAL TYPES
// ============================================

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// ============================================
// UI STATE TYPES
// ============================================

export type ViewMode = 'bundles' | 'schemas' | 'explorer' | 'relationships' | 'ai-settings' | 'journal';

export interface ExplorerState {
  selectedBundleId: string | null;
  zoomLevel: number;
  focusedNodeId: string | null;
  breadcrumb: string[];
}

// ============================================
// APP STATE
// ============================================

export interface AppState {
  schemas: SemanticSchema[];
  bundles: DataBundle[];
  viewMode: ViewMode;
  explorerState: ExplorerState;
  aiSettings: AISettings;
}
