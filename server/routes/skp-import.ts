import { Hono } from 'hono';
import { getDriver } from '../lib/neo4j';

const skpImport = new Hono();

// Types matching Syniti API response structure
interface SKPTerm {
  id: string;
  name: string;
  definition?: string;
  status?: string;
  subject_area?: string;
  relationships?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

interface SKPDataset {
  id: string;
  name: string;
  description?: string;
  system_name?: string;
  subject_area?: string;
  field_count?: number;
  categories?: string[];
}

interface SKPField {
  id: string;
  name: string;
  description?: string;
  data_type?: string;
  is_nullable?: boolean;
  is_primary_key?: boolean;
  ordinal_position?: number;
  max_length?: number;
  precision?: number;
  scale?: number;
  default_value?: string;
  is_computed?: boolean;
  subject_area?: string;
}

interface SKPRule {
  id: string;
  asset_id?: string;
  statement?: string;
  implication?: string;
  additional_info?: string;
  review_status?: string;
  version_state?: string;
  subject_area?: string;
}

interface SKPPolicy {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface SKPGoal {
  id: string;
  asset_id?: string;
  summary?: string;
  description?: string;
  status?: string;
  level?: string;
}

interface SKPSystem {
  id: string;
  asset_id?: string;
  name?: string;
  description?: string;
  location?: string;
  application_type_information?: {
    application_type?: string;
    is_sap?: boolean;
  };
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

interface RelationshipResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ source: string; target: string; error: string }>;
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

async function fetchPaginated<T>(endpoint: string): Promise<T[]> {
  const baseUrl = process.env.SKP_API_BASE;
  if (!baseUrl) {
    throw new Error('Missing SKP_API_BASE');
  }

  const allItems: T[] = [];
  let cursor = '';

  do {
    const url = cursor
      ? `${baseUrl}/v3/${endpoint}?cursor=${encodeURIComponent(cursor)}`
      : `${baseUrl}/v3/${endpoint}`;

    const res = await fetch(url, {
      headers: { Authorization: getBasicAuthHeader() },
    });

    if (!res.ok) {
      throw new Error(`SKP API ${endpoint} returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as { data: T[]; cursor?: string };
    allItems.push(...data.data);
    cursor = data.cursor || '';
  } while (cursor);

  return allItems;
}

// Fetch fields for a specific dataset
async function fetchDatasetFields(datasetId: string): Promise<SKPField[]> {
  const baseUrl = process.env.SKP_API_BASE;
  if (!baseUrl) {
    return [];
  }

  try {
    const res = await fetch(`${baseUrl}/v3/datasets/${datasetId}/fields`, {
      headers: { Authorization: getBasicAuthHeader() },
    });

    if (!res.ok) {
      // Some datasets may not have fields endpoint - that's okay
      if (res.status !== 404) {
        console.log(`Failed to fetch fields for dataset ${datasetId}: ${res.status}`);
      }
      return [];
    }

    const data = await res.json();
    // Handle different response structures
    return data.data || data.items || data || [];
  } catch (e) {
    console.log(`Error fetching fields for dataset ${datasetId}: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

skpImport.get('/', async (c) => {
  const db = c.req.query('db') || 'neo4j';
  const source = c.req.query('source') || 'skp'; // Source identifier for segregating datasets
  const label = c.req.query('label'); // Optional additional label for all nodes
  const importedAt = new Date().toISOString();
  const driver = getDriver();

  // Validate label if provided (Neo4j labels can only contain letters, numbers, and underscores)
  let safeLabel = '';
  if (label) {
    safeLabel = label.replace(/[^a-zA-Z0-9_]/g, '_');
    if (!/^[a-zA-Z_]/.test(safeLabel)) {
      safeLabel = '_' + safeLabel; // Labels must start with letter or underscore
    }
  }

  // Create database if it doesn't exist (requires Neo4j Enterprise or Aura)
  // For Community Edition, this will fail silently and use the default 'neo4j' database
  if (db !== 'neo4j' && db !== 'system') {
    const systemSession = driver.session({ database: 'system' });
    try {
      // Database names can't be parameterized in Cypher, so we validate and interpolate
      const safeName = db.replace(/[^a-zA-Z0-9_]/g, '');
      if (safeName !== db) {
        throw new Error('Database name can only contain letters, numbers, and underscores');
      }
      await systemSession.run(`CREATE DATABASE \`${safeName}\` IF NOT EXISTS`);
      console.log(`Database '${safeName}' created or already exists`);
    } catch (e) {
      // Community Edition doesn't support multiple databases - continue with default
      console.log(`Could not create database '${db}': ${e instanceof Error ? e.message : e}`);
    } finally {
      await systemSession.close();
    }
  }

  const session = driver.session({ database: db });

  // Helper to add label clause if label is provided
  const labelClause = safeLabel ? `SET n:\`${safeLabel}\`` : '';

  const results: Record<string, ImportResult> = {};
  const relationshipResults: RelationshipResult = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch all entity types from Syniti API
    console.log('Fetching terms...');
    const terms = await fetchPaginated<SKPTerm>('terms');
    console.log(`Fetched ${terms.length} terms`);

    console.log('Fetching datasets...');
    const datasets = await fetchPaginated<SKPDataset>('datasets');
    console.log(`Fetched ${datasets.length} datasets`);

    console.log('Fetching rules...');
    const rules = await fetchPaginated<SKPRule>('rules');
    console.log(`Fetched ${rules.length} rules`);

    console.log('Fetching policies...');
    const policies = await fetchPaginated<SKPPolicy>('policies');
    console.log(`Fetched ${policies.length} policies`);

    console.log('Fetching goals...');
    const goals = await fetchPaginated<SKPGoal>('goals');
    console.log(`Fetched ${goals.length} goals`);

    console.log('Fetching systems...');
    const systems = await fetchPaginated<SKPSystem>('systems');
    console.log(`Fetched ${systems.length} systems`);

    // Import Terms
    results.terms = { total: terms.length, success: 0, failed: 0, errors: [] };
    for (const term of terms) {
      try {
        await session.run(
          `MERGE (n:Term {id: $id})
           SET n.name = $name,
               n.definition = $definition,
               n.status = $status,
               n.subject_area = $subject_area,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: term.id,
            name: term.name,
            definition: term.definition || '',
            status: term.status || '',
            subject_area: term.subject_area || '',
            source,
            importedAt,
          }
        );
        results.terms.success++;
      } catch (e) {
        results.terms.failed++;
        results.terms.errors.push({
          id: term.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Datasets and their Fields
    results.datasets = { total: datasets.length, success: 0, failed: 0, errors: [] };
    results.fields = { total: 0, success: 0, failed: 0, errors: [] };

    for (const dataset of datasets) {
      try {
        // Fetch fields for this dataset
        const fields = await fetchDatasetFields(dataset.id);
        const fieldNames = fields.map(f => f.name).filter(Boolean);

        // Create/update Dataset node with field_names array
        await session.run(
          `MERGE (n:Dataset {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.system_name = $system_name,
               n.subject_area = $subject_area,
               n.field_count = $field_count,
               n.field_names = $field_names,
               n.categories = $categories,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: dataset.id,
            name: dataset.name,
            description: dataset.description || '',
            system_name: dataset.system_name || '',
            subject_area: dataset.subject_area || '',
            field_count: fields.length || dataset.field_count || 0,
            field_names: fieldNames,
            categories: dataset.categories || [],
            source,
            importedAt,
          }
        );
        results.datasets.success++;

        // Create Field nodes and HAS_FIELD relationships
        for (const field of fields) {
          results.fields.total++;
          try {
            await session.run(
              `MERGE (f:Field {id: $fieldId})
               SET f.name = $name,
                   f.description = $description,
                   f.data_type = $data_type,
                   f.is_nullable = $is_nullable,
                   f.is_primary_key = $is_primary_key,
                   f.ordinal_position = $ordinal_position,
                   f.max_length = $max_length,
                   f.precision = $precision,
                   f.scale = $scale,
                   f.default_value = $default_value,
                   f.is_computed = $is_computed,
                   f.dataset_id = $dataset_id,
                   f.source = $source,
                   f.imported_at = $importedAt
               ${labelClause}
               WITH f
               MATCH (d:Dataset {id: $dataset_id})
               MERGE (d)-[:HAS_FIELD]->(f)`,
              {
                fieldId: field.id || `${dataset.id}:${field.name}`,
                name: field.name,
                description: field.description || '',
                data_type: field.data_type || '',
                is_nullable: field.is_nullable ?? true,
                is_primary_key: field.is_primary_key ?? false,
                ordinal_position: field.ordinal_position ?? null,
                max_length: field.max_length ?? null,
                precision: field.precision ?? null,
                scale: field.scale ?? null,
                default_value: field.default_value || '',
                is_computed: field.is_computed ?? false,
                dataset_id: dataset.id,
                source,
                importedAt,
              }
            );
            results.fields.success++;
          } catch (fieldError) {
            results.fields.failed++;
            results.fields.errors.push({
              id: field.id || `${dataset.id}:${field.name}`,
              error: fieldError instanceof Error ? fieldError.message : String(fieldError),
            });
          }
        }
      } catch (e) {
        results.datasets.failed++;
        results.datasets.errors.push({
          id: dataset.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Rules
    results.rules = { total: rules.length, success: 0, failed: 0, errors: [] };
    for (const rule of rules) {
      try {
        await session.run(
          `MERGE (n:Rule {id: $id})
           SET n.asset_id = $asset_id,
               n.name = $statement,
               n.statement = $statement,
               n.implication = $implication,
               n.additional_info = $additional_info,
               n.review_status = $review_status,
               n.version_state = $version_state,
               n.subject_area = $subject_area,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: rule.id,
            asset_id: rule.asset_id || '',
            statement: rule.statement || rule.asset_id || rule.id,
            implication: rule.implication || '',
            additional_info: rule.additional_info || '',
            review_status: rule.review_status || '',
            version_state: rule.version_state || '',
            subject_area: rule.subject_area || '',
            source,
            importedAt,
          }
        );
        results.rules.success++;
      } catch (e) {
        results.rules.failed++;
        results.rules.errors.push({
          id: rule.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Policies
    results.policies = { total: policies.length, success: 0, failed: 0, errors: [] };
    for (const policy of policies) {
      try {
        await session.run(
          `MERGE (n:Policy {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.status = $status,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: policy.id,
            name: policy.name,
            description: policy.description || '',
            status: policy.status || '',
            source,
            importedAt,
          }
        );
        results.policies.success++;
      } catch (e) {
        results.policies.failed++;
        results.policies.errors.push({
          id: policy.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Goals
    results.goals = { total: goals.length, success: 0, failed: 0, errors: [] };
    for (const goal of goals) {
      try {
        await session.run(
          `MERGE (n:Goal {id: $id})
           SET n.asset_id = $asset_id,
               n.name = $summary,
               n.summary = $summary,
               n.description = $description,
               n.status = $status,
               n.level = $level,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: goal.id,
            asset_id: goal.asset_id || '',
            summary: goal.summary || goal.asset_id || goal.id,
            description: goal.description || '',
            status: goal.status || '',
            level: goal.level || '',
            source,
            importedAt,
          }
        );
        results.goals.success++;
      } catch (e) {
        results.goals.failed++;
        results.goals.errors.push({
          id: goal.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Systems
    results.systems = { total: systems.length, success: 0, failed: 0, errors: [] };
    for (const system of systems) {
      try {
        await session.run(
          `MERGE (n:System {id: $id})
           SET n.asset_id = $asset_id,
               n.name = $name,
               n.description = $description,
               n.location = $location,
               n.application_type = $application_type,
               n.is_sap = $is_sap,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: system.id,
            asset_id: system.asset_id || '',
            name: system.name || system.asset_id || system.id,
            description: system.description || '',
            location: system.location || '',
            application_type: system.application_type_information?.application_type || '',
            is_sap: system.application_type_information?.is_sap || false,
            source,
            importedAt,
          }
        );
        results.systems.success++;
      } catch (e) {
        results.systems.failed++;
        results.systems.errors.push({
          id: system.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Create relationships from terms (they have embedded relationships)
    console.log('Creating relationships from terms...');
    for (const term of terms) {
      if (term.relationships && term.relationships.length > 0) {
        for (const rel of term.relationships) {
          relationshipResults.total++;
          try {
            // Create relationship to any node type
            await session.run(
              `MATCH (a:Term {id: $sourceId})
               MATCH (b {id: $targetId})
               MERGE (a)-[r:RELATES_TO {type: $relType, source: $source, imported_at: $importedAt}]->(b)`,
              {
                sourceId: term.id,
                targetId: rel.id,
                relType: rel.type || 'RELATED',
                source,
                importedAt,
              }
            );
            relationshipResults.success++;
          } catch (e) {
            relationshipResults.failed++;
            relationshipResults.errors.push({
              source: term.id,
              target: rel.id,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    }

    // Calculate totals
    const totalNodes = Object.values(results).reduce((sum, r) => sum + r.total, 0);
    const successNodes = Object.values(results).reduce((sum, r) => sum + r.success, 0);
    const failedNodes = Object.values(results).reduce((sum, r) => sum + r.failed, 0);

    return c.json({
      success: true,
      summary: {
        nodes: {
          total: totalNodes,
          success: successNodes,
          failed: failedNodes,
        },
        relationships: {
          total: relationshipResults.total,
          success: relationshipResults.success,
          failed: relationshipResults.failed,
        },
      },
      details: results,
      relationships: relationshipResults,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('SKP Import error:', message);
    return c.json({ error: message }, 500);
  } finally {
    await session.close();
  }
});

// Endpoint to clear all imported data
skpImport.delete('/', async (c) => {
  const db = c.req.query('db') || 'neo4j';
  const driver = getDriver();
  const session = driver.session({ database: db });

  try {
    // Delete all nodes and relationships
    await session.run('MATCH (n) DETACH DELETE n');
    return c.json({ success: true, message: 'All nodes and relationships deleted' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: message }, 500);
  } finally {
    await session.close();
  }
});

export default skpImport;
