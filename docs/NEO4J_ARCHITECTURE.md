# Neo4j Integration Architecture

**Status:** Planning / Future Enhancement
**Date:** January 20, 2026
**Related:** Network Visualization Performance

---

## Overview

This document outlines the architecture for integrating Neo4j as an optional backend for DataExplorer to support enterprise-scale graph datasets (millions of nodes/edges).

### Current State

DataExplorer currently operates client-side only with:
- **D3.js SVG renderer** - Works well up to ~5,000 nodes
- **Sigma.js WebGL renderer** - Handles up to ~500,000 nodes (newly added)
- **In-memory data** - All graph data held in browser memory
- **localStorage persistence** - Limited to ~5-10MB

### Problem Statement

While WebGL rendering dramatically improves visualization performance, the fundamental bottleneck for truly large datasets is:
1. **Data transfer** - Loading 1M+ nodes from CSV into browser
2. **Memory constraints** - Browser memory limits (~2GB typical)
3. **Query performance** - Filtering/traversing large graphs in JS

---

## Proposed Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        DataExplorer UI                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  D3 SVG Viz     │  │  Sigma WebGL    │  │  Query Builder │  │
│  │  (<5K nodes)    │  │  (5K-500K)      │  │                │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Data Adapter   │
                    │  Interface      │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│ Local Adapter │   │  Neo4j Adapter │   │ Future: Other │
│ (CSV/JSON)    │   │  (Bolt/HTTP)   │   │ (TigerGraph)  │
└───────────────┘   └───────┬───────┘   └───────────────┘
                            │
                    ┌───────▼───────┐
                    │    Neo4j DB   │
                    │  (Self-host   │
                    │   or Aura)    │
                    └───────────────┘
```

### Data Adapter Interface

```typescript
// src/lib/adapters/types.ts

interface GraphDataAdapter {
  // Connection
  connect(config: AdapterConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Data loading
  getNodes(options: QueryOptions): Promise<PaginatedResult<NetworkNode>>;
  getEdges(options: QueryOptions): Promise<PaginatedResult<NetworkEdge>>;

  // Graph traversal
  getNeighbors(nodeId: string, depth: number): Promise<SubGraph>;
  getShortestPath(sourceId: string, targetId: string): Promise<Path>;

  // Aggregations
  getNodeGroups(): Promise<GroupSummary[]>;
  getEdgeTypes(): Promise<EdgeTypeSummary[]>;
  getStats(): Promise<GraphStats>;

  // Search
  searchNodes(query: string, limit: number): Promise<NetworkNode[]>;
  filterNodes(filters: Filter[]): Promise<PaginatedResult<NetworkNode>>;

  // Import
  importFromCSV(file: File, mappings: ColumnMapping[]): Promise<ImportResult>;
  importFromBundle(bundle: DataBundle): Promise<ImportResult>;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  filters?: Filter[];
  orderBy?: string;
  includeProperties?: string[];
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

interface SubGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}
```

### Neo4j Adapter Implementation

```typescript
// src/lib/adapters/neo4jAdapter.ts

import neo4j, { Driver, Session } from 'neo4j-driver';

export class Neo4jAdapter implements GraphDataAdapter {
  private driver: Driver | null = null;
  private config: Neo4jConfig | null = null;

  async connect(config: Neo4jConfig): Promise<void> {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password),
      { encrypted: config.encrypted ?? true }
    );
    await this.driver.verifyConnectivity();
    this.config = config;
  }

  async getNodes(options: QueryOptions): Promise<PaginatedResult<NetworkNode>> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH (n)
        WHERE n:${options.filters?.find(f => f.field === 'label')?.value || 'Node'}
        RETURN n
        ORDER BY n.${options.orderBy || 'id'}
        SKIP $offset
        LIMIT $limit
      `, {
        offset: neo4j.int(options.offset || 0),
        limit: neo4j.int(options.limit || 1000)
      });

      const countResult = await session.run(`
        MATCH (n) RETURN count(n) as total
      `);

      return {
        data: result.records.map(r => this.mapToNetworkNode(r.get('n'))),
        total: countResult.records[0].get('total').toNumber(),
        hasMore: (options.offset || 0) + result.records.length < countResult.records[0].get('total').toNumber()
      };
    } finally {
      await session.close();
    }
  }

  async getNeighbors(nodeId: string, depth: number = 1): Promise<SubGraph> {
    const session = this.getSession();
    try {
      const result = await session.run(`
        MATCH path = (start)-[*1..${depth}]-(neighbor)
        WHERE start.id = $nodeId
        RETURN path
      `, { nodeId });

      const nodes = new Map<string, NetworkNode>();
      const edges: NetworkEdge[] = [];

      result.records.forEach(record => {
        const path = record.get('path');
        path.segments.forEach(segment => {
          // Process nodes and relationships
          nodes.set(segment.start.properties.id, this.mapToNetworkNode(segment.start));
          nodes.set(segment.end.properties.id, this.mapToNetworkNode(segment.end));
          edges.push(this.mapToNetworkEdge(segment.relationship));
        });
      });

      return {
        nodes: Array.from(nodes.values()),
        edges
      };
    } finally {
      await session.close();
    }
  }

  // ... additional methods
}
```

