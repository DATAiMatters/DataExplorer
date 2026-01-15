import Graph from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import type {
  DataBundle,
  JoinDefinition,
  VirtualBundle,
  LineageNode,
  LineageEdge,
  SemanticSchema,
} from '@/types';

/**
 * Lineage Graph Builder
 *
 * Builds a directed graph representing data lineage:
 * - Nodes: Bundles, Virtual Bundles, Schemas
 * - Edges: Joins, Derivations, Schema Usage
 *
 * Designed for future Cognee integration - graph structure
 * can be exported to Cognee's knowledge graph format.
 */
export class LineageGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ type: 'directed' });
  }

  /**
   * Build the complete lineage graph from app state
   */
  static build(
    bundles: DataBundle[],
    joins: JoinDefinition[],
    virtualBundles: VirtualBundle[],
    schemas: SemanticSchema[]
  ): LineageGraph {
    const lineage = new LineageGraph();

    // Add bundle nodes
    bundles.forEach((bundle) => {
      lineage.addBundleNode(bundle);
      lineage.addBundleToSchemaEdge(bundle);
    });

    // Add schema nodes
    schemas.forEach((schema) => {
      lineage.addSchemaNode(schema);
    });

    // Add join relationships
    joins.forEach((join) => {
      lineage.addJoinEdge(join);
    });

    // Add virtual bundle nodes and their derivations
    virtualBundles.forEach((vBundle) => {
      lineage.addVirtualBundleNode(vBundle);
      lineage.addVirtualBundleDerivations(vBundle, joins);
    });

    return lineage;
  }

  /**
   * Add a bundle node to the graph
   */
  private addBundleNode(bundle: DataBundle): void {
    if (this.graph.hasNode(bundle.id)) return;

    this.graph.addNode(bundle.id, {
      id: bundle.id,
      type: 'bundle',
      label: bundle.name,
      bundleId: bundle.id,
      schemaId: bundle.schemaId,
      metadata: {
        description: bundle.description,
        rowCount: bundle.source.parsedData.length,
        columnCount: bundle.source.columns.length,
        createdAt: bundle.createdAt,
        updatedAt: bundle.updatedAt,
      },
    } as LineageNode);
  }

  /**
   * Add a schema node to the graph
   */
  private addSchemaNode(schema: SemanticSchema): void {
    const nodeId = `schema:${schema.id}`;
    if (this.graph.hasNode(nodeId)) return;

    this.graph.addNode(nodeId, {
      id: nodeId,
      type: 'schema',
      label: schema.name,
      schemaId: schema.id,
      metadata: {
        dataType: schema.dataType,
        description: schema.description,
        roleCount: schema.roles.length,
      },
    } as LineageNode);
  }

  /**
   * Add a virtual bundle node
   */
  private addVirtualBundleNode(vBundle: VirtualBundle): void {
    if (this.graph.hasNode(vBundle.id)) return;

    this.graph.addNode(vBundle.id, {
      id: vBundle.id,
      type: 'virtual_bundle',
      label: vBundle.name,
      bundleId: vBundle.id,
      schemaId: vBundle.schemaId,
      metadata: {
        description: vBundle.description,
        type: vBundle.type,
        createdAt: vBundle.createdAt,
        updatedAt: vBundle.updatedAt,
      },
    } as LineageNode);
  }

  /**
   * Add edge from bundle to schema (bundle uses schema)
   */
  private addBundleToSchemaEdge(bundle: DataBundle): void {
    const schemaNodeId = `schema:${bundle.schemaId}`;
    if (!this.graph.hasNode(schemaNodeId)) return;

    const edgeKey = `${bundle.id}-uses-${schemaNodeId}`;
    if (this.graph.hasEdge(edgeKey)) return;

    this.graph.addDirectedEdge(bundle.id, schemaNodeId, {
      type: 'uses_schema',
      label: 'uses schema',
    } as LineageEdge);
  }

  /**
   * Add join edge between two bundles
   */
  private addJoinEdge(join: JoinDefinition): void {
    if (!this.graph.hasNode(join.leftBundleId) || !this.graph.hasNode(join.rightBundleId)) {
      return;
    }

    const edgeKey = `${join.leftBundleId}-join-${join.rightBundleId}`;
    if (this.graph.hasEdge(edgeKey)) return;

    this.graph.addDirectedEdge(join.leftBundleId, join.rightBundleId, {
      type: 'join',
      label: `${join.joinType} join`,
      joinId: join.id,
    } as LineageEdge);
  }

  /**
   * Add derivation edges from source bundles to virtual bundle
   */
  private addVirtualBundleDerivations(vBundle: VirtualBundle, joins: JoinDefinition[]): void {
    vBundle.sourceJoinIds.forEach((joinId) => {
      const join = joins.find((j) => j.id === joinId);
      if (!join) return;

      // Virtual bundle is derived from left bundle
      if (this.graph.hasNode(join.leftBundleId)) {
        this.graph.addDirectedEdge(join.leftBundleId, vBundle.id, {
          type: 'derived_from',
          label: 'source',
        } as LineageEdge);
      }

      // Virtual bundle is derived from right bundle
      if (this.graph.hasNode(join.rightBundleId)) {
        this.graph.addDirectedEdge(join.rightBundleId, vBundle.id, {
          type: 'derived_from',
          label: 'source',
        } as LineageEdge);
      }
    });
  }

  /**
   * Get all upstream bundles (ancestors) for a given bundle
   */
  getUpstreamBundles(bundleId: string): LineageNode[] {
    if (!this.graph.hasNode(bundleId)) return [];

    const upstream: LineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Get all incoming edges
      this.graph.forEachInNeighbor(nodeId, (neighborId) => {
        const node = this.graph.getNodeAttributes(neighborId) as LineageNode;
        if (node.type === 'bundle' || node.type === 'virtual_bundle') {
          upstream.push(node);
        }
        traverse(neighborId);
      });
    };

    traverse(bundleId);
    return upstream;
  }

  /**
   * Get all downstream bundles (descendants) for a given bundle
   */
  getDownstreamBundles(bundleId: string): LineageNode[] {
    if (!this.graph.hasNode(bundleId)) return [];

    const downstream: LineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Get all outgoing edges
      this.graph.forEachOutNeighbor(nodeId, (neighborId) => {
        const node = this.graph.getNodeAttributes(neighborId) as LineageNode;
        if (node.type === 'bundle' || node.type === 'virtual_bundle') {
          downstream.push(node);
        }
        traverse(neighborId);
      });
    };

    traverse(bundleId);
    return downstream;
  }

  /**
   * Find shortest path between two bundles
   */
  findPath(sourceBundleId: string, targetBundleId: string): string[] | null {
    if (!this.graph.hasNode(sourceBundleId) || !this.graph.hasNode(targetBundleId)) {
      return null;
    }

    try {
      return bidirectional(this.graph, sourceBundleId, targetBundleId);
    } catch {
      return null; // No path exists
    }
  }

  /**
   * Detect circular dependencies
   */
  hasCircularDependencies(): boolean {
    try {
      // Simple DFS-based cycle detection
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (nodeId: string): boolean => {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        for (const neighbor of this.graph.outNeighbors(nodeId)) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) return true;
          } else if (recursionStack.has(neighbor)) {
            return true; // Back edge found
          }
        }

        recursionStack.delete(nodeId);
        return false;
      };

      for (const node of this.graph.nodes()) {
        if (!visited.has(node)) {
          if (hasCycle(node)) return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get graph statistics
   */
  getStats() {
    const nodes = this.graph.nodes().map((id) => this.graph.getNodeAttributes(id) as LineageNode);

    return {
      totalNodes: this.graph.order,
      totalEdges: this.graph.size,
      bundles: nodes.filter((n) => n.type === 'bundle').length,
      virtualBundles: nodes.filter((n) => n.type === 'virtual_bundle').length,
      schemas: nodes.filter((n) => n.type === 'schema').length,
      hasCircularDeps: this.hasCircularDependencies(),
    };
  }

  /**
   * Export graph for visualization (D3.js compatible format)
   */
  exportForVisualization(): { nodes: LineageNode[]; edges: LineageEdge[] } {
    const nodes: LineageNode[] = this.graph.nodes().map((nodeId) => {
      const attrs = this.graph.getNodeAttributes(nodeId) as LineageNode;
      return { ...attrs };
    });

    const edges: LineageEdge[] = [];
    this.graph.forEachEdge((_key, attributes, sourceId, targetId) => {
      const attrs = attributes as Omit<LineageEdge, 'source' | 'target'>;
      edges.push({
        ...attrs,
        source: sourceId,
        target: targetId,
      });
    });

    return { nodes, edges };
  }

  /**
   * Export to Cognee-compatible format (for future integration)
   *
   * This structure can be sent to Cognee backend for:
   * - Entity extraction
   * - Relationship discovery
   * - Semantic search
   */
  exportToCogneeFormat() {
    const { nodes, edges } = this.exportForVisualization();

    return {
      entities: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        properties: {
          label: node.label,
          ...node.metadata,
        },
      })),
      relationships: edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
        properties: {
          label: edge.label,
          joinId: edge.joinId,
        },
      })),
    };
  }

  /**
   * Get the underlying graphology instance
   * (for advanced queries and custom algorithms)
   */
  getGraph(): Graph {
    return this.graph;
  }
}
