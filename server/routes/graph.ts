import { Hono } from 'hono';
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

  const driver = getDriver();
  const session = driver.session();

  try {
    const typeFilter = nodeType ? `:${nodeType}` : '';
    const query = `
      MATCH (n${typeFilter})-[r]->(m)
      RETURN n, r, m
      SKIP $offset
      LIMIT $limit
    `;

    const result = await session.run(query, { offset: neo4jInt(offset), limit: neo4jInt(limit) });

    const nodesMap = new Map<string, GraphNode>();
    const relationships: GraphRelationship[] = [];

    for (const record of result.records) {
      const n = record.get('n');
      const r = record.get('r');
      const m = record.get('m');

      // Add source node
      const nId = n.identity.toString();
      if (!nodesMap.has(nId)) {
        nodesMap.set(nId, {
          id: nId,
          labels: n.labels,
          properties: n.properties,
        });
      }

      // Add target node
      const mId = m.identity.toString();
      if (!nodesMap.has(mId)) {
        nodesMap.set(mId, {
          id: mId,
          labels: m.labels,
          properties: m.properties,
        });
      }

      // Add relationship
      relationships.push({
        id: r.identity.toString(),
        type: r.type,
        properties: r.properties,
        startNodeId: nId,
        endNodeId: mId,
      });
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
  const neo4j = require('neo4j-driver');
  return neo4j.int(value);
}

export default graph;