---

## Deployment Options

### Option 1: Self-Hosted (Recommended for Internal Use)

```yaml
# docker-compose.neo4j.yml
version: '3.8'
services:
  neo4j:
    image: neo4j:5.15-community
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/your_password
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_dbms_memory_heap_initial__size=1G
      - NEO4J_dbms_memory_heap_max__size=4G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs

volumes:
  neo4j_data:
  neo4j_logs:
```

**Pros:**
- Full control over data and security
- No ongoing cloud costs
- Can run on local network

**Cons:**
- Requires infrastructure management
- Manual backups and updates

### Option 2: Neo4j Aura (Cloud SaaS)

**Pros:**
- Zero infrastructure management
- Automatic scaling and backups
- Global availability

**Cons:**
- Recurring costs ($65-200+/month for production)
- Data leaves premises (compliance consideration)
- Network latency for large queries

### Option 3: Hybrid (Export to Neo4j)

Run DataExplorer client-side as usual, but add "Export to Neo4j" feature for users who want to persist large graphs.

```typescript
// Export current bundle to Neo4j
async function exportToNeo4j(bundle: DataBundle, adapter: Neo4jAdapter) {
  const networkData = transformToNetwork(bundle.source, bundle.mappings);

  // Batch import nodes
  await adapter.batchImport(
    networkData.nodes.map(n => ({
      type: 'node',
      labels: [n.group || 'Entity'],
      properties: { id: n.id, label: n.label, ...n.properties }
    })),
    networkData.edges.map(e => ({
      type: 'relationship',
      relationshipType: e.relationshipType || 'CONNECTED_TO',
      startId: e.source,
      endId: e.target,
      properties: { weight: e.weight, ...e.properties }
    }))
  );
}
```

---

## UI Changes Required

### 1. Connection Settings Panel

```tsx
// New component: src/components/app/Neo4jSettings.tsx
export function Neo4jSettings() {
  const [config, setConfig] = useState<Neo4jConfig>({
    uri: 'bolt://localhost:7687',
    username: 'neo4j',
    password: '',
    database: 'neo4j'
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neo4j Connection</CardTitle>
      </CardHeader>
      <CardContent>
        <Input label="URI" value={config.uri} onChange={...} />
        <Input label="Username" value={config.username} onChange={...} />
        <Input label="Password" type="password" value={config.password} onChange={...} />
        <Button onClick={testConnection}>Test Connection</Button>
        <Button onClick={connect}>Connect</Button>
      </CardContent>
    </Card>
  );
}
```

### 2. Explorer Integration

The Explorer component would detect the data source and render appropriately:

```tsx
function NetworkExplorer({ bundle, dataAdapter }) {
  // If Neo4j adapter, use server-side pagination
  if (dataAdapter instanceof Neo4jAdapter) {
    return <NetworkExplorerNeo4j adapter={dataAdapter} />;
  }

  // Otherwise use client-side rendering
  const nodeCount = bundle.source.data.length;
  if (nodeCount > WEBGL_THRESHOLD) {
    return <NetworkExplorerWebGL bundle={bundle} />;
  }
  return <NetworkExplorerSVG bundle={bundle} />;
}
```

### 3. Progressive Loading UI

For Neo4j-backed graphs, implement "viewport loading":

```tsx
// Load nodes visible in current viewport + buffer
function useViewportNodes(adapter: Neo4jAdapter, camera: SigmaCamera) {
  const [visibleNodes, setVisibleNodes] = useState<NetworkNode[]>([]);

  useEffect(() => {
    const bounds = getViewportBounds(camera);
    const loadVisible = debounce(async () => {
      const nodes = await adapter.getNodesInBounds(bounds);
      setVisibleNodes(nodes);
    }, 100);

    camera.on('updated', loadVisible);
    return () => camera.off('updated', loadVisible);
  }, [adapter, camera]);

  return visibleNodes;
}
```

---

## Data Model Mapping

### Current DataExplorer → Neo4j

| DataExplorer | Neo4j |
|--------------|-------|
| NetworkNode.id | Node.id property |
| NetworkNode.label | Node.label property |
| NetworkNode.group | Node label (e.g., `:Equipment`) |
| NetworkNode.properties | Node properties |
| NetworkEdge.source/target | Relationship start/end |
| NetworkEdge.relationshipType | Relationship type |
| NetworkEdge.weight | Relationship property |

