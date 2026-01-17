# Semantic Join & Lineage Feature

## Status: Phase 1-2 Complete ✅ | Phase 3 In Progress

This document describes the semantic join and data lineage feature, its current implementation, and roadmap.

**Quick Links:**
- [User Guide](./USER_GUIDE_JOINS.md) - How to use joins (for end users)
- [Technical Details](./JOIN_EXECUTION.md) - How joins work internally
- [API Reference](./LINEAGE_API.md) - Developer API documentation

## What We Built (Phase 1 Foundation)

### Core Capabilities

1. **Join Definitions**
   - Define relationships between data bundles
   - Uses semantic roles (not raw column names)
   - Supports: inner, left, right, full outer joins
   - Multiple join conditions per relationship
   - Stored in Zustand state, persisted to localStorage

2. **Virtual Bundles**
   - Derived datasets defined by joins
   - Don't store data (like SQL views)
   - Reference join definitions for lazy execution
   - Can be explored like regular bundles

3. **Lineage Graph**
   - Built using graphology library
   - Tracks data flow: bundles → joins → virtual bundles
   - Schema relationships: bundles use schemas
   - Query capabilities:
     - Upstream analysis: "What feeds this bundle?"
     - Downstream impact: "What depends on this bundle?"
     - Path finding: "How does data flow from A to B?"
     - Circular dependency detection

4. **Future-Ready Architecture**
   - Designed for Cognee integration
   - Export graph in Cognee-compatible format
   - Placeholder for AI-powered join suggestions
   - Scalable to 1000s of nodes client-side

### Technical Implementation

```typescript
// Example: Creating a join
const join: JoinDefinition = {
  id: 'join-001',
  name: 'Customer Orders Join',
  leftBundleId: 'customers-bundle',
  rightBundleId: 'orders-bundle',
  joinType: 'inner',
  conditions: [
    {
      leftRoleId: 'customer_id',    // Semantic role from customer schema
      rightRoleId: 'customer_id',   // Semantic role from order schema
      operator: '='
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Add to store
const addJoin = useAppStore(s => s.addJoin);
addJoin(join);

// Query lineage
const getUpstreamBundles = useAppStore(s => s.getUpstreamBundles);
const upstream = getUpstreamBundles('my-bundle-id');
// Returns all bundles that feed into 'my-bundle-id'

// Build full lineage graph
const getLineageGraph = useAppStore(s => s.getLineageGraph);
const lineage = getLineageGraph();
const stats = lineage.getStats();
// { totalNodes: 10, bundles: 5, virtualBundles: 2, schemas: 8, hasCircularDeps: false }
```

### Data Structures

**Join Definition:**
```typescript
interface JoinDefinition {
  id: string;
  name: string;
  description?: string;
  leftBundleId: string;
  rightBundleId: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  conditions: JoinCondition[];
  createdAt: string;
  updatedAt: string;
}
```

**Virtual Bundle:**
```typescript
interface VirtualBundle {
  id: string;
  name: string;
  description?: string;
  type: 'join' | 'union' | 'filter';
  sourceJoinIds: string[];   // References to JoinDefinitions
  schemaId: string;          // Resulting schema after join
  createdAt: string;
  updatedAt: string;
}
```

**Lineage Graph:**
```typescript
class LineageGraph {
  // Build from app state
  static build(bundles, joins, virtualBundles, schemas): LineageGraph

  // Query methods
  getUpstreamBundles(bundleId): LineageNode[]
  getDownstreamBundles(bundleId): LineageNode[]
  findPath(sourceId, targetId): string[] | null
  hasCircularDependencies(): boolean

  // Export
  exportForVisualization(): { nodes, edges }  // For D3
  exportToCogneeFormat(): CogneeGraph        // For AI
}
```

## What We Built (Phase 2 - UI) ✅

### 1. Join Builder Interface
**Location:** `src/components/app/JoinBuilder.tsx`

**Features Implemented:**
- ✅ Visual join builder with bundle selection
- ✅ All 4 join types (inner/left/right/full) with tooltips
- ✅ Semantic role mapping with auto-suggestions
- ✅ Test join feature with detailed statistics
- ✅ Source column visibility in dropdowns
- ✅ Real-time join execution and validation
- ✅ Comprehensive error handling

**Mock UI:**
```
┌─────────────────────────────────────────────────┐
│ Join Builder                                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Customer Bundle]  ──→  [Join]  ←──  [Orders] │
│                            ↓                    │
│                      Customer Orders            │
│                                                 │
│  Join Type: [Inner ▼]                          │
│                                                 │
│  Conditions:                                    │
│  ┌──────────────────────────────────────────┐ │
│  │ customers.customer_id = orders.customer_id│ │
│  └──────────────────────────────────────────┘ │
│                                                 │
│  Preview: 1,234 rows                           │
│  [Create Join]  [Cancel]                       │
└─────────────────────────────────────────────────┘
```

