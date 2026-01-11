# Architecture Overview

## Design Principles

### 1. Schema-Driven
The application uses a **semantic schema** approach where:
- Data types (hierarchy, tabular, network) have defined roles
- Users map their data columns to these roles
- Visualizations consume normalized data structures

This decouples data format from visualization logic.

### 2. Bundle-Based
A **Data Bundle** encapsulates:
- Raw source data (CSV/JSON)
- Parsed data
- Column-to-role mappings
- Display preferences

Bundles are self-contained and portable.

### 3. Pluggable Visualizations
Each data type has dedicated visualization components that:
- Receive normalized data
- Handle their own state (zoom, selection, etc.)
- Are independently developable

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│   Parse     │────▶│   Store     │
│  CSV/JSON   │     │  (Papaparse)│     │  (Zustand)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Visualize  │◀────│  Transform  │◀────│   Map to    │
│   (D3.js)   │     │  (dataUtils)│     │   Schema    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## State Management

Using **Zustand** with persistence:

```typescript
interface AppStore {
  // Data
  schemas: SemanticSchema[]
  bundles: DataBundle[]
  
  // UI State
  viewMode: 'bundles' | 'schemas' | 'explorer'
  explorerState: {
    selectedBundleId: string | null
    zoomLevel: number
    focusedNodeId: string | null
    breadcrumb: string[]
  }
  
  // Actions
  addBundle, updateBundle, deleteBundle
  addSchema, updateSchema, deleteSchema
  // ... etc
}
```

State persists to localStorage (with size limits on raw data).

## Component Architecture

```
AppLayout
├── Sidebar (navigation)
└── Main Content
    ├── BundleManager
    │   └── BundleCreator (dialog)
    ├── SchemaManager
    │   └── SchemaEditor (dialog)
    └── Explorer
        ├── HierarchyExplorer
        │   ├── TreemapView
        │   └── TreeView
        ├── TabularExplorer
        │   └── ProfileCard
        └── NetworkExplorer
```

## Type System

Core types in `src/types/index.ts`:

- **SemanticSchema** - Defines roles for a data type
- **SemanticRole** - Individual role definition
- **DataBundle** - User's dataset with mappings
- **DataSource** - Raw + parsed data
- **ColumnMapping** - Links source column to role

Visualization-specific types:
- **HierarchyNode** - Tree node with children
- **TabularProfile** - Column statistics
- **NetworkData** - Nodes and edges

## Adding New Data Types

1. **Define the schema** in `src/data/schemas.ts`
2. **Add types** in `src/types/index.ts`
3. **Create transformer** in `src/lib/dataUtils.ts`
4. **Build visualization** in `src/components/app/visualizations/`
5. **Register in Explorer** component

## Visualization Guidelines

Each visualization should:
- Accept `bundle` and `schema` props
- Transform data using `dataUtils` functions
- Handle its own zoom/pan/selection state
- Provide hover details panel
- Support keyboard navigation (future)
