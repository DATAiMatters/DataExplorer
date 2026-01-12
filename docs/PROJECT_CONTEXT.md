# Project Context & Decision Log

This document captures the purpose, design decisions, and rationale behind Data Explorer to maintain continuity across development sessions.

**Author:** Pedro Cardoso - The Data Ninja
📧 mrtechie@gmail.com | 💼 [LinkedIn](https://www.linkedin.com/in/thedataninja/) | 🔗 [Linktree](https://linktr.ee/thedataninja)
**Last Updated:** January 11, 2026

## Project Purpose

**Data Explorer** is a tool for visualizing and exploring complex datasets through immersive, spatial navigation - going beyond traditional grids and dashboards. The primary use cases are:

1. **FLOC Hierarchies** - Functional Location hierarchies from ERP systems (SAP PM, Maximo, etc.) representing plant/equipment structures
2. **Organizational Data** - Org charts, cost centers, reporting structures
3. **Process Networks** - Business process relationships and data flows
4. **General Data Profiling** - Understanding the shape and quality of any tabular dataset

The target users are data analysts and engineers who need to explore and understand data structures before building reports or integrations.

## Core Design Decisions

### 1. Semantic Schema System

**Decision:** Use a flexible mapping layer between raw data and visualizations.

**Why:** 
- Users have different column names (e.g., "FLOC_CODE" vs "functional_location" vs "asset_id")
- Same visualization logic should work regardless of source naming
- Allows custom schemas for domain-specific needs

**How it works:**
- Schema defines "roles" (node_id, parent_id, metric, etc.)
- User maps their columns to these roles
- Visualization components consume normalized data

### 2. Three Data Types (Hierarchy, Tabular, Network)

**Decision:** Support three fundamental data structures rather than trying to auto-detect.

**Why:**
- Clear mental model for users
- Each type has distinct visualization needs
- Covers 90% of data exploration use cases

**Future consideration:** Could add Time Series as a fourth type.

### 3. Data Bundles

**Decision:** Package data + mappings + metadata together as a "bundle."

**Why:**
- Self-contained and portable
- Can reload with new data while preserving mappings
- Enables future features like sharing configurations

### 4. Browser-Based with Local Storage

**Decision:** Pure client-side app with localStorage persistence.

**Why:**
- No server infrastructure needed
- Data stays on user's machine (privacy)
- Easy to deploy as single HTML file
- Good enough for datasets up to ~50k rows

**Trade-off:** Large datasets (100k+ rows) may hit localStorage limits or performance issues.

### 5. Build from Scratch (No Pre-built Viz Libraries)

**Decision:** Use D3.js directly rather than chart libraries like Recharts, Victory, etc.

**Why:**
- Full control over interactions (drill-down, zoom, pan)
- Custom visualizations not available in standard libraries
- Learning/skill building goal
- Avoid library lock-in

**Trade-off:** More code to write and maintain.

## Visualization Decisions

### Hierarchy View

**Treemap:**
- Good for seeing relative sizes (e.g., maintenance costs by area)
- Click to drill down into children
- Color by depth for visual hierarchy

**Tree (Dendrogram):**
- Good for seeing structure and relationships
- Horizontal (left→right) for wide trees
- Vertical (top→down) for org-chart style
- Added after initial treemap based on user feedback

### Tabular View

**Data Profiling Cards:**
- Per-column statistics rather than showing raw data
- Type detection (string, number, date, boolean)
- Completeness and uniqueness metrics
- Top values for categorical fields

**Data Grid View:**
- Added as secondary view via "View Data" button
- Sortable columns (click headers)
- Global search across all columns
- Uses TanStack Table for performance
- Easy toggle back to profiling view

### Network View

**Force-Directed Graph:**
- Standard approach for relationship data
- Interactive physics (adjustable forces)
- Node sizing by degree (connection count)

## Technical Decisions

### Tech Stack

| Choice | Alternatives Considered | Rationale |
|--------|------------------------|-----------|
| React + TypeScript | Vue, Svelte | Team familiarity, ecosystem |
| Vite | CRA, Next.js | Fast dev server, simple config |
| Tailwind + shadcn/ui | Material UI, Chakra | Customizable, good dark theme |
| Zustand | Redux, Jotai | Simple API, built-in persistence |
| D3.js | Recharts, Visx | Full control for custom viz |
| TanStack Table | AG Grid, react-data-grid | Headless, lightweight, flexible |
| Papaparse | csv-parse, Papa | Battle-tested, browser-friendly |

### State Management

- All app state in single Zustand store
- Persisted to localStorage (excluding large raw data blobs in future)
- Explorer state (zoom, breadcrumb, etc.) kept separate for easy reset

### File Structure

```
components/app/     → Business logic, application-specific
components/ui/      → Reusable UI primitives (shadcn)
lib/                → Pure functions, utilities
store/              → State management
types/              → TypeScript definitions
data/               → Static data (default schemas)
```

## Features Added During Development

1. **Initial build:** Bundle manager, schema manager, hierarchy treemap
2. **Tabular profiling:** Column statistics with search/sort
3. **Network graph:** Force-directed with adjustable physics
4. **Tree view:** Alternative to treemap for hierarchy
5. **Tree orientation:** Horizontal and vertical layouts
6. **Reload data:** Update bundle with new file, preserve mappings
7. **Data grid view:** Sortable, searchable table view for tabular data using TanStack Table
8. **Data quality scoring:** Automated quality assessment (0-100 score) for each column with:
   - Completeness check (40% weight) - detects high null rates
   - Consistency check (30% weight) - identifies low cardinality and statistical outliers
   - Validity check (30% weight) - finds format inconsistencies in string data
   - Visual quality badges on profile cards (green ≥80, amber ≥60, red <60)
   - Overall quality score in TabularExplorer header
   - Expandable issues section showing detected problems with severity levels
9. **Network node grouping:** Color-coded nodes by category/domain with:
   - Support for node_group column mapping in schema
   - Automatic color assignment using D3 categorical color scale (Tableau10)
   - Legend showing all groups and their colors
   - Group display in node hover tooltip

## Known Limitations

1. **Performance:** Not optimized for very large datasets (>50k rows)
2. **Storage:** localStorage has ~5-10MB limit
3. **No database connections:** File upload only (Phase 1)
4. **Single user:** No collaboration features
5. **No undo:** Destructive actions are immediate

## Roadmap / Future Ideas

### Near-term
- [ ] Export visualizations as images (PNG/SVG)
- [ ] Edit bundle mappings after creation
- [ ] Duplicate/clone bundles
- [ ] Keyboard navigation

### Medium-term
- [ ] Database connectors (PostgreSQL, MySQL)
- [ ] Neo4j integration for graph data
- [ ] Multi-file joins (attach metrics to hierarchy)
- [ ] Time series data type

### Long-term
- [ ] Collaborative features (share bundles)
- [ ] Embedded mode (iframe in other apps)
- [ ] Plugin system for custom visualizations

## Development Notes

### Testing Approach
Currently manual testing with sample files. Automated tests would be valuable for:
- Data transformation functions (unit tests)
- Store actions (integration tests)
- Visual regression (screenshot tests)

### Sample Data
The `/public/samples/` folder contains test files:
- `floc-hierarchy.csv` - Plant equipment hierarchy
- `work-orders.csv` - Maintenance work orders
- `process-network.csv` - Business process relationships

These mirror real-world data structures from ERP systems.

---

*Last updated: January 11, 2026 by Pedro Cardoso*
