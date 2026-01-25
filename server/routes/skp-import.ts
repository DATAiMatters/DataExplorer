import { Hono } from 'hono';
import { getDriver } from '../lib/neo4j';

const skpImport = new Hono();

interface SKPAsset {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface SKPRelationship {
  sourceId: string;
  targetId: string;
  type: string;
}

interface AssetError {
  id: string;
  error: string;
}

interface RelError {
  source: string;
  target: string;
  error: string;
}

function getBasicAuthHeader(): string {
  const user = process.env.SKP_API_USER;
  const password = process.env.SKP_API_PASSWORD;
  if (!user || !password) {
    throw new Error('Missing SKP_API_USER or SKP_API_PASSWORD');
  }
  const base64 = Buffer.from(`${user}:${password}`).toString('base64');
  return `Basic ${base64}`;
}

async function fetchSKPAssets(): Promise<SKPAsset[]> {
  const baseUrl = process.env.SKP_API_BASE;
  if (!baseUrl) {
    throw new Error('Missing SKP_API_BASE');
  }
  const res = await fetch(`${baseUrl}/assets`, {
    headers: { Authorization: getBasicAuthHeader() },
  });
  if (!res.ok) {
    throw new Error(`SKP API returned ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function fetchSKPRelationships(): Promise<SKPRelationship[]> {
  const baseUrl = process.env.SKP_API_BASE;
  if (!baseUrl) {
    throw new Error('Missing SKP_API_BASE');
  }
  const res = await fetch(`${baseUrl}/relationships`, {
    headers: { Authorization: getBasicAuthHeader() },
  });
  if (!res.ok) {
    throw new Error(`SKP API returned ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

skpImport.get('/', async (c) => {
  const db = c.req.query('db') || 'skp';
  const driver = getDriver();
  const session = driver.session({ database: db });

  const assetResults = { success: 0, failed: 0, errors: [] as AssetError[] };
  const relResults = { success: 0, failed: 0, errors: [] as RelError[] };

  try {
    // Fetch from SKP API
    let assets: SKPAsset[];
    let relationships: SKPRelationship[];

    try {
      assets = await fetchSKPAssets();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return c.json({ error: 'Failed to fetch SKP assets', details: message }, 502);
    }

    try {
      relationships = await fetchSKPRelationships();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return c.json({ error: 'Failed to fetch SKP relationships', details: message }, 502);
    }

    // Import assets as nodes
    for (const asset of assets) {
      try {
        await session.run(
          'MERGE (n:Asset {id: $id}) SET n.name = $name, n.type = $type, n.description = $description',
          {
            id: asset.id,
            name: asset.name,
            type: asset.type,
            description: asset.description || '',
          }
        );
        assetResults.success++;
      } catch (e) {
        assetResults.failed++;
        assetResults.errors.push({
          id: String(asset.id),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import relationships as edges
    for (const rel of relationships) {
      try {
        await session.run(
          'MATCH (a:Asset {id: $source}), (b:Asset {id: $target}) MERGE (a)-[r:RELATION {type: $type}]->(b)',
          {
            source: rel.sourceId,
            target: rel.targetId,
            type: rel.type,
          }
        );
        relResults.success++;
      } catch (e) {
        relResults.failed++;
        relResults.errors.push({
          source: String(rel.sourceId),
          target: String(rel.targetId),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return c.json({
      success: true,
      assets: {
        total: assets.length,
        success: assetResults.success,
        failed: assetResults.failed,
        errors: assetResults.errors,
      },
      relationships: {
        total: relationships.length,
        success: relResults.success,
        failed: relResults.failed,
        errors: relResults.errors,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: message }, 500);
  } finally {
    await session.close();
  }
});

export default skpImport;
