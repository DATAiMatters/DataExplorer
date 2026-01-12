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
      {
        id: 'relationship_type',
        name: 'Relationship Type',
        description: 'Type of relationship between nodes (e.g., sources from, depends on, aggregates)',
        required: false,
        dataType: 'string',
      },
      {
        id: 'cardinality',
        name: 'Cardinality',
        description: 'Cardinality of the relationship (e.g., 1:1, 1:N, N:M, N:1)',
        required: false,
        dataType: 'string',
      },
    ],
  },

  // ============================================
  // TIMELINE/EVENTS SCHEMA
  // ============================================
  {
    id: 'timeline-default',
    dataType: 'timeline',
    name: 'Timeline / Events',
    description: 'Time-based events and milestones (e.g., project timelines, logs, audit trails, historical events)',
    roles: [
      {
        id: 'event_id',
        name: 'Event ID',
        description: 'Unique identifier for each event',
        required: false,
        dataType: 'string',
      },
      {
        id: 'event_name',
        name: 'Event Name',
        description: 'Name or title of the event',
        required: true,
        dataType: 'string',
      },
      {
        id: 'start_date',
        name: 'Start Date/Time',
        description: 'When the event starts or occurs',
        required: true,
        dataType: 'date',
      },
      {
        id: 'end_date',
        name: 'End Date/Time',
        description: 'When the event ends (optional for point events)',
        required: false,
        dataType: 'date',
      },
      {
        id: 'duration',
        name: 'Duration',
        description: 'Duration of the event (calculated if start/end provided)',
        required: false,
        dataType: 'number',
      },
      {
        id: 'category',
        name: 'Category/Type',
        description: 'Type or category of event for grouping and coloring',
        required: false,
        dataType: 'string',
      },
      {
        id: 'status',
        name: 'Status',
        description: 'Current status of the event (e.g., planned, in progress, completed)',
        required: false,
        dataType: 'string',
      },
      {
        id: 'description',
        name: 'Description',
        description: 'Detailed description or notes about the event',
        required: false,
        dataType: 'string',
      },
    ],
  },

  // ============================================
  // TREE MAP SCHEMA
  // ============================================
  {
    id: 'treemap-default',
    dataType: 'treemap',
    name: 'Tree Map',
    description: 'Hierarchical data with proportional sizing (e.g., budget breakdowns, disk usage, sales by category)',
    roles: [
      {
        id: 'category',
        name: 'Category',
        description: 'Name of the category or item',
        required: true,
        dataType: 'string',
      },
      {
        id: 'parent_category',
        name: 'Parent Category',
        description: 'Parent category for nested structures (empty/null for top-level)',
        required: false,
        dataType: 'string',
      },
      {
        id: 'value',
        name: 'Value/Size',
        description: 'Numeric value that determines rectangle size',
        required: true,
        dataType: 'number',
      },
      {
        id: 'color_metric',
        name: 'Color Metric',
        description: 'Secondary metric for color coding (optional)',
        required: false,
        dataType: 'number',
      },
      {
        id: 'label',
        name: 'Label',
        description: 'Display label or formatted text',
        required: false,
        dataType: 'string',
      },
    ],
  },

  // ============================================
  // HEAT MAP (MATRIX) SCHEMA
  // ============================================
  {
    id: 'heatmap-default',
    dataType: 'heatmap',
    name: 'Heat Map / Matrix',
    description: 'Matrix data with color-coded values (e.g., correlation matrices, confusion matrices, time-series grids)',
    roles: [
      {
        id: 'row_label',
        name: 'Row Label',
        description: 'Label for the row dimension',
        required: true,
        dataType: 'string',
      },
      {
        id: 'column_label',
        name: 'Column Label',
        description: 'Label for the column dimension',
        required: true,
        dataType: 'string',
      },
      {
        id: 'cell_value',
        name: 'Cell Value',
        description: 'Numeric value to encode as color intensity',
        required: true,
        dataType: 'number',
      },
      {
        id: 'cell_label',
        name: 'Cell Label',
        description: 'Display label or formatted value for the cell',
        required: false,
        dataType: 'string',
      },
      {
        id: 'color_scale',
        name: 'Color Scale Type',
        description: 'Type of color scale (e.g., sequential, diverging)',
        required: false,
        dataType: 'string',
      },
    ],
  },

  // ============================================
  // GEOGRAPHIC/SPATIAL SCHEMA
  // ============================================
  {
    id: 'geographic-default',
    dataType: 'geographic',
    name: 'Geographic / Map',
    description: 'Location-based data with coordinates (e.g., store locations, facility maps, delivery routes, regional data)',
    roles: [
      {
        id: 'location_id',
        name: 'Location ID',
        description: 'Unique identifier for the location',
        required: false,
        dataType: 'string',
      },
      {
        id: 'location_name',
        name: 'Location Name',
        description: 'Name or label for the location',
        required: true,
        dataType: 'string',
      },
      {
        id: 'latitude',
        name: 'Latitude',
        description: 'Latitude coordinate (decimal degrees)',
        required: true,
        dataType: 'number',
      },
      {
        id: 'longitude',
        name: 'Longitude',
        description: 'Longitude coordinate (decimal degrees)',
        required: true,
        dataType: 'number',
      },
      {
        id: 'address',
        name: 'Address',
        description: 'Full address or location description',
        required: false,
        dataType: 'string',
      },
      {
        id: 'region',
        name: 'Region/Zone',
        description: 'Geographic region or zone for grouping',
        required: false,
        dataType: 'string',
      },
      {
        id: 'metric_value',
        name: 'Metric Value',
        description: 'Numeric value for sizing markers or heatmap intensity',
        required: false,
        dataType: 'number',
      },
      {
        id: 'category',
        name: 'Category',
        description: 'Type or category for marker styling',
        required: false,
        dataType: 'string',
      },
    ],
  },

  // ============================================
  // FLOW/SANKEY SCHEMA
  // ============================================
  {
    id: 'flow-default',
    dataType: 'flow',
    name: 'Flow / Sankey',
    description: 'Flow data showing movement or transformation (e.g., budget flows, conversion funnels, energy flows, migration)',
    roles: [
      {
        id: 'source',
        name: 'Source',
        description: 'Starting point of the flow',
        required: true,
        dataType: 'string',
      },
      {
        id: 'target',
        name: 'Target',
        description: 'Ending point of the flow',
        required: true,
        dataType: 'string',
      },
      {
        id: 'flow_value',
        name: 'Flow Value',
        description: 'Magnitude or volume of the flow',
        required: true,
        dataType: 'number',
      },
      {
        id: 'flow_type',
        name: 'Flow Type/Category',
        description: 'Type or category of flow for coloring',
        required: false,
        dataType: 'string',
      },
      {
        id: 'description',
        name: 'Description',
        description: 'Additional details about the flow',
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
