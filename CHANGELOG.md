# Changelog

All notable changes to DataExplorer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-01-17

### Added
- **Interactive Lineage Graph Visualization** - New D3.js-powered force-directed graph
  - Visual representation of data lineage (datasets, joins, schemas)
  - Interactive controls: zoom, pan, drag nodes
  - Adjustable physics simulation parameters
  - Hover tooltips with node metadata
  - Color-coded nodes and edges by type
  - Integrated as "Lineage Graph" tab in Relationships view
- Comprehensive documentation for lineage graph feature
  - New `LINEAGE_GRAPH_FEATURE.md` with usage guide
  - Updated `LINEAGE_FEATURE.md` and `USER_GUIDE_JOINS.md`

### Fixed
- **CRITICAL:** Virtual dataset execution crash - replaced `require()` with ES6 `import`
- **CRITICAL:** Missing dataset→schema edges in lineage graph - reordered node creation
- **IMPORTANT:** Misleading join statistics for left/right joins - now counts actual matches
- **IMPORTANT:** Nullish value handling in joins - changed `||` to `??` for correct zero/empty handling

### Changed
- Schema nodes now created before dataset→schema edges in lineage graph
- Join statistics now accurately reflect match rates for all join types

## [0.4.0] - 2026-01-16

### Added
- SAP PM sample datasets for join feature
  - Fast Food Functional Locations (30 FLOCs)
  - Fast Food Equipment Assets (43 items)
  - "Load Sample Data" button in Data Joins tab
  - Auto-create join option for sample data
  - Comprehensive sample data documentation
- Sample datasets identified with blue "SAMPLE" badge

### Fixed
- Sample data visibility improvements
- Navigation improvements after loading samples

### Changed
- Enhanced user experience for sample data loading
- Improved messaging and discoverability

## [0.3.0] - 2026-01-15

### Added
- Complete Join & Lineage feature (Phase 1-2)
  - Join Builder with visual interface
  - Join execution engine (inner, left, right, full outer)
  - Derived datasets (on-demand join execution)
  - Lineage graph infrastructure (graphology-based)
  - JoinsManager for managing join definitions
- Comprehensive join documentation
  - `USER_GUIDE_JOINS.md` - User guide
  - `JOIN_EXECUTION.md` - Technical details
  - `LINEAGE_API.md` - Developer API
  - `LINEAGE_FEATURE.md` - Feature overview

### Features
- Semantic role-based joins (not column names)
- Test Join before creating
- Join statistics (match rates, unmatched counts)
- Visual flow diagrams for joins
- Cascade delete warnings
- Column prefixing to avoid conflicts

## [0.2.0] - Earlier

### Added
- Relationship Types management
- AI Settings configuration
- Journal feature
- Multiple visualization types
- Schema management

## [0.1.0] - Initial Release

### Added
- Core data exploration features
- Hierarchical data visualization
- Tabular data profiling
- Dataset management
- Schema system
- Dark theme UI

---

[0.5.0]: https://github.com/DATAiMatters/DataExplorer/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/DATAiMatters/DataExplorer/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/DATAiMatters/DataExplorer/compare/v0.2.0...v0.3.0
