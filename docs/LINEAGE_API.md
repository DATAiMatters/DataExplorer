# Lineage API Quick Reference

Quick reference for using the join & lineage features in your components.

## Store Actions

### Joins

```typescript
import { useAppStore } from '@/store';

// Get all joins
const joins = useAppStore(s => s.joins);

// Add a join
const addJoin = useAppStore(s => s.addJoin);
addJoin({
  id: generateId(),
  name: 'Customer Orders',
  leftBundleId: 'customers-123',
  rightBundleId: 'orders-456',
  joinType: 'inner',
  conditions: [
    {
      leftRoleId: 'customer_id',
      rightRoleId: 'customer_id',
      operator: '='
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Update a join
const updateJoin = useAppStore(s => s.updateJoin);
updateJoin('join-id', {
  name: 'New Name',
  joinType: 'left'
});

// Delete a join (also removes dependent virtual bundles)
const deleteJoin = useAppStore(s => s.deleteJoin);
deleteJoin('join-id');
```

### Virtual Bundles

```typescript
// Get all virtual bundles
const virtualBundles = useAppStore(s => s.virtualBundles);

// Add a virtual bundle
const addVirtualBundle = useAppStore(s => s.addVirtualBundle);
addVirtualBundle({
  id: generateId(),
  name: 'Customer Orders View',
  type: 'join',
  sourceJoinIds: ['join-id-1'],
  schemaId: 'resulting-schema-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Update a virtual bundle
const updateVirtualBundle = useAppStore(s => s.updateVirtualBundle);
updateVirtualBundle('vbundle-id', { name: 'New Name' });

// Delete a virtual bundle
const deleteVirtualBundle = useAppStore(s => s.deleteVirtualBundle);
deleteVirtualBundle('vbundle-id');
```

### Lineage Queries

```typescript
// Build the complete lineage graph
const getLineageGraph = useAppStore(s => s.getLineageGraph);
const lineage = getLineageGraph();

// Get stats
const stats = lineage.getStats();
// {
//   totalNodes: 15,
//   totalEdges: 12,
//   bundles: 8,
//   virtualBundles: 3,
//   schemas: 4,
//   hasCircularDeps: false
// }

// Get upstream bundles (what feeds this bundle?)
const getUpstreamBundles = useAppStore(s => s.getUpstreamBundles);
const upstream = getUpstreamBundles('my-bundle-id');
// Returns: DataBundle[]

// Get downstream bundles (what depends on this bundle?)
const getDownstreamBundles = useAppStore(s => s.getDownstreamBundles);
const downstream = getDownstreamBundles('my-bundle-id');
// Returns: (DataBundle | VirtualBundle)[]

// Find path between two bundles
const path = lineage.findPath('source-bundle-id', 'target-bundle-id');
// Returns: string[] | null (array of bundle IDs forming the path)

// Check for circular dependencies
const hasCircular = lineage.hasCircularDependencies();
// Returns: boolean
```

## Using in Components

### Example: Show Lineage Info

```typescript
import { useAppStore } from '@/store';
import { useMemo } from 'react';

function BundleLineageInfo({ bundleId }: { bundleId: string }) {
  const getUpstreamBundles = useAppStore(s => s.getUpstreamBundles);
  const getDownstreamBundles = useAppStore(s => s.getDownstreamBundles);

  const upstream = useMemo(() =>
    getUpstreamBundles(bundleId),
    [bundleId, getUpstreamBundles]
  );

  const downstream = useMemo(() =>
    getDownstreamBundles(bundleId),
    [bundleId, getDownstreamBundles]
  );

  return (
    <div>
      <h3>Data Lineage</h3>

      <div>
        <h4>Upstream Sources ({upstream.length})</h4>
        <ul>
          {upstream.map(bundle => (
            <li key={bundle.id}>{bundle.name}</li>
          ))}
        </ul>
      </div>

      <div>
        <h4>Downstream Consumers ({downstream.length})</h4>
        <ul>
          {downstream.map(bundle => (
            <li key={bundle.id}>{bundle.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### Example: Lineage Graph Visualization

```typescript
import { useAppStore } from '@/store';
import { useMemo } from 'react';
import * as d3 from 'd3';

