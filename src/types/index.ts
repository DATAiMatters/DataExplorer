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
  schemaId: string; // Primary schema
  additionalSchemaIds?: string[]; // Optional additional schemas for multi-view support
  source: DataSource;
  mappings: ColumnMapping[]; // Mappings for primary schema
  mappingsBySchema?: Record<string, ColumnMapping[]>; // Mappings per schema (including primary)
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
// JOIN & LINEAGE TYPES
// ============================================

export type JoinType = 'inner' | 'left' | 'right' | 'full';
export type JoinOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like';

export interface JoinCondition {
  leftRoleId: string;   // Semantic role from left bundle
  rightRoleId: string;  // Semantic role from right bundle
  operator: JoinOperator;
}

export interface JoinDefinition {
  id: string;
  name: string;
  description?: string;
  leftBundleId: string;
  rightBundleId: string;
  joinType: JoinType;
  conditions: JoinCondition[];
  createdAt: string;
  updatedAt: string;
}

export interface VirtualBundle {
  id: string;
  name: string;
  description?: string;
  type: 'join' | 'union' | 'filter';
  sourceJoinIds: string[];  // References to JoinDefinitions
  schemaId: string;         // Primary resulting schema after join
  additionalSchemaIds?: string[]; // Optional additional schemas for multi-view support
  mappingsBySchema?: Record<string, ColumnMapping[]>; // Mappings per schema
  createdAt: string;
  updatedAt: string;
}

// AI-powered join suggestions (future Cognee integration)
export interface JoinSuggestion {
  leftBundleId: string;
  rightBundleId: string;
  leftRoleId: string;
  rightRoleId: string;
  confidence: number;      // 0-1 score
  reason: string;          // Why this join makes sense
  dataOverlap?: number;    // % of matching values
}

// Lineage graph node types
export type LineageNodeType = 'bundle' | 'virtual_bundle' | 'schema';
export type LineageEdgeType = 'join' | 'derived_from' | 'uses_schema';

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string;
  bundleId?: string;
  schemaId?: string;
  metadata?: Record<string, unknown>;
}

export interface LineageEdge {
  source: string;
  target: string;
  type: LineageEdgeType;
  label?: string;
  joinId?: string;
}

// ============================================
// BUSINESS OUTCOMES TYPES
// ============================================

export type OutcomeCategory = 'financial' | 'operational' | 'compliance' | 'customer' | 'safety';
export type EntityStatus = 'draft' | 'active' | 'deprecated';
export type KPIDirection = 'higher_is_better' | 'lower_is_better' | 'target_range';
export type KPIFrequency = 'real-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type CDEDataType = 'string' | 'number' | 'date' | 'boolean';
export type DQRuleType =
  | 'completeness'
  | 'validity'
  | 'consistency'
  | 'timeliness'
  | 'uniqueness'
  | 'accuracy';
export type DQSeverity = 'critical' | 'major' | 'minor';
export type ExecutionEngine = 'none' | 'sql' | 'great_expectations' | 'custom';
export type TraceLinkType =
  | 'outcome_kpi'
  | 'kpi_cde'
  | 'cde_rule'
  | 'outcome_process'
  | 'process_kpi';
export type TraceImpactType = 'cost' | 'risk' | 'availability' | 'compliance' | 'experience';