### 2. Lineage Visualization
**Location:** Enhance `src/components/app/visualizations/NetworkExplorer.tsx`

**Features:**
- Add "Lineage Mode" toggle to network view
- Show bundles and virtual bundles as nodes
- Show joins as edges
- Color coding:
  - Blue: Regular bundles
  - Green: Virtual bundles
  - Gray: Schemas
- Highlight upstream/downstream on hover
- Click node to see details
- Zoom/pan/filter

**Visual Example:**
```
        [Customers DB]
              │
              ↓ (inner join)
        [Customer Orders] ← Virtual Bundle
              │
              ↓ (left join)
        [Orders + Products]
              │
              ↓
        [Sales Dashboard]
```

### 2. Joins Management UI ✅
**Location:** `src/components/app/JoinsManager.tsx` + `RelationshipManager.tsx`

**Features Implemented:**
- ✅ List all joins with visual flow diagrams
- ✅ Delete joins with cascade warnings
- ✅ Show join metadata and conditions
- ✅ Display dependent virtual bundles
- ✅ Quick actions: "View in Explorer"
- ✅ Tabbed interface (Relationship Types | Data Joins)
- ✅ Row count displays for source bundles
- ✅ "Load Sample Data" button for instant SAP PM datasets

### 3. Join Execution Engine ✅
**Location:** `src/lib/joinUtils.ts` + `src/store/index.ts`

**Features Implemented:**
- ✅ In-memory join execution (no SQL)
- ✅ All 4 join types with proper semantics
- ✅ Nested loop algorithm (O(n×m))
- ✅ Semantic role resolution to column names
- ✅ Column prefixing to avoid conflicts
- ✅ Comprehensive statistics tracking
- ✅ Virtual bundle execution on-demand
- ✅ Test join without creating
- ✅ Validation and error handling

### 4. Sample Datasets ✅
**Location:** `public/samples/joins/`

**Datasets Included:**
- ✅ SAP Functional Locations (30 FLOCs for fast food chain)
- ✅ SAP Equipment Assets (43 commercial kitchen equipment items)
- ✅ Pre-configured with semantic mappings
- ✅ One-click load via "Load Sample Data" button
- ✅ Comprehensive documentation with use cases
- ✅ Realistic SAP PM data structure

### 5. Lineage Graph Visualization ✅
**Location:** `src/components/app/visualizations/LineageGraphExplorer.tsx`

**Features Implemented:**
- ✅ Interactive force-directed graph using D3.js
- ✅ Visual representation of data lineage
- ✅ Three node types: Bundles (green), Virtual Bundles (violet), Schemas (amber)
- ✅ Three edge types: Join (blue), Derived From (pink), Uses Schema (gray)
- ✅ Interactive controls:
  - Zoom in/out and pan
  - Drag nodes to reposition
  - Adjustable physics simulation (link strength, repulsion)
- ✅ Hover tooltips with node metadata
- ✅ Legend showing node and edge types
- ✅ Statistics panel (node counts, edge counts)
- ✅ Integrated in Relationships view as "Lineage Graph" tab
- ✅ Empty state with helpful onboarding message

**Documentation:** See [LINEAGE_GRAPH_FEATURE.md](./LINEAGE_GRAPH_FEATURE.md) for detailed usage guide

## What's Next (Phase 3 - Intelligence)

### 1. AI-Powered Join Suggestions

**With Cognee Integration:**
```typescript
// Implement in store
suggestJoins: async () => {
  const state = get();

  // Send bundles to Cognee backend
  const cogneeClient = new CogneeClient(state.aiSettings);

  // Cognee analyzes data and suggests joins
  const suggestions = await cogneeClient.analyzeBundles(state.bundles);

  // Returns:
  // [
  //   {
  //     leftBundleId: 'customers',
  //     rightBundleId: 'orders',
  //     leftRoleId: 'id',
  //     rightRoleId: 'customer_id',
  //     confidence: 0.95,
  //     reason: '95% of customer IDs match, 1:N relationship detected',
  //     dataOverlap: 0.95
  //   }
  // ]

  return suggestions;
}
```

**UI:**
- "Suggest Joins" button in JoinBuilder
- Show AI suggestions with confidence scores
- One-click to create join from suggestion
- Explain why join makes sense

### 2. Data Quality Checks

**Features:**
- Join health dashboard
- Referential integrity checks
- Orphaned record detection
- Cardinality analysis (1:1, 1:N, N:M)
- Data drift alerts

**Example:**
```
Join Health: Customer Orders
├─ Match Rate: 95% (1,234 of 1,299 orders matched)
├─ Orphaned Records: 65 orders with no customer
├─ Cardinality: 1:N (avg 5.2 orders per customer)
└─ Data Quality: ⚠️ Warning - 5% orphaned records
```

### 3. Smart Relationship Detection

**Auto-detect potential joins:**
- Analyze column names and data types
- Find common values between datasets
- Suggest foreign key relationships
- Detect entity resolution opportunities

