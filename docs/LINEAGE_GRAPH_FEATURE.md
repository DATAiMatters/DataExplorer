# Lineage Graph Visualization Feature

## Overview

The Lineage Graph visualization provides an interactive, force-directed graph view of data relationships in DataExplorer. It automatically visualizes the connections between bundles, virtual bundles, schemas, and joins.

## What It Shows

The lineage graph displays three types of nodes:

### Node Types

1. **Bundle** (Green/Emerald)
   - Represents uploaded data bundles
   - Shows source datasets
   - Size scales with number of connections

2. **Virtual Bundle** (Violet/Purple)
   - Represents joined datasets
   - Created from join operations
   - Connected to source bundles

3. **Schema** (Amber/Orange)
   - Represents semantic schemas
   - Shows which bundles use which schemas
   - Central to data type definitions

### Edge Types

1. **Join** (Blue)
   - Connects two bundles involved in a join
   - Shows join relationships
   - Directional (left → right)

2. **Derived From** (Pink)
   - Connects virtual bundles to their source bundles
   - Shows data lineage
   - Multiple sources possible

3. **Uses Schema** (Gray)
   - Connects bundles to their semantic schemas
   - Shows schema application
   - All bundles have this connection

## How to Use

### Accessing the Graph

1. Navigate to **Relationships** in the sidebar (GitBranch icon)
2. Click the **Lineage Graph** tab
3. The graph renders automatically based on your current bundles and joins

### Interactions

**Zoom & Pan**
- Scroll to zoom in/out
- Click and drag background to pan
- Use zoom controls (top-right) for precise control

**Node Manipulation**
- Click and drag any node to reposition
- Nodes will maintain new position temporarily
- Release to let physics simulation take over

**Hover Information**
- Hover over nodes to see details:
  - Node label and type
  - Description (if available)
  - Row count (for bundles)
  - Data type (for schemas)

**Physics Controls**
- **Link Strength** (0.1-1.0): How strongly connected nodes pull together
  - Lower = more spread out
  - Higher = more clustered
- **Repulsion** (100-1500): How strongly nodes push apart
  - Lower = nodes closer together
  - Higher = more spacing

### Empty State

If no bundles or joins exist, you'll see:
- GitBranch icon
- Message: "No Data Lineage Yet"
- Instructions to create bundles and joins

## Use Cases

### 1. Understanding Data Flow

**Scenario:** You have multiple joined datasets and want to see how data flows.

**Steps:**
1. Open Lineage Graph
2. Observe the network structure
3. Trace paths from source bundles → virtual bundles
4. Identify which schemas are used where

**Insights:**
- Which bundles feed into which virtual bundles
- Schema reuse across bundles
- Data transformation chains

### 2. Impact Analysis

**Scenario:** You want to know what's affected if you delete a bundle.

**Steps:**
1. Locate the bundle node in the graph
2. Follow outgoing edges (joins, derivations)
3. See all dependent virtual bundles

**Insights:**
- Downstream impacts of changes
- Bundles with many dependents
- Isolated vs. interconnected data

### 3. Schema Usage Patterns

**Scenario:** Understand which schemas are most used.

**Steps:**
1. Find schema nodes (amber/orange)
2. Count incoming "uses schema" edges
3. Larger schemas = more connections

**Insights:**
- Most popular data types
- Schema standardization level
- Schema coverage gaps

### 4. Join Complexity

**Scenario:** Visualize join complexity.

**Steps:**
1. Look for clusters of interconnected nodes
2. Count join edges (blue)
3. Trace multi-hop joins

**Insights:**
- Simple vs. complex join patterns
- Potential performance bottlenecks
- Join chain depth

## Technical Details

### D3.js Implementation

The graph uses D3.js force simulation with the following forces:

- **Force Link**: Connects related nodes with configurable strength
- **Force Many-Body**: Repels nodes from each other (charge)
- **Force Center**: Keeps graph centered in viewport
- **Force Collision**: Prevents node overlap

### Node Sizing

Node radius scales with degree (number of connections):
- Domain: [0, max_degree]
- Range: [8px, 24px]
- Scale type: Square root (sqrt)

This makes highly connected nodes visually prominent.

### Color Scheme

**Node Colors:**
- Bundle: `#10b981` (emerald-500)
- Virtual Bundle: `#8b5cf6` (violet-500)
- Schema: `#f59e0b` (amber-500)

**Edge Colors:**
- Join: `#3b82f6` (blue-500)
- Derived From: `#ec4899` (pink-500)
- Uses Schema: `#6b7280` (gray-500)

### Performance

The graph is optimized for datasets with:
- **Bundles:** Up to ~100
- **Virtual Bundles:** Up to ~50
- **Schemas:** ~10-15
- **Total Edges:** Up to ~500

