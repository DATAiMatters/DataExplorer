# Data Explorer

An immersive data visualization tool for exploring hierarchical, tabular, and network datasets. Built with React, TypeScript, D3.js, and Tailwind CSS.

## Features

### 🗂️ Multiple Data Types

- **Hierarchy** - Visualize tree-structured data (org charts, FLOC hierarchies, folder structures)
  - Treemap view for seeing relative sizes
  - Tree view with horizontal (left→right) or vertical (top→down) layouts
  - Drill-down navigation with breadcrumbs
  - Metric display on nodes

- **Tabular** - Profile and explore flat datasets
  - Per-column statistics (completeness, uniqueness, null counts)
  - Automatic type detection (string, number, date, boolean)
  - Top values for categorical fields
  - Numeric statistics (min, max, mean, median, std dev)

- **Network** - Visualize graph/relationship data
  - Force-directed layout
  - Interactive node dragging
  - Adjustable physics (link strength, repulsion)
  - Zoom and pan controls

### 🔧 Flexible Schema System

- **Semantic Schemas** define the structure for each data type
- **Column Mapping** lets you map any CSV/JSON columns to semantic roles
- **Custom Display Names** for user-friendly labels
- Create custom schemas or modify the defaults

### 📦 Data Bundle Management

- Upload CSV or JSON files
- Auto-detect columns and suggest mappings
- Reload bundles with new data (preserves mappings)
- Export/import configuration
- Local storage persistence

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/data-explorer.git
cd data-explorer

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Build for Production

```bash
pnpm build
```

The built files will be in the `dist/` directory.

### Bundle as Single HTML File

For easy sharing/embedding:

```bash
pnpm bundle
```

This creates `bundle.html` - a self-contained single-file app.

## Project Structure

```
data-explorer/
├── src/
│   ├── components/
│   │   ├── app/                    # Application components
│   │   │   ├── AppLayout.tsx       # Main layout wrapper
│   │   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   │   ├── BundleManager.tsx   # Data bundle CRUD
│   │   │   ├── SchemaManager.tsx   # Schema editing
│   │   │   ├── Explorer.tsx        # Visualization router
│   │   │   └── visualizations/
│   │   │       ├── HierarchyExplorer.tsx  # Treemap + Tree views
│   │   │       ├── TabularExplorer.tsx    # Data profiling
│   │   │       └── NetworkExplorer.tsx    # Force-directed graph
│   │   └── ui/                     # shadcn/ui components
│   ├── data/
│   │   └── schemas.ts              # Default semantic schemas
│   ├── lib/
│   │   ├── utils.ts                # Utility functions
│   │   └── dataUtils.ts            # Data parsing & transformation
│   ├── store/
│   │   └── index.ts                # Zustand state management
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                   # Tailwind + theme variables
├── public/
│   └── samples/                    # Sample data files
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

## Usage

### 1. Create a Data Bundle

1. Click **"New Bundle"** in the Data Bundles view
2. Upload a CSV or JSON file
3. Enter a name and select a schema type (Hierarchy, Tabular, or Network)
4. Map your columns to semantic roles
5. Click **"Create Bundle"**

### 2. Explore Your Data

1. Click **"Explore"** on any bundle card
2. Use the visualization controls:
   - **Hierarchy**: Toggle between Treemap/Tree views, switch orientation
   - **Tabular**: Search and sort columns, view statistics
   - **Network**: Drag nodes, adjust physics, zoom/pan

### 3. Reload Data

- Click the refresh icon on a bundle card, or
- Click **"Reload Data"** in the Explorer header
- Upload a new file - mappings are preserved for matching columns

### 4. Customize Schemas

1. Go to **Semantic Schemas** view
2. Edit existing schemas or create new ones
3. Define roles with:
   - ID (used for mapping)
   - Display name
   - Description
   - Required/optional flag
   - Data type hint

## Sample Data

The `public/samples/` directory includes example files:

- `floc-hierarchy.csv` - Plant/equipment hierarchy with maintenance costs
- `work-orders.csv` - Maintenance work orders (tabular)
- `process-network.csv` - Business process relationships (network)

## Configuration

### Semantic Roles

Each schema type has predefined roles:

**Hierarchy:**
| Role | Required | Description |
|------|----------|-------------|
| `node_id` | Yes | Unique identifier for each node |
| `node_label` | No | Display name for the node |
| `parent_id` | Yes | Reference to parent node |
| `metric` | No | Numeric values (multiple allowed) |

**Tabular:**
| Role | Required | Description |
|------|----------|-------------|
| `row_id` | No | Unique row identifier |
| `category` | No | Categorical fields (multiple) |
| `measure` | No | Numeric fields (multiple) |
| `timestamp` | No | Date/time field |
| `text` | No | Free-form text (multiple) |

**Network:**
| Role | Required | Description |
|------|----------|-------------|
| `source_node` | Yes | Edge source |
| `target_node` | Yes | Edge target |
| `edge_weight` | No | Relationship strength |
| `edge_label` | No | Relationship type |

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **D3.js** - Visualizations
- **Zustand** - State management
- **Papaparse** - CSV parsing

## Roadmap

- [ ] Database connectors (PostgreSQL, MySQL)
- [ ] Multi-file joins for attached metrics
- [ ] Additional visualizations (sunburst, icicle, sankey)
- [ ] Data quality scoring
- [ ] Export visualizations as images
- [ ] Collaborative features

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.