## Architecture Decisions

### Why Graphology?

1. **Perfect for this use case:**
   - Directed graphs (data flows one direction)
   - Built-in algorithms (shortest path, cycle detection)
   - Lightweight (runs in browser)
   - TypeScript support

2. **Scales well:**
   - 10K+ nodes in browser
   - Lazy graph construction
   - Efficient queries

3. **Future-proof:**
   - Easy to export to graph DB later
   - Compatible with D3 for visualization
   - Can add more algorithms as needed

### Why Semantic Roles?

**Instead of raw column names:**
```typescript
// ❌ Brittle - breaks if column renamed
{
  leftColumn: 'CUSTOMER_ID',
  rightColumn: 'CustID'
}

// ✅ Robust - uses semantic meaning
{
  leftRoleId: 'customer_id',    // From schema
  rightRoleId: 'customer_id'    // From schema
}
```

**Benefits:**
- Column renames don't break joins
- Schema changes are centralized
- AI can understand semantic meaning
- More maintainable

### Why Virtual Bundles?

**Like SQL views, not materialized views:**
- Don't duplicate data (save localStorage space)
- Always fresh (recomputed on demand)
- Can be large (no storage limit)
- Composable (join of joins)

**Trade-off:**
- Slower than pre-computed (acceptable for client-side)
- Can cache if needed (future optimization)

## When to Add Cognee

**Add Cognee backend when:**
1. You want AI-powered join suggestions
2. You need semantic search across bundles
3. You want automatic entity resolution
4. You have >10 bundles and manual joins are tedious

**Without Cognee, you still get:**
- Manual join builder
- Lineage visualization
- Upstream/downstream queries
- Virtual bundles
- Data quality checks

## Performance Considerations

**Current Limits (Client-Side):**
- **Bundles:** 100-1000 (localStorage limit)
- **Joins:** 50-200 (graph complexity)
- **Virtual Bundles:** 20-50 (computation time)
- **Lineage Graph:** 1000+ nodes (graphology handles it)

**Future Optimizations:**
- Memoize lineage graph (rebuild only on changes)
- Lazy load virtual bundle data
- Worker thread for graph computation
- IndexedDB for larger datasets

## Example Use Cases

### Use Case 1: Sales Analysis
```
[Customers] ─(inner join)→ [Customer Orders] ─(left join)→ [Order Products]
                                   ↓
                          [Sales by Customer Report]
```

### Use Case 2: Equipment Hierarchy + Maintenance
```
[FLOC Hierarchy] ─(derived from)→ [Equipment Tree]
       ↓
[Maintenance Orders] ─(joined with)→ [Equipment + Maintenance]
       ↓
[Downtime Analysis Dashboard]
```

### Use Case 3: Cross-Dataset Search
```
User searches: "pump failure"

Lineage graph knows:
- Equipment bundle has "pump" entities
- Maintenance bundle has "failure" events
- They're joined by equipment_id

→ Show relevant records from both bundles
```

## Files Overview

```
src/
├── types/index.ts
│   └── JoinDefinition, VirtualBundle, LineageNode, etc.
├── lib/
│   └── lineageGraph.ts
│       └── LineageGraph class
├── store/index.ts
│   ├── joins: JoinDefinition[]
│   ├── virtualBundles: VirtualBundle[]
│   └── Actions: addJoin, getUpstreamBundles, etc.
└── components/app/
    ├── JoinBuilder.tsx          (TODO)
    ├── visualizations/
    │   └── NetworkExplorer.tsx  (enhance for lineage)
    └── RelationshipManager.tsx  (enhance for joins)
```

## Testing the Foundation

**In Browser Console:**
```javascript
// Get store
const store = window.__ZUSTAND_DEVTOOLS__?.stores[0]?.getState();

// Create a test join
const testJoin = {
  id: 'test-join-1',
  name: 'Test Join',
  leftBundleId: store.bundles[0]?.id,
  rightBundleId: store.bundles[1]?.id,
  joinType: 'inner',
  conditions: [{
    leftRoleId: 'node_id',
    rightRoleId: 'node_id',
    operator: '='
  }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

store.addJoin(testJoin);

// Build lineage graph
const lineage = store.getLineageGraph();
console.log('Lineage Stats:', lineage.getStats());
console.log('Graph:', lineage.exportForVisualization());
```

## Summary

**✅ What's Done:**
- Join and virtual bundle data structures
- Lineage graph with graphology
- Store actions and persistence
- Cognee-ready architecture
- 1000+ lines of production code

**🚧 What's Next:**
- Join builder UI
- Lineage visualization
- Joins management interface
- AI-powered suggestions (with Cognee)

**🎯 Future:**
- Column-level lineage
- Data quality dashboard
- Impact analysis
- Collaborative features

This foundation enables powerful data lineage and join capabilities while staying true to the app's semantic-first, client-side architecture.
