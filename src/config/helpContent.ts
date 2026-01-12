/**
 * Help Content Configuration
 *
 * Contextual help and guidance content for the Data Explorer application.
 * Edit this file to customize help text, tips, and tutorials.
 */

export interface HelpStep {
  title: string;
  content: string;
  image?: string;
  highlight?: string; // CSS selector to highlight
}

export interface ViewHelp {
  title: string;
  description: string;
  tips: string[];
  quickActions?: { label: string; description: string }[];
}

export interface HelpContent {
  welcome: {
    enabled: boolean;
    steps: HelpStep[];
  };
  views: {
    bundles: ViewHelp;
    schemas: ViewHelp;
    relationships: ViewHelp;
    explorer: ViewHelp;
  };
  explorerTips: {
    hierarchy: string[];
    tabular: string[];
    network: string[];
  };
  mappingHelp: {
    hierarchy: Record<string, string>;
    tabular: Record<string, string>;
    network: Record<string, string>;
  };
}

export const helpContent: HelpContent = {
  welcome: {
    enabled: true,
    steps: [
      {
        title: 'Welcome to Data Explorer',
        content: `Data Explorer helps you visualize and explore hierarchical, tabular, and network datasets using semantic schemas.

**Key Features:**
- Upload CSV/JSON files
- Map columns to semantic roles
- Explore data with interactive visualizations
- Manage relationship types for network data`,
      },
      {
        title: 'Step 1: Upload Your Data',
        content: `Start by uploading a CSV or JSON file in the **Data Bundles** section.

Try one of the sample datasets to see how it works:
- FLOC Hierarchy (hierarchical equipment data)
- SAP BOM Network (table dependencies)
- Work Orders (tabular data profiling)`,
        highlight: 'bundles',
      },
      {
        title: 'Step 2: Map Columns to Schema',
        content: `After uploading, map your CSV columns to semantic roles based on the data type:

**Hierarchy:** Node ID, Parent ID, Labels, Metrics
**Network:** Source/Target Nodes, Edge Labels, Weights
**Tabular:** Categories, Measures, Timestamps`,
      },
      {
        title: 'Step 3: Explore Your Data',
        content: `Once mapped, explore your data with interactive visualizations:

**Hierarchy:** Drill down, collapse branches, view metrics
**Network:** Drag nodes, zoom, filter by relationship type
**Tabular:** Profile data quality, view distributions, inspect values`,
        highlight: 'explorer',
      },
      {
        title: 'Advanced: Relationship Types',
        content: `For network data, configure relationship types with colors and styles:

- 50+ predefined relationship types
- Organize by category (Data Lineage, Quality, etc.)
- Customize colors and line styles
- Changes apply immediately to visualizations`,
        highlight: 'relationships',
      },
    ],
  },

  views: {
    bundles: {
      title: 'Data Bundles',
      description: 'Upload and manage your datasets. Each bundle contains source data and column mappings.',
      tips: [
        'Click "Upload Data" to add CSV or JSON files',
        'Try sample datasets to explore features',
        'Edit mappings to change how columns are interpreted',
        'Delete bundles you no longer need',
        'Bundle names and descriptions are editable',
      ],
      quickActions: [
        { label: 'Upload CSV', description: 'Add a new dataset from a CSV file' },
        { label: 'Load Sample', description: 'Try pre-configured sample datasets' },
        { label: 'Edit Bundle', description: 'Modify name, description, or mappings' },
      ],
    },

    schemas: {
      title: 'Semantic Schemas',
      description: 'Define how data should be interpreted using semantic roles. Schemas determine what visualizations are available.',
      tips: [
        'Three built-in schemas: Hierarchy, Tabular, Network',
        'Each schema defines required and optional roles',
        'Roles have data types (string, number, date, boolean)',
        'Some roles support multiple columns (metrics, categories)',
        'Custom schemas can be added via the API',
      ],
      quickActions: [
        { label: 'View Schema Details', description: 'See roles and requirements' },
        { label: 'Create Custom Schema', description: 'Define your own semantic structure' },
      ],
    },

    relationships: {
      title: 'Relationship Types',
      description: 'Configure semantic relationship types for network visualizations with visual styling.',
      tips: [
        'Search or filter by category to find specific types',
        'Click category names to expand/collapse',
        'Edit colors and line styles (solid, dashed, dotted)',
        'Changes apply immediately to network visualizations',
        'Reset to defaults if you want to start over',
        'Add custom relationship types for your domain',
      ],
      quickActions: [
        { label: 'Add Type', description: 'Create a custom relationship type' },
        { label: 'Edit Type', description: 'Change color, style, or description' },
        { label: 'Reset to Defaults', description: 'Restore original configuration' },
      ],
    },

    explorer: {
      title: 'Explorer',
      description: 'Visualize and interact with your mapped data. Visualization type adapts to the schema.',
      tips: [
        'Select a bundle from the dropdown to explore',
        'Use zoom and pan controls for better navigation',
        'Hover over elements to see details',
        'Click "View Data" to inspect raw data in grid view',
        'Legend shows color coding and groupings',
      ],
      quickActions: [
        { label: 'Switch Bundle', description: 'Explore a different dataset' },
        { label: 'Zoom Controls', description: 'Zoom in/out or reset view' },
        { label: 'View Data', description: 'See raw data in table format' },
      ],
    },
  },

  explorerTips: {
    hierarchy: [
      '**Click nodes** to drill down and explore children',
      '**Hover** to see node details and metrics',
      '**Breadcrumbs** at the top show your navigation path',
      '**Colors** represent different metric values',
      '**Size** of nodes reflects metric magnitude',
      'Use **zoom controls** to focus on specific areas',
    ],
    tabular: [
      '**Search columns** using the search box',
      '**Sort** by name, null count, or uniqueness',
      '**Click cards** to see top values and distributions',
      '**Quality score** indicates data completeness and consistency',
      '**Profile view** shows statistics and issues',
      '**Grid view** lets you inspect raw data with sorting and filtering',
    ],
    network: [
      '**Drag nodes** to reposition them',
      '**Scroll** to zoom in and out',
      '**Hover nodes** to see details and group',
      '**Legend** shows node groups and relationship types',
      '**Edge colors** indicate relationship types',
      '**Line styles** (solid/dashed/dotted) show relationship categories',
      'Adjust **link strength** and **repulsion** for better layouts',
    ],
  },

  mappingHelp: {
    hierarchy: {
      node_id: 'Unique identifier for each node in the tree (e.g., equipment ID, location code)',
      node_label: 'Human-readable name to display (e.g., equipment name, location description)',
      parent_id: 'ID of the parent node. Leave empty or use a special value for root nodes',
      metric: 'Numeric value to visualize (e.g., cost, count, utilization). Can map multiple metrics.',
    },
    tabular: {
      row_id: 'Unique row identifier (optional - will auto-generate if not provided)',
      category: 'Categorical field for grouping and filtering (e.g., status, type, region)',
      measure: 'Numeric field for aggregation and statistics (e.g., amount, quantity, score)',
      timestamp: 'Date/time field for temporal analysis and time-series views',
      text: 'Free-form text for content analysis and search',
    },
    network: {
      source_node: 'Starting node of the relationship or dependency (e.g., table name, system ID)',
      target_node: 'Ending node of the relationship or dependency',
      edge_weight: 'Numeric strength of the connection (optional, defaults to 1)',
      edge_label: 'Type or description of the relationship (e.g., "depends on", "contains")',
      node_group: 'Category for node coloring (e.g., domain, system, layer)',
      relationship_type: 'Semantic relationship type for edge styling (e.g., "sources from", "validates")',
      cardinality: 'Relationship cardinality (e.g., 1:1, 1:N, N:M)',
    },
  },
};

export default helpContent;