### Cypher Queries for Common Operations

```cypher
-- Get all node groups with counts
MATCH (n)
RETURN labels(n) AS groups, count(*) AS count
ORDER BY count DESC

-- Get neighbors of a node (2 hops)
MATCH path = (start)-[*1..2]-(neighbor)
WHERE start.id = $nodeId
RETURN path

-- Find shortest path between two nodes
MATCH path = shortestPath((a)-[*]-(b))
WHERE a.id = $sourceId AND b.id = $targetId
RETURN path

-- Get high-degree nodes (potential hubs)
MATCH (n)-[r]-()
WITH n, count(r) AS degree
WHERE degree > 10
RETURN n, degree
ORDER BY degree DESC
LIMIT 100

-- Full-text search on node labels
CALL db.index.fulltext.queryNodes("node_labels", $searchTerm)
YIELD node, score
RETURN node, score
LIMIT 20
```

---

## Performance Considerations

### Indexing Strategy

```cypher
-- Essential indexes for query performance
CREATE INDEX node_id_index FOR (n:Node) ON (n.id);
CREATE INDEX node_label_index FOR (n:Node) ON (n.label);
CREATE FULLTEXT INDEX node_labels FOR (n:Node) ON EACH [n.label, n.description];
```

### Query Optimization

1. **Use LIMIT** - Never return unbounded results
2. **Project only needed properties** - `RETURN n.id, n.label` not `RETURN n`
3. **Use parameters** - Enables query caching
4. **Batch imports** - Use `UNWIND` for bulk operations

### Network Optimizations

1. **Connection pooling** - Reuse connections
2. **Compression** - Enable Bolt compression for large payloads
3. **Caching** - Cache frequently-accessed subgraphs client-side

---

## Migration Path

### Phase 1: Adapter Interface (No Breaking Changes)
- Add GraphDataAdapter interface
- Create LocalAdapter wrapping current behavior
- All existing functionality unchanged

### Phase 2: Neo4j Adapter (Optional Feature)
- Add Neo4j adapter implementation
- Add connection settings UI
- Add "Connect to Neo4j" option in settings
- Users can opt-in to Neo4j backend

### Phase 3: Enhanced Features (Neo4j-Specific)
- Server-side search
- Graph algorithms (PageRank, community detection)
- Real-time collaboration via Neo4j change streams
- Large-scale analytics

---

## Cost Estimates

### Self-Hosted
- **Hardware:** $50-200/month for adequate VM (4 CPU, 16GB RAM, SSD)
- **Maintenance:** ~4 hours/month for updates, monitoring

### Neo4j Aura
- **Professional:** $65/month (1GB storage, shared resources)
- **Enterprise:** $200+/month (dedicated resources, SLA)

### Total Cost of Ownership (1 year, medium usage)

| Option | Year 1 Cost | Notes |
|--------|-------------|-------|
| Self-hosted (basic) | ~$800 | Plus admin time |
| Self-hosted (prod) | ~$1,500 | HA setup |
| Aura Professional | ~$780 | Managed service |
| Aura Enterprise | ~$2,400+ | Full support |

---

## Decision Matrix

| Factor | Local Only | Self-Hosted Neo4j | Aura Cloud |
|--------|------------|-------------------|------------|
| Max nodes | ~500K | 10M+ | 10M+ |
| Latency | Instant | LAN: <10ms | 20-100ms |
| Setup | None | Medium | Easy |
| Cost | $0 | Medium | Medium-High |
| Compliance | Best | Good | Depends |
| Collaboration | No | Yes | Yes |
| Offline | Yes | Partial | No |

---

## Recommendation

For DataExplorer's use case (data exploration tool):

**Short-term:** Continue with WebGL renderer for 90% of use cases. The newly implemented Sigma.js integration handles up to 500K nodes without any backend.

**Medium-term:** Add Neo4j adapter as **optional** feature for users with:
- Graphs exceeding 500K nodes
- Need for persistent graph storage
- Multi-user collaboration requirements

**Implementation approach:**
1. Create adapter interface now (minimal effort)
2. Keep local-first architecture
3. Add Neo4j as opt-in enhancement
4. Don't require backend for basic usage

This preserves DataExplorer's simplicity while enabling enterprise scale when needed.

---

## References

- [Neo4j JavaScript Driver](https://neo4j.com/docs/javascript-manual/current/)
- [Neo4j Aura](https://neo4j.com/cloud/aura/)
- [Sigma.js Documentation](https://www.sigmajs.org/)
- [Graphology](https://graphology.github.io/)

---

*Document created: January 20, 2026*
*Author: Claude Opus 4.5*
