import type { SemanticSchema } from '@/types';

export const defaultSchemas: SemanticSchema[] = [
  // ============================================
  // HIERARCHY SCHEMA
  // ============================================
  {
    id: 'hierarchy-default',
    dataType: 'hierarchy',
    name: 'Hierarchy',
    description: 'Tree-structured data with parent-child relationships (e.g., FLOC, org charts, folder structures)',
    roles: [
      {
        id: 'node_id',
        name: 'Node ID',
        description: 'Unique identifier for each node in the hierarchy',
        required: true,
        dataType: 'string',
      },
      {
        id: 'node_label',
        name: 'Node Label',
        description: 'Display name or description for the node',
        required: false,
        dataType: 'string',
      },
      {
        id: 'parent_id',
        name: 'Parent ID',
        description: 'Reference to the parent node (empty/null for root nodes)',
        required: true,
        dataType: 'string',
      },
      {
        id: 'metric',
        name: 'Metric',
        description: 'Numeric value to visualize (e.g., count, cost, score)',
        required: false,
        multiple: true,
        dataType: 'number',
      },
    ],
  },

  // ============================================
  // TABULAR SCHEMA
  // ============================================
  {
    id: 'tabular-default',
    dataType: 'tabular',
    name: 'Tabular',
    description: 'Flat dataset for profiling and exploration (e.g., transactions, records, logs)',
    roles: [
      {
        id: 'row_id',
        name: 'Row Identifier',
        description: 'Unique identifier for each row (optional, will auto-generate if not provided)',
        required: false,
        dataType: 'string',
      },
      {
        id: 'category',
        name: 'Category Field',
        description: 'Categorical field for grouping and filtering',
        required: false,
        multiple: true,
        dataType: 'string',
      },
      {
        id: 'measure',
        name: 'Measure Field',
        description: 'Numeric field for aggregation and statistics',
        required: false,
        multiple: true,
        dataType: 'number',
      },
      {
        id: 'timestamp',
        name: 'Timestamp',
        description: 'Date/time field for temporal analysis',
        required: false,
        dataType: 'date',
      },
      {
        id: 'text',
        name: 'Text Field',
        description: 'Free-form text field for content analysis',
        required: false,
        multiple: true,
        dataType: 'string',
      },
    ],
  },

  // ============================================
  // NETWORK SCHEMA
  // ============================================
  {
    id: 'network-default',
    dataType: 'network',
    name: 'Network',
    description: 'Graph data with nodes and edges (e.g., relationships, dependencies, flows)',
    roles: [
      {
        id: 'source_node',
        name: 'Source Node',
        description: 'Starting node of an edge/relationship',
        required: true,
        dataType: 'string',
      },
      {
        id: 'target_node',
        name: 'Target Node',
        description: 'Ending node of an edge/relationship',
        required: true,
        dataType: 'string',
      },
      {
        id: 'edge_weight',
        name: 'Edge Weight',
        description: 'Numeric weight or strength of the relationship',
        required: false,
        dataType: 'number',
      },
      {
        id: 'edge_label',
        name: 'Edge Label',
        description: 'Label or type of the relationship',
        required: false,
        dataType: 'string',
      },
      {
        id: 'node_group',
        name: 'Node Group',
        description: 'Category or group for node coloring (requires separate node data)',
        required: false,
        dataType: 'string',
      },
    ],
  },
];

export function getSchemaById(schemas: SemanticSchema[], id: string): SemanticSchema | undefined {
  return schemas.find((s) => s.id === id);
}

export function getSchemaByDataType(schemas: SemanticSchema[], dataType: string): SemanticSchema | undefined {
  return schemas.find((s) => s.dataType === dataType);
}