For larger graphs, consider:
- Increasing repulsion to reduce density
- Decreasing link strength to spread nodes
- Filtering to show subset of data

## Integration with Existing Features

### Joins Manager

When you create a join in the **Data Joins** tab:
1. A `JoinDefinition` is created
2. A `VirtualBundle` is created
3. The lineage graph updates automatically
4. New edges appear: join + derived_from

### Sample Data

The sample datasets (SAP Functional Locations & Equipment) automatically create a lineage graph:
1. Load sample data → 2 bundles created
2. Auto-create join → 1 virtual bundle + 1 join
3. View lineage graph → See 5 nodes:
   - 2 bundle nodes
   - 1 virtual bundle node
   - 2 schema nodes (tabular schema used twice)
   - 5 edges:
     - 2 "uses schema" edges (bundles → schema)
     - 1 "join" edge (left → right bundle)
     - 2 "derived from" edges (bundles → virtual bundle)
     - 1 "uses schema" edge (virtual bundle → schema)

### Data Explorer

When you select a virtual bundle in Explorer:
- Data is computed by executing the join
- Lineage graph shows where it comes from
- Trace back to source bundles

## Future Enhancements

### Planned Features

1. **Node Filtering**
   - Show/hide node types
   - Filter by schema
   - Search by name

2. **Path Highlighting**
   - Click a node to highlight paths
   - Show upstream/downstream only
   - Trace specific data flows

3. **Layout Algorithms**
   - Hierarchical layout (top-down)
   - Radial layout (circular)
   - Tree layout (for hierarchies)

4. **Export Capabilities**
   - Export graph as SVG
   - Export as PNG image
   - Export to JSON for analysis

5. **Circular Dependency Detection**
   - Visual warning for cycles
   - Highlight problematic paths
   - Suggest fixes

6. **Statistics Panel**
   - Graph metrics (diameter, density)
   - Centrality measures
   - Clustering coefficients

7. **Cognee Integration**
   - Export to Cognee knowledge graph
   - Enhanced semantic search
   - AI-powered relationship discovery

### Known Limitations

1. **Large Graphs:** Performance degrades with >200 nodes
2. **Complex Joins:** Multiple joins between same bundles show single edge
3. **Labels:** Long labels can overlap at high zoom levels
4. **Mobile:** Best viewed on desktop (touch interactions limited)

## Troubleshooting

### Graph Appears Empty

**Problem:** Lineage graph shows "No Data Lineage Yet"

**Solutions:**
1. Create at least one data bundle
2. The graph requires bundles to show anything
3. Try loading sample data (Relationships → Data Joins → Load Sample Data)

### Nodes Are Too Clustered

**Problem:** All nodes bunched together in center

**Solutions:**
1. Increase **Repulsion** slider (try 1000+)
2. Decrease **Link Strength** slider (try 0.2-0.3)
3. Drag nodes apart manually
4. Click **Reset Zoom** to recenter

### Can't See Node Labels

**Problem:** Text is too small or overlapping

**Solutions:**
1. Zoom in using scroll or zoom controls
2. Drag nodes to separate overlapping labels
3. Hover over nodes to see full details in tooltip

### Graph Keeps Moving

**Problem:** Graph won't settle, keeps animating

**Solutions:**
1. Wait for simulation to stabilize (~5 seconds)
2. Drag a node to restart physics simulation
3. Physics forces are working as intended
4. Graph settles when alpha (energy) reaches minimum

### Performance Issues

**Problem:** Graph is slow or choppy

**Solutions:**
1. Reduce number of bundles/joins
2. Delete unused virtual bundles
3. Increase repulsion to spread nodes (less overlap calculations)
4. Close other browser tabs

## Related Documentation

- [LINEAGE_FEATURE.md](./LINEAGE_FEATURE.md) - Overall lineage feature overview
- [JOIN_EXECUTION.md](./JOIN_EXECUTION.md) - How joins work
- [USER_GUIDE_JOINS.md](./USER_GUIDE_JOINS.md) - Join creation guide
- [LINEAGE_API.md](./LINEAGE_API.md) - Developer API reference

## Code Reference

**Main Component:** [src/components/app/visualizations/LineageGraphExplorer.tsx](../src/components/app/visualizations/LineageGraphExplorer.tsx)

**Lineage Graph Class:** [src/lib/lineageGraph.ts](../src/lib/lineageGraph.ts)

**Types:** [src/types/index.ts](../src/types/index.ts) (LineageNode, LineageEdge)

**Integration:** [src/components/app/RelationshipManager.tsx](../src/components/app/RelationshipManager.tsx) (Lineage tab)

---

*Created: 2026-01-16*
*Feature added in version: 0.4.0*