export interface BusinessOutcome {
  id: string;
  name: string;
  description: string;
  category: OutcomeCategory;
  owner?: string;
  targetValue?: string;
  status?: EntityStatus;
  tags?: string[];
  processAreaIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcessArea {
  id: string;
  code: string;
  name: string;
  description: string;
  owner?: string;
  subProcesses: SubProcess[];
}

export interface SubProcess {
  id: string;
  code: string;
  name: string;
  description: string;
  owner?: string;
  kpiIds: string[];
}

export interface KPI {
  id: string;
  name: string;
  description: string;
  formula?: string;
  unit: string;
  direction: KPIDirection;
  targetValue?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  frequency: KPIFrequency;
  owner?: string;
  status?: EntityStatus;
  calculationWindow?: string;
  outcomeIds: string[];
  processAreaId?: string;
  cdeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CriticalDataElement {
  id: string;
  name: string;
  description: string;
  dataType: CDEDataType;
  businessDefinition: string;
  sourceSystem?: string;
  sourceTable?: string;
  sourceColumn?: string;
  owner?: string;
  status?: EntityStatus;
  bundleId?: string;
  columnName?: string;
  kpiIds: string[];
  dqRuleIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  cdeId: string;
  ruleType: DQRuleType;
  expression?: string;
  expectedPattern?: string;
  referenceDataset?: string;
  executionEngine?: ExecutionEngine;
  status?: EntityStatus;
  severity: DQSeverity;
  passThreshold: number;
  isExecutable: boolean;
  lastRunDate?: string;
  lastRunResult?: {
    totalRecords: number;
    passedRecords: number;
    failedRecords: number;
    passRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TraceLink {
  id: string;
  fromId: string;
  toId: string;
  linkType: TraceLinkType;
  rationale?: string;
  impactType?: TraceImpactType;
  weight?: number;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// EXTENDED BUSINESS OUTCOME GRAPH TYPES
// ============================================
// Model: Goal → KPI → Decision → Signal → Rule → DataProduct → Dataset

export type SignalState = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
export type ValueImpactBand = 'High' | 'Medium' | 'Low';

export interface Decision {
  id: string;
  name: string;
  description?: string;
  ownerRole?: string;
  system?: string;
  touchpoint?: string;           // e.g., SAP transaction code like "F110"
  cadence?: string;              // e.g., "Weekly", "Daily"
  criticality?: 'High' | 'Medium' | 'Low';
  cutoffRule?: string;           // Business rule for decision timing
  goalIds: string[];             // Goals this decision protects
  signalIds: string[];           // Signals that can degrade this decision
  createdAt: string;
  updatedAt: string;
}

export interface Signal {
  id: string;
  name: string;
  description?: string;
  state: SignalState;
  valueImpactBand: ValueImpactBand;
  ownerRole?: string;
  descriptionTemplate?: string;  // Template with placeholders like {decisionName}, {exposureBand}
  riskDrivers?: {
    blockedAmount?: number | null;
    dueSoonCount?: number | null;
    criticalSupplierCount?: number | null;
    runBlockingFlag?: boolean | null;
  };
  decisionIds: string[];         // Decisions this signal degrades
  ruleIds: string[];             // Rules that feed into this signal
  dataProductIds: string[];      // DataProducts this signal uses
  createdAt: string;
  updatedAt: string;
}

export interface DataProduct {
  id: string;
  name: string;
  description?: string;
  version?: string;
  grain?: string;                // e.g., "INVOICE_HEADER", "VENDOR"
  primaryKey?: string[];         // Composite key fields
  fields?: string[];             // Available fields in this data product
  objectFamily?: string;         // e.g., "Vendor", "Invoice", "PaymentRun"
  contractStability?: 'STABLE' | 'EXPERIMENTAL' | 'DEPRECATED';
  ownerRole?: string;
  datasetIds: string[];          // Source datasets this product uses
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  system?: string;               // e.g., "SAP"
  objectFamily?: string;         // e.g., "Vendor", "Invoice"
  tableName?: string;            // Physical table name like "LFA1", "BKPF"
  fieldCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Extended relationship types for the graph
export type ExtendedRelationshipType =
  | 'isMeasuredBy'      // Goal → KPI
  | 'protects'          // Decision → Goal
  | 'degrades'          // Signal → Decision
  | 'isDerivedFrom'     // Signal → Rule
  | 'validates'         // Rule → DataProduct
  | 'uses'              // DataProduct → Dataset
  | 'belongsTo'         // Generic containment
  | 'supports';         // Process → Goal

export interface ExtendedRelationship {
  id: string;
  type: ExtendedRelationshipType;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  cardinality?: string;
  properties?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Schema for importing/exporting the full graph
export interface BusinessOutcomeGraph {
  meta: {
    schemaVersion: string;
    tenant?: string;
    domain?: string;
    createdAt: string;
    notes?: string[];
  };
  assetTypes: string[];
  relationshipTypes: string[];
  assets: {
    goals: BusinessOutcome[];
    kpis: KPI[];
    decisions: Decision[];
    signals: Signal[];
    rules: DataQualityRule[];
    dataProducts: DataProduct[];
    datasets: Dataset[];
  };
  relationships: ExtendedRelationship[];
}

// ============================================
// UI STATE TYPES
// ============================================

export type ViewMode =
  | 'bundles'
  | 'schemas'
  | 'explorer'
  | 'relationship-types'
  | 'joins'
  | 'lineage'
  | 'ai-settings'
  | 'journal'
  | 'business-outcomes';

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
  joins: JoinDefinition[];
  virtualBundles: VirtualBundle[];
  viewMode: ViewMode;
  explorerState: ExplorerState;
  relationshipTypeConfig: import('@/config/relationshipTypes').RelationshipTypeConfig;
  aiSettings: AISettings;
  journalEntries: JournalEntry[];
  preselectedSchemaId: string | null;
}