function LineageVisualization() {
  const getLineageGraph = useAppStore(s => s.getLineageGraph);

  const graphData = useMemo(() => {
    const lineage = getLineageGraph();
    return lineage.exportForVisualization();
  }, [getLineageGraph]);

  // Use D3 to render the graph
  // graphData.nodes and graphData.edges are ready for D3 force simulation

  return (
    <svg ref={svgRef}>
      {/* D3 will render here */}
    </svg>
  );
}
```

### Example: Join Builder

```typescript
function JoinBuilder() {
  const bundles = useAppStore(s => s.bundles);
  const schemas = useAppStore(s => s.schemas);
  const addJoin = useAppStore(s => s.addJoin);
  const addVirtualBundle = useAppStore(s => s.addVirtualBundle);

  const [leftBundleId, setLeftBundleId] = useState('');
  const [rightBundleId, setRightBundleId] = useState('');
  const [joinType, setJoinType] = useState<JoinType>('inner');
  const [conditions, setConditions] = useState<JoinCondition[]>([]);

  const leftBundle = bundles.find(b => b.id === leftBundleId);
  const rightBundle = bundles.find(b => b.id === rightBundleId);
  const leftSchema = leftBundle ? schemas.find(s => s.id === leftBundle.schemaId) : null;
  const rightSchema = rightBundle ? schemas.find(s => s.id === rightBundle.schemaId) : null;

  const handleCreateJoin = () => {
    // Create join definition
    const join: JoinDefinition = {
      id: generateId(),
      name: `${leftBundle?.name} × ${rightBundle?.name}`,
      leftBundleId,
      rightBundleId,
      joinType,
      conditions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    addJoin(join);

    // Optionally create virtual bundle
    const vBundle: VirtualBundle = {
      id: generateId(),
      name: `${leftBundle?.name} + ${rightBundle?.name}`,
      type: 'join',
      sourceJoinIds: [join.id],
      schemaId: leftBundle?.schemaId || '', // Or derive combined schema
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    addVirtualBundle(vBundle);
  };

  return (
    <div>
      <Select value={leftBundleId} onValueChange={setLeftBundleId}>
        {bundles.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
      </Select>

      <Select value={rightBundleId} onValueChange={setRightBundleId}>
        {bundles.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
      </Select>

      <Select value={joinType} onValueChange={setJoinType}>
        <SelectItem value="inner">Inner Join</SelectItem>
        <SelectItem value="left">Left Join</SelectItem>
        <SelectItem value="right">Right Join</SelectItem>
        <SelectItem value="full">Full Outer Join</SelectItem>
      </Select>

      {/* Condition builder UI */}
      {leftSchema && rightSchema && (
        <JoinConditionBuilder
          leftSchema={leftSchema}
          rightSchema={rightSchema}
          conditions={conditions}
          onChange={setConditions}
        />
      )}

      <Button onClick={handleCreateJoin}>Create Join</Button>
    </div>
  );
}
```

## Advanced Usage

### Custom Lineage Analysis

```typescript
import { LineageGraph } from '@/lib/lineageGraph';

const customAnalysis = () => {
  const bundles = useAppStore.getState().bundles;
  const joins = useAppStore.getState().joins;
  const virtualBundles = useAppStore.getState().virtualBundles;
  const schemas = useAppStore.getState().schemas;

  // Build graph
  const lineage = LineageGraph.build(bundles, joins, virtualBundles, schemas);

  // Access raw graphology instance for advanced queries
  const graph = lineage.getGraph();

  // Example: Find most connected bundles (highest degree)
  const degrees = new Map<string, number>();
  graph.forEachNode((node) => {
    degrees.set(node, graph.degree(node));
  });

  const mostConnected = Array.from(degrees.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('Most connected bundles:', mostConnected);
};
```

### Export for External Tools

```typescript
// Export to Cognee format (for AI analysis)
const lineage = getLineageGraph();
const cogneeFormat = lineage.exportToCogneeFormat();

// Send to Cognee backend
fetch('/api/cognee/import', {
  method: 'POST',
  body: JSON.stringify(cogneeFormat)
});

// Export for D3 visualization
const d3Format = lineage.exportForVisualization();

// Use in force-directed graph
const simulation = d3.forceSimulation(d3Format.nodes)
  .force('link', d3.forceLink(d3Format.edges).id(d => d.id))
  .force('charge', d3.forceManyBody())
  .force('center', d3.forceCenter(width / 2, height / 2));
```

## Type Reference

```typescript
// Join types
type JoinType = 'inner' | 'left' | 'right' | 'full';
type JoinOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like';

interface JoinCondition {
  leftRoleId: string;   // Semantic role ID from left bundle's schema
  rightRoleId: string;  // Semantic role ID from right bundle's schema
  operator: JoinOperator;
}

interface JoinDefinition {
  id: string;
  name: string;
  description?: string;
  leftBundleId: string;
  rightBundleId: string;
  joinType: JoinType;
  conditions: JoinCondition[];
  createdAt: string;
  updatedAt: string;
}

// Virtual bundle types
interface VirtualBundle {
  id: string;
  name: string;
  description?: string;
  type: 'join' | 'union' | 'filter';
  sourceJoinIds: string[];
  schemaId: string;
  createdAt: string;
  updatedAt: string;
}

// Lineage types
type LineageNodeType = 'bundle' | 'virtual_bundle' | 'schema';
type LineageEdgeType = 'join' | 'derived_from' | 'uses_schema';

interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string;
  bundleId?: string;
  schemaId?: string;
  metadata?: Record<string, unknown>;
}

interface LineageEdge {
  source: string;
  target: string;
  type: LineageEdgeType;
  label?: string;
  joinId?: string;
}
```

## Common Patterns

### Pattern: Validate Join Before Creating

```typescript
const validateJoin = (
  leftBundleId: string,
  rightBundleId: string,
  conditions: JoinCondition[]
): string[] => {
  const errors: string[] = [];

  if (!leftBundleId || !rightBundleId) {
    errors.push('Must select both bundles');
  }

  if (conditions.length === 0) {
    errors.push('Must have at least one join condition');
  }

  // Check for circular dependency
  const lineage = useAppStore.getState().getLineageGraph();
  if (lineage.hasCircularDependencies()) {
    errors.push('This join would create a circular dependency');
  }

  return errors;
};
```

### Pattern: Auto-suggest Join Conditions

```typescript
const suggestJoinConditions = (
  leftBundle: DataBundle,
  rightBundle: DataBundle,
  schemas: SemanticSchema[]
): JoinCondition[] => {
  const leftSchema = schemas.find(s => s.id === leftBundle.schemaId);
  const rightSchema = schemas.find(s => s.id === rightBundle.schemaId);

  if (!leftSchema || !rightSchema) return [];

  const suggestions: JoinCondition[] = [];

  // Find roles with matching IDs
  leftSchema.roles.forEach(leftRole => {
    const matchingRole = rightSchema.roles.find(r => r.id === leftRole.id);
    if (matchingRole) {
      suggestions.push({
        leftRoleId: leftRole.id,
        rightRoleId: matchingRole.id,
        operator: '='
      });
    }
  });

  return suggestions;
};
```

### Pattern: Compute Join Preview

```typescript
const computeJoinPreview = (
  leftBundle: DataBundle,
  rightBundle: DataBundle,
  conditions: JoinCondition[]
): { rowCount: number; matchRate: number } => {
  // Simplified preview - in production, use proper join algorithm
  const leftData = leftBundle.source.parsedData;
  const rightData = rightBundle.source.parsedData;

  // For now, estimate based on first condition
  if (conditions.length === 0) return { rowCount: 0, matchRate: 0 };

  const condition = conditions[0];
  const leftMapping = leftBundle.mappings.find(m => m.roleId === condition.leftRoleId);
  const rightMapping = rightBundle.mappings.find(m => m.roleId === condition.rightRoleId);

  if (!leftMapping || !rightMapping) return { rowCount: 0, matchRate: 0 };

  // Count matches (simplified)
  const leftValues = new Set(leftData.map(row => row[leftMapping.sourceColumn]));
  const rightValues = new Set(rightData.map(row => row[rightMapping.sourceColumn]));

  const intersection = new Set(
    Array.from(leftValues).filter(v => rightValues.has(v))
  );

  const matchRate = intersection.size / Math.max(leftValues.size, rightValues.size);
  const rowCount = intersection.size; // Approximate

  return { rowCount, matchRate };
};
```

## Next Steps

See [LINEAGE_FEATURE.md](./LINEAGE_FEATURE.md) for:
- Phase 2: UI components to build
- Phase 3: AI integration with Cognee
- Architecture decisions and trade-offs
- Performance considerations
