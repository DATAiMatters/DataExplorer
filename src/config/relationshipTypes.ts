/**
 * Relationship Type Configuration
 *
 * Default relationship types and visual styling rules.
 * Users can customize colors and line styles for each relationship type.
 */

export interface RelationshipType {
  category: string;
  name: string;
  inverseName: string;
  description: string;
  symmetric: boolean;
  purpose: string;
  // Visual properties
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  arrowStyle?: 'normal' | 'hollow' | 'diamond';
}

export interface RelationshipTypeConfig {
  types: RelationshipType[];
  categoryColors: Record<string, string>;
}

// Category color scheme - distinct colors for each category
const categoryColorScheme: Record<string, string> = {
  'Data Lineage': '#3b82f6',        // blue
  'Data Quality': '#10b981',        // emerald
  'Data Governance': '#8b5cf6',     // violet
  'Compliance & Policy': '#f59e0b', // amber
  'Schema & Structure': '#06b6d4',  // cyan
  'Mapping & Integration': '#14b8a6', // teal
  'Business Process': '#f97316',    // orange
  'Dependency & Impact': '#ef4444', // red
  'Semantic & Ontology': '#ec4899', // pink
  'Versioning & Lifecycle': '#6366f1', // indigo
  'Data Migration': '#84cc16',      // lime
  'Access & Security': '#dc2626',   // red-600
  'Physical & Infrastructure': '#64748b', // slate
  'Documentation & Knowledge': '#a855f7', // purple
  'Collaboration': '#22c55e',       // green
};

