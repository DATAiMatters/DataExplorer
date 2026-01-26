import { Hono } from 'hono';
import neo4j from 'neo4j-driver';
import { getDriver } from '../lib/neo4j';

const graph = new Hono();

interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

interface GraphRelationship {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  startNodeId: string;
  endNodeId: string;
}

interface GraphResponse {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

graph.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');
  const nodeType = c.req.query('type'); // Optional filter by node label
  const db = c.req.query('db') || 'neo4j'; // Database name
  const source = c.req.query('source'); // Optional filter by source/catalog
  const label = c.req.query('label'); // Optional filter by custom label

  const driver = getDriver();
  const session = driver.session({ database: db });

  try {
    // Build label filter - can combine nodeType and custom label
    let labelFilter = '';
    if (nodeType && label) {
      const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, '_');
      labelFilter = `:${nodeType}:\`${safeLabel}\``;
    } else if (nodeType) {
      labelFilter = `:${nodeType}`;
    } else if (label) {
      const safeLabel = label.replace(/[^a-zA-Z0-9_]/g, '_');
      labelFilter = `:\`${safeLabel}\``;
    }
    const sourceFilter = source ? ' WHERE n.source = $source' : '';

    // First get all nodes (with optional filter)
    const nodesQuery = `
      MATCH (n${labelFilter})${sourceFilter}
      RETURN n
      SKIP $offset
      LIMIT $limit
    `;

    const nodesResult = await session.run(nodesQuery, {
      offset: neo4jInt(offset),
      limit: neo4jInt(limit),
      ...(source && { source }),
    });

    const nodesMap = new Map<string, GraphNode>();
    const nodeIds: string[] = [];

    for (const record of nodesResult.records) {
      const n = record.get('n');
      const nId = n.identity.toString();
      nodeIds.push(nId);
      nodesMap.set(nId, {
        id: nId,
        labels: n.labels,
        properties: n.properties,
      });
    }

    // Then get relationships between the nodes we have
    const relationships: GraphRelationship[] = [];

    if (nodeIds.length > 0) {
      const relsQuery = `
        MATCH (n)-[r]->(m)
        WHERE id(n) IN $nodeIds AND id(m) IN $nodeIds
        RETURN n, r, m
      `;

      const relsResult = await session.run(relsQuery, {
        nodeIds: nodeIds.map(id => neo4jInt(parseInt(id)))
      });

      for (const record of relsResult.records) {
        const n = record.get('n');
        const r = record.get('r');
        const m = record.get('m');

        relationships.push({
          id: r.identity.toString(),
          type: r.type,
          properties: r.properties,
          startNodeId: n.identity.toString(),
          endNodeId: m.identity.toString(),
        });
      }
    }

    const response: GraphResponse = {
      nodes: Array.from(nodesMap.values()),
      relationships,
    };

    return c.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: message }, 500);
  } finally {
    await session.close();
  }
});

// Helper to convert JS number to Neo4j integer
function neo4jInt(value: number) {
  return neo4j.int(value);
}

export default graph;
