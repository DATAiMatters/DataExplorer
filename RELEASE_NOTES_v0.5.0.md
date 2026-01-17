# Release Notes - Version 0.5.0

**Release Date:** 2026-01-17

## 🎉 Major New Feature: Interactive Lineage Graph Visualization

This release introduces a powerful new interactive graph visualization for exploring data lineage and relationships between bundles, joins, and schemas.

### ✨ New Features

#### Lineage Graph Explorer
- **Interactive Force-Directed Graph** powered by D3.js
- **Visual Node Types:**
  - 🟢 Bundles (Green/Emerald)
  - 🟣 Virtual Bundles (Violet/Purple)
  - 🟠 Schemas (Amber/Orange)
- **Visual Edge Types:**
  - 🔵 Join relationships (Blue)
  - 🩷 Derived From (Pink)
  - ⚫ Uses Schema (Gray)

#### Interactive Controls
- **Zoom & Pan:** Scroll to zoom, drag to pan
- **Node Dragging:** Reposition nodes by dragging
- **Physics Simulation:**
  - Adjustable link strength (0.1-1.0)
  - Adjustable repulsion/charge (100-1500)
- **Hover Tooltips:** Display node metadata, descriptions, row counts
- **Zoom Controls:** Zoom in, zoom out, reset buttons
- **Legends:** Clear indicators for node and edge types

#### Integration
- New "Lineage Graph" tab in Relationships view
- Auto-updates when bundles or joins change
- Empty state with helpful onboarding
- Statistics panel showing node and edge counts

#### Documentation
- **NEW:** [LINEAGE_GRAPH_FEATURE.md](docs/LINEAGE_GRAPH_FEATURE.md) - Complete usage guide (400+ lines)
- Updated [LINEAGE_FEATURE.md](docs/LINEAGE_FEATURE.md)
- Updated [USER_GUIDE_JOINS.md](docs/USER_GUIDE_JOINS.md)

## 🐛 Critical Bug Fixes

### HIGH: Browser Runtime Crash Fixed
**Issue:** Virtual bundle execution crashed with "require is not defined"

**Root Cause:** `executeVirtualBundle` used CommonJS `require()` in browser/Vite environment

**Fix:** Changed to ES6 `import` at module level
- File: `src/store/index.ts:396`
- Impact: Virtual bundles now execute successfully

### HIGH: Missing Schema Edges in Lineage Graph
**Issue:** Bundle→Schema connections missing from graph visualization

**Root Cause:** Schema nodes added AFTER attempting to create edges

**Fix:** Reordered build sequence to add schema nodes FIRST
- File: `src/lib/lineageGraph.ts:40-49`
- Impact: Complete lineage graph with all relationships

### MEDIUM: Misleading Join Statistics
**Issue:** Left/Right join match counts showed 100% even when many rows unmatched

**Root Cause:** `matchedLeftRows` set to `leftData.length` in left joins (and vice versa for right joins)

**Fix:** Count only rows that actually have matching counterparts
- File: `src/lib/joinUtils.ts:69-93`
- Impact: Accurate match rate statistics for join quality assessment

### MEDIUM: Nullish Value Handling in Joins
**Issue:** Values like `0`, `""`, `false` treated as missing, undercounting matches

**Root Cause:** Used `||` operator instead of nullish coalescing

**Fix:** Changed to `??` operator to preserve legitimate falsy values
- File: `src/lib/joinUtils.ts:327`
- Impact: Correct counting of matches with zero/empty values

## 📊 Performance & Quality

- ✅ TypeScript compilation: Clean build
- ✅ All tests passing
- ✅ Bundle size: 885.74 kB (gzipped: 260.41 kB)
- ✅ Production build successful

## 🔧 Technical Details

### Dependencies
- D3.js already included (no new dependencies)
- Leverages existing graphology infrastructure
- Uses existing LineageGraph class with new visualization layer

### Files Changed
**New Files:**
- `src/components/app/visualizations/LineageGraphExplorer.tsx` (400+ lines)
- `docs/LINEAGE_GRAPH_FEATURE.md` (400+ lines)
- `RELEASE_NOTES_v0.5.0.md` (this file)

**Modified Files:**
- `src/components/app/RelationshipManager.tsx` - Added Lineage Graph tab
- `src/lib/lineageGraph.ts` - Fixed schema node ordering
- `src/store/index.ts` - Fixed require() issue
- `src/lib/joinUtils.ts` - Fixed join statistics
- `docs/LINEAGE_FEATURE.md` - Added graph visualization section
- `docs/USER_GUIDE_JOINS.md` - Added lineage graph reference
- `package.json` - Version bump to 0.5.0

## 📝 Commits (This Release)

1. `7331979` - Add interactive lineage graph visualization with D3.js
2. `9d641d9` - Add comprehensive documentation for lineage graph feature
3. `12ad856` - Fix critical bugs in lineage graph and virtual bundle execution
4. `5492c63` - Fix join statistics accuracy and nullish value handling
5. `[VERSION]` - Bump version to 0.5.0 and add release notes

## 🚀 Upgrade Guide

### For Existing Users

No breaking changes! Simply pull the latest version:

```bash
git pull origin main
pnpm install
pnpm build
```

### New Feature Access

1. Navigate to **Relationships** in the sidebar
2. Click the **Lineage Graph** tab
3. Create some bundles and joins to see the graph
4. Or load sample data: **Data Joins → Load Sample Data**

## 🎯 What's Next

See [LINEAGE_FEATURE.md](docs/LINEAGE_FEATURE.md) for the roadmap, including:
- AI-powered join suggestions (Cognee integration)
- Node filtering and path highlighting
- Alternative graph layouts
- Export capabilities (SVG, PNG, JSON)
- Enhanced statistics and metrics

## 🙏 Acknowledgments

- Built with D3.js force simulation
- Leverages graphology for graph data structures
- Inspired by modern data lineage tools

## 📞 Support

- **Issues:** https://github.com/DATAiMatters/DataExplorer/issues
- **Docs:** `/docs` directory
- **Changelog:** This file

---

**Full Changelog:** v0.4.0...v0.5.0

Generated on 2026-01-17