// Default relationship types from CSV
export const defaultRelationshipTypes: RelationshipType[] = [
  // Data Lineage
  { category: 'Data Lineage', name: 'sources from', inverseName: 'feeds into', description: 'Data origin - Asset A sources from Asset B means B provides data to A', symmetric: false, purpose: 'Data provenance tracking', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'transforms into', inverseName: 'is transformed from', description: 'Data transformation - Asset A transforms into Asset B through processing', symmetric: false, purpose: 'Transformation lineage', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'copies to', inverseName: 'is copied from', description: 'Data replication - Asset A is replicated to Asset B', symmetric: false, purpose: 'Replication tracking', color: '#3b82f6', lineStyle: 'dashed' },
  { category: 'Data Lineage', name: 'aggregates', inverseName: 'is aggregated into', description: 'Rollup - Asset A combines multiple records into Asset B', symmetric: false, purpose: 'Aggregation lineage', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'derives from', inverseName: 'is source for', description: 'Calculated/derived data - Asset A is computed from Asset B', symmetric: false, purpose: 'Derived field tracking', color: '#3b82f6', lineStyle: 'dotted' },
  { category: 'Data Lineage', name: 'extracts from', inverseName: 'is extracted to', description: 'Extraction - Asset A pulls data from Asset B', symmetric: false, purpose: 'ETL extraction', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'loads into', inverseName: 'is loaded from', description: 'Loading - Asset A loads data into Asset B', symmetric: false, purpose: 'ETL loading', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'merges with', inverseName: 'merges with', description: 'Data merge - Asset A combines with Asset B', symmetric: true, purpose: 'Data integration', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'splits into', inverseName: 'is split from', description: 'Data split - Asset A divides into Asset B', symmetric: false, purpose: 'Data partitioning', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'filters from', inverseName: 'is filtered to', description: 'Filtering - Asset A is a filtered subset of Asset B', symmetric: false, purpose: 'Subset tracking', color: '#3b82f6', lineStyle: 'dashed' },
  { category: 'Data Lineage', name: 'enriches', inverseName: 'is enriched by', description: 'Data enrichment - Asset A adds value to Asset B', symmetric: false, purpose: 'Data augmentation', color: '#3b82f6', lineStyle: 'solid' },
  { category: 'Data Lineage', name: 'cleanses', inverseName: 'is cleansed by', description: 'Data cleansing - Asset A applies cleaning rules to Asset B', symmetric: false, purpose: 'Cleansing lineage', color: '#3b82f6', lineStyle: 'solid' },

  // Data Quality
  { category: 'Data Quality', name: 'validates', inverseName: 'is validated by', description: 'Validation - Asset A validates Asset B against rules', symmetric: false, purpose: 'Rule validation', color: '#10b981', lineStyle: 'solid' },
  { category: 'Data Quality', name: 'conflicts with', inverseName: 'conflicts with', description: 'Data conflict - Asset A has conflicting values with Asset B', symmetric: true, purpose: 'Conflict detection', color: '#10b981', lineStyle: 'dotted' },
  { category: 'Data Quality', name: 'is master for', inverseName: 'has master', description: 'Master data - Asset A is the golden record for Asset B', symmetric: false, purpose: 'Golden record management', color: '#10b981', lineStyle: 'solid' },
  { category: 'Data Quality', name: 'overrides', inverseName: 'is overridden by', description: 'Precedence - Asset A takes priority over Asset B', symmetric: false, purpose: 'Data precedence rules', color: '#10b981', lineStyle: 'solid' },
  { category: 'Data Quality', name: 'matches', inverseName: 'matches', description: 'Record matching - Asset A matches Asset B (potential duplicate)', symmetric: true, purpose: 'Duplicate detection', color: '#10b981', lineStyle: 'dashed' },
  { category: 'Data Quality', name: 'is duplicate of', inverseName: 'is duplicate of', description: 'Duplicate - Asset A is a duplicate of Asset B', symmetric: true, purpose: 'Duplicate flagging', color: '#10b981', lineStyle: 'dotted' },

  // Data Governance
  { category: 'Data Governance', name: 'is owned by', inverseName: 'owns', description: 'Ownership - Asset A is owned by Asset B (person/org)', symmetric: false, purpose: 'Data ownership', color: '#8b5cf6', lineStyle: 'solid' },
  { category: 'Data Governance', name: 'is stewarded by', inverseName: 'stewards', description: 'Stewardship - Asset A is managed by steward Asset B', symmetric: false, purpose: 'Data stewardship', color: '#8b5cf6', lineStyle: 'solid' },
  { category: 'Data Governance', name: 'governs', inverseName: 'is governed by', description: 'Governance - Asset A sets policies for Asset B', symmetric: false, purpose: 'Policy enforcement', color: '#8b5cf6', lineStyle: 'solid' },

  // Compliance & Policy
  { category: 'Compliance & Policy', name: 'complies with', inverseName: 'is complied with by', description: 'Compliance - Asset A complies with regulation/policy Asset B', symmetric: false, purpose: 'Regulatory compliance', color: '#f59e0b', lineStyle: 'solid' },
  { category: 'Compliance & Policy', name: 'is classified as', inverseName: 'classifies', description: 'Classification - Asset A is classified as Asset B (e.g., PII)', symmetric: false, purpose: 'Data classification', color: '#f59e0b', lineStyle: 'solid' },

  // Schema & Structure
  { category: 'Schema & Structure', name: 'contains field', inverseName: 'is field in', description: 'Structure - Asset A (table) contains Asset B (field)', symmetric: false, purpose: 'Schema documentation', color: '#06b6d4', lineStyle: 'solid' },
  { category: 'Schema & Structure', name: 'contains', inverseName: 'is contained in', description: 'Containment - Asset A contains Asset B', symmetric: false, purpose: 'Structural hierarchy', color: '#06b6d4', lineStyle: 'solid' },
  { category: 'Schema & Structure', name: 'references', inverseName: 'is referenced by', description: 'Foreign key - Asset A references Asset B', symmetric: false, purpose: 'Referential integrity', color: '#06b6d4', lineStyle: 'solid' },

  // Mapping & Integration
  { category: 'Mapping & Integration', name: 'maps to', inverseName: 'is mapped from', description: 'Mapping - Asset A maps to Asset B', symmetric: false, purpose: 'Field mapping', color: '#14b8a6', lineStyle: 'solid' },
  { category: 'Mapping & Integration', name: 'integrates with', inverseName: 'integrates with', description: 'Integration - Asset A integrates with Asset B', symmetric: true, purpose: 'System integration', color: '#14b8a6', lineStyle: 'solid' },

  // Business Process
  { category: 'Business Process', name: 'triggers', inverseName: 'is triggered by', description: 'Trigger - Asset A triggers Asset B', symmetric: false, purpose: 'Event initiation', color: '#f97316', lineStyle: 'solid' },
  { category: 'Business Process', name: 'follows', inverseName: 'is followed by', description: 'Sequence - Asset A follows Asset B in a process', symmetric: false, purpose: 'Process sequencing', color: '#f97316', lineStyle: 'solid' },
  { category: 'Business Process', name: 'produces', inverseName: 'is produced by', description: 'Production - Asset A produces Asset B', symmetric: false, purpose: 'Data creation', color: '#f97316', lineStyle: 'solid' },
  { category: 'Business Process', name: 'consumes', inverseName: 'is consumed by', description: 'Consumption - Asset A consumes Asset B', symmetric: false, purpose: 'Data consumption', color: '#f97316', lineStyle: 'solid' },

  // Dependency & Impact
  { category: 'Dependency & Impact', name: 'depends on', inverseName: 'is depended on by', description: 'Dependency - Asset A depends on Asset B', symmetric: false, purpose: 'Dependency tracking', color: '#ef4444', lineStyle: 'solid' },
  { category: 'Dependency & Impact', name: 'impacts', inverseName: 'is impacted by', description: 'Impact - Changes to Asset A impact Asset B', symmetric: false, purpose: 'Impact analysis', color: '#ef4444', lineStyle: 'solid' },
  { category: 'Dependency & Impact', name: 'requires', inverseName: 'is required by', description: 'Requirement - Asset A requires Asset B', symmetric: false, purpose: 'Requirements tracking', color: '#ef4444', lineStyle: 'solid' },

  // Semantic & Ontology
  { category: 'Semantic & Ontology', name: 'is a type of', inverseName: 'has type', description: 'Taxonomy - Asset A is a type/subclass of Asset B', symmetric: false, purpose: 'Taxonomic classification', color: '#ec4899', lineStyle: 'solid' },
  { category: 'Semantic & Ontology', name: 'is related to', inverseName: 'is related to', description: 'General relation - Asset A is related to Asset B', symmetric: true, purpose: 'General association', color: '#ec4899', lineStyle: 'dashed' },
  { category: 'Semantic & Ontology', name: 'is synonym of', inverseName: 'is synonym of', description: 'Synonym - Asset A is synonymous with Asset B', symmetric: true, purpose: 'Terminology management', color: '#ec4899', lineStyle: 'dotted' },

  // Versioning & Lifecycle
  { category: 'Versioning & Lifecycle', name: 'is version of', inverseName: 'has version', description: 'Versioning - Asset A is a version of Asset B', symmetric: false, purpose: 'Version tracking', color: '#6366f1', lineStyle: 'solid' },
  { category: 'Versioning & Lifecycle', name: 'succeeds', inverseName: 'is succeeded by', description: 'Succession - Asset A succeeds Asset B (newer version)', symmetric: false, purpose: 'Version succession', color: '#6366f1', lineStyle: 'solid' },
  { category: 'Versioning & Lifecycle', name: 'migrates to', inverseName: 'is migrated from', description: 'Migration - Asset A migrates to Asset B', symmetric: false, purpose: 'Migration tracking', color: '#6366f1', lineStyle: 'solid' },

  // Data Migration (subset for brevity - can add all if needed)
  { category: 'Data Migration', name: 'is source system for', inverseName: 'has source system', description: 'Source system - Asset A is source system for migration Asset B', symmetric: false, purpose: 'Migration source planning', color: '#84cc16', lineStyle: 'solid' },
  { category: 'Data Migration', name: 'is target system for', inverseName: 'has target system', description: 'Target system - Asset A is target system for migration Asset B', symmetric: false, purpose: 'Migration target planning', color: '#84cc16', lineStyle: 'solid' },

  // Access & Security
  { category: 'Access & Security', name: 'has access to', inverseName: 'is accessible by', description: 'Access - Asset A has access to Asset B', symmetric: false, purpose: 'Access control', color: '#dc2626', lineStyle: 'solid' },
  { category: 'Access & Security', name: 'is protected by', inverseName: 'protects', description: 'Protection - Asset A is protected by Asset B (policy/control)', symmetric: false, purpose: 'Security controls', color: '#dc2626', lineStyle: 'solid' },

  // Physical & Infrastructure
  { category: 'Physical & Infrastructure', name: 'is hosted on', inverseName: 'hosts', description: 'Hosting - Asset A is hosted on Asset B', symmetric: false, purpose: 'Infrastructure mapping', color: '#64748b', lineStyle: 'solid' },
  { category: 'Physical & Infrastructure', name: 'runs on', inverseName: 'runs', description: 'Runtime - Asset A runs on Asset B', symmetric: false, purpose: 'Runtime tracking', color: '#64748b', lineStyle: 'solid' },

  // Documentation & Knowledge
  { category: 'Documentation & Knowledge', name: 'documents', inverseName: 'is documented by', description: 'Documentation - Asset A documents Asset B', symmetric: false, purpose: 'Documentation linking', color: '#a855f7', lineStyle: 'solid' },
  { category: 'Documentation & Knowledge', name: 'defines', inverseName: 'is defined by', description: 'Definition - Asset A defines Asset B', symmetric: false, purpose: 'Definition management', color: '#a855f7', lineStyle: 'solid' },

  // Collaboration
  { category: 'Collaboration', name: 'is assigned to', inverseName: 'has assignee', description: 'Assignment - Asset A is assigned to Asset B', symmetric: false, purpose: 'Task assignment', color: '#22c55e', lineStyle: 'solid' },
  { category: 'Collaboration', name: 'is created by', inverseName: 'creates', description: 'Creation - Asset A is created by Asset B', symmetric: false, purpose: 'Authorship tracking', color: '#22c55e', lineStyle: 'solid' },
];

export const defaultRelationshipTypeConfig: RelationshipTypeConfig = {
  types: defaultRelationshipTypes,
  categoryColors: categoryColorScheme,
};

// Helper function to get relationship type by name
export function getRelationshipType(
  config: RelationshipTypeConfig,
  name: string
): RelationshipType | undefined {
  return config.types.find((t) => t.name.toLowerCase() === name.toLowerCase());
}

// Helper function to get all types in a category
export function getTypesByCategory(
  config: RelationshipTypeConfig,
  category: string
): RelationshipType[] {
  return config.types.filter((t) => t.category === category);
}

// Helper function to get all unique categories
export function getCategories(config: RelationshipTypeConfig): string[] {
  return Array.from(new Set(config.types.map((t) => t.category)));
}
