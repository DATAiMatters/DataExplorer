import { Hono } from 'hono';
import { getDriver } from '../lib/neo4j';

const skpImport = new Hono();

// Types matching Syniti API response structure
// Relationship schema from SKP API
interface SKPRelationship {
  id: string;                                    // ID of the related asset
  type?: string;                                 // Type of the related asset (e.g., "policy", "business_process")
  relationship?: string;                         // Relationship type (e.g., "related_to", "is part of a(n)")
  direction?: 'in' | 'out' | 'both';            // Direction of the relationship
  name?: string;                                 // Name of related asset (for display)
}

interface SKPTerm {
  id: string;
  name: string;
  definition?: string;
  status?: string;
  subject_area?: string;
  relationships?: SKPRelationship[];
}

interface SKPDataset {
  id: string;
  name: string;
  description?: string;
  system_name?: string;
  subject_area?: string;
  field_count?: number;
  categories?: string[];
  relationships?: SKPRelationship[];
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
  relationships?: SKPRelationship[];
}

interface SKPPolicy {
  id: string;
  name: string;
  description?: string;
  status?: string;
  relationships?: SKPRelationship[];
}

interface SKPGoal {
  id: string;
  asset_id?: string;
  summary?: string;
  description?: string;
  status?: string;
  level?: string;
  relationships?: SKPRelationship[];
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
  relationships?: SKPRelationship[];
}

interface SKPBusinessProcess {
  id: string;
  asset_id?: string;
  name?: string;
  description?: string;
  status?: string;
  subject_area?: string;
  data_quality_threshold_id?: string;
  relationships?: SKPRelationship[];
}

interface SKPInitiative {
  id: string;
  asset_id?: string;
  summary?: string;
  description?: string;
  status?: string;
  level?: string;
  time_frame?: string;
  start_date?: string;
  end_date?: string;
  relationships?: SKPRelationship[];
}

interface SKPProgram {
  id: string;
  asset_id?: string;
  name?: string;
  description?: string;
  summary?: string;
  status?: string;
  relationships?: SKPRelationship[];
}

interface SKPSubjectArea {
  id: string;
  name?: string;
  description?: string;
  status?: string;
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

// Rate limiter: max 8 requests per second (SKP API limit)
const rateLimiter = {
  tokens: 8,
  lastRefill: Date.now(),
  maxTokens: 8,
  refillRate: 1000, // 1 second

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Refill tokens based on elapsed time
    if (elapsed >= this.refillRate) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Wait until we can get a token
    const waitTime = this.refillRate - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.tokens = this.maxTokens - 1;
    this.lastRefill = Date.now();
  }
};

async function fetchPaginated<T>(endpoint: string): Promise<T[]> {
  const baseUrl = process.env.SKP_API_BASE;
  if (!baseUrl) {
    throw new Error('Missing SKP_API_BASE');
  }

  const allItems: T[] = [];
  let cursor = '';

  do {
    // Acquire rate limit token before making request
    await rateLimiter.acquire();

    const url = cursor
      ? `${baseUrl}/v3/${endpoint}?cursor=${encodeURIComponent(cursor)}`
      : `${baseUrl}/v3/${endpoint}`;

    const res = await fetch(url, {
      headers: { Authorization: getBasicAuthHeader() },
    });

    if (res.status === 429) {
      // Rate limited - wait and retry
      console.log(`Rate limited on ${endpoint}, waiting 1s...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    if (!res.ok) {
      throw new Error(`SKP API ${endpoint} returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as { data: T[]; cursor?: string };
    allItems.push(...data.data);
    cursor = data.cursor || '';
  } while (cursor);

  return allItems;
}

// Fetch fields for a specific dataset with rate limiting and retry logic
async function fetchDatasetFields(datasetId: string, retries = 3): Promise<SKPField[]> {
  const baseUrl = process.env.SKP_API_BASE;
  if (!baseUrl) {
    return [];
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Acquire rate limit token before making request
      await rateLimiter.acquire();

      const res = await fetch(`${baseUrl}/v3/datasets/${datasetId}/fields`, {
        headers: { Authorization: getBasicAuthHeader() },
      });

      if (res.status === 429) {
        // Rate limited - wait with exponential backoff and retry
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`Rate limited fetching fields for ${datasetId}, waiting ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

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

  console.log(`Gave up fetching fields for ${datasetId} after ${retries} retries`);
  return [];
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

    console.log('Fetching business-processes...');
    const businessProcesses = await fetchPaginated<SKPBusinessProcess>('business-processes');
    console.log(`Fetched ${businessProcesses.length} business-processes`);

    console.log('Fetching initiatives...');
    const initiatives = await fetchPaginated<SKPInitiative>('initiatives');
    console.log(`Fetched ${initiatives.length} initiatives`);

    console.log('Fetching programs...');
    const programs = await fetchPaginated<SKPProgram>('programs');
    console.log(`Fetched ${programs.length} programs`);

    console.log('Fetching subject-areas...');
    const subjectAreas = await fetchPaginated<SKPSubjectArea>('subject-areas');
    console.log(`Fetched ${subjectAreas.length} subject-areas`);

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

    // Import Business Processes
    results.businessProcesses = { total: businessProcesses.length, success: 0, failed: 0, errors: [] };
    for (const bp of businessProcesses) {
      try {
        await session.run(
          `MERGE (n:BusinessProcess {id: $id})
           SET n.asset_id = $asset_id,
               n.name = $name,
               n.description = $description,
               n.status = $status,
               n.subject_area = $subject_area,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: bp.id,
            asset_id: bp.asset_id || '',
            name: bp.name || bp.asset_id || bp.id,
            description: bp.description || '',
            status: bp.status || '',
            subject_area: bp.subject_area || '',
            source,
            importedAt,
          }
        );
        results.businessProcesses.success++;
      } catch (e) {
        results.businessProcesses.failed++;
        results.businessProcesses.errors.push({
          id: bp.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Initiatives
    results.initiatives = { total: initiatives.length, success: 0, failed: 0, errors: [] };
    for (const initiative of initiatives) {
      try {
        await session.run(
          `MERGE (n:Initiative {id: $id})
           SET n.asset_id = $asset_id,
               n.name = $summary,
               n.summary = $summary,
               n.description = $description,
               n.status = $status,
               n.level = $level,
               n.time_frame = $time_frame,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: initiative.id,
            asset_id: initiative.asset_id || '',
            summary: initiative.summary || initiative.asset_id || initiative.id,
            description: initiative.description || '',
            status: initiative.status || '',
            level: initiative.level || '',
            time_frame: initiative.time_frame || '',
            source,
            importedAt,
          }
        );
        results.initiatives.success++;
      } catch (e) {
        results.initiatives.failed++;
        results.initiatives.errors.push({
          id: initiative.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Programs
    results.programs = { total: programs.length, success: 0, failed: 0, errors: [] };
    for (const program of programs) {
      try {
        await session.run(
          `MERGE (n:Program {id: $id})
           SET n.asset_id = $asset_id,
               n.name = $name,
               n.summary = $summary,
               n.description = $description,
               n.status = $status,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: program.id,
            asset_id: program.asset_id || '',
            name: program.name || program.summary || program.asset_id || program.id,
            summary: program.summary || '',
            description: program.description || '',
            status: program.status || '',
            source,
            importedAt,
          }
        );
        results.programs.success++;
      } catch (e) {
        results.programs.failed++;
        results.programs.errors.push({
          id: program.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Subject Areas
    results.subjectAreas = { total: subjectAreas.length, success: 0, failed: 0, errors: [] };
    for (const sa of subjectAreas) {
      try {
        await session.run(
          `MERGE (n:SubjectArea {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.status = $status,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: sa.id,
            name: sa.name || sa.id,
            description: sa.description || '',
            status: sa.status || '',
            source,
            importedAt,
          }
        );
        results.subjectAreas.success++;
      } catch (e) {
        results.subjectAreas.failed++;
        results.subjectAreas.errors.push({
          id: sa.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Create relationships from ALL asset types (not just terms)
    console.log('Creating relationships from all assets...');

    // Helper to process relationships from any asset type
    const processAssetRelationships = async (
      assets: Array<{ id: string; relationships?: SKPRelationship[] }>,
      sourceType: string
    ) => {
      for (const asset of assets) {
        if (asset.relationships && asset.relationships.length > 0) {
          for (const rel of asset.relationships) {
            relationshipResults.total++;
            try {
              await session.run(
                `MATCH (a {id: $sourceId})
                 MATCH (b {id: $targetId})
                 MERGE (a)-[r:RELATES_TO]->(b)
                 SET r.relationship_type = $relType,
                     r.source_type = $sourceType,
                     r.target_type = $targetType,
                     r.direction = $direction,
                     r.source = $source,
                     r.imported_at = $importedAt`,
                {
                  sourceId: asset.id,
                  targetId: rel.id,
                  relType: rel.relationship || 'related_to',
                  sourceType,
                  targetType: rel.type || 'unknown',
                  direction: rel.direction || 'out',
                  source,
                  importedAt,
                }
              );
              relationshipResults.success++;
            } catch (e) {
              relationshipResults.failed++;
              relationshipResults.errors.push({
                source: asset.id,
                target: rel.id,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
        }
      }
    };

    // Process relationships from all asset types
    await processAssetRelationships(terms, 'Term');
    await processAssetRelationships(datasets, 'Dataset');
    await processAssetRelationships(rules, 'Rule');
    await processAssetRelationships(policies, 'Policy');
    await processAssetRelationships(goals, 'Goal');
    await processAssetRelationships(systems, 'System');
    await processAssetRelationships(businessProcesses, 'BusinessProcess');
    await processAssetRelationships(initiatives, 'Initiative');
    await processAssetRelationships(programs, 'Program');
    // Note: SubjectAreas don't typically have relationships in SKP
    console.log(`Created ${relationshipResults.success} relationships from all asset types`);

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

// Streaming import endpoint with progress updates - PARALLELIZED version
skpImport.get('/stream', async (c) => {
  const db = c.req.query('db') || 'neo4j';
  const source = c.req.query('source') || 'skp';
  const label = c.req.query('label');
  const importedAt = new Date().toISOString();
  const driver = getDriver();

  let safeLabel = '';
  if (label) {
    safeLabel = label.replace(/[^a-zA-Z0-9_]/g, '_');
    if (!/^[a-zA-Z_]/.test(safeLabel)) {
      safeLabel = '_' + safeLabel;
    }
  }

  const labelClause = safeLabel ? `SET n:\`${safeLabel}\`` : '';

  // Set up SSE response
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const session = driver.session({ database: db });
      const results: Record<string, ImportResult> = {};
      const relationshipResults: RelationshipResult = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
      };

      try {
        // Phase 1: Fetch from SKP API - in batches to avoid rate limiting
        send('phase', { phase: 'fetch', message: 'Fetching data from SKP API...' });

        const startFetch = Date.now();

        // Helper to add delay between batches (avoid rate limiting)
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Batch 1: Core entities (terms, datasets, rules)
        send('progress', { step: 'Fetching terms, datasets, rules...', current: 0, total: 10 });
        const [terms, datasets, rules] = await Promise.all([
          fetchPaginated<SKPTerm>('terms'),
          fetchPaginated<SKPDataset>('datasets'),
          fetchPaginated<SKPRule>('rules'),
        ]);
        send('progress', { step: `Fetched ${terms.length} terms, ${datasets.length} datasets, ${rules.length} rules`, current: 3, total: 10 });

        await delay(500); // Small delay to avoid rate limiting

        // Batch 2: Governance entities (policies, goals, systems)
        send('progress', { step: 'Fetching policies, goals, systems...', current: 3, total: 10 });
        const [policies, goals, systems] = await Promise.all([
          fetchPaginated<SKPPolicy>('policies'),
          fetchPaginated<SKPGoal>('goals'),
          fetchPaginated<SKPSystem>('systems'),
        ]);
        send('progress', { step: `Fetched ${policies.length} policies, ${goals.length} goals, ${systems.length} systems`, current: 6, total: 10 });

        await delay(500); // Small delay to avoid rate limiting

        // Batch 3: Strategic entities (business-processes, initiatives, programs, subject-areas)
        send('progress', { step: 'Fetching business-processes, initiatives, programs, subject-areas...', current: 6, total: 10 });
        const [businessProcesses, initiatives, programs, subjectAreas] = await Promise.all([
          fetchPaginated<SKPBusinessProcess>('business-processes'),
          fetchPaginated<SKPInitiative>('initiatives'),
          fetchPaginated<SKPProgram>('programs'),
          fetchPaginated<SKPSubjectArea>('subject-areas'),
        ]);

        const fetchTime = ((Date.now() - startFetch) / 1000).toFixed(1);

        send('progress', {
          step: `Fetched all in ${fetchTime}s: ${terms.length} terms, ${datasets.length} datasets, ${rules.length} rules, ${policies.length} policies, ${goals.length} goals, ${systems.length} systems, ${businessProcesses.length} business-processes, ${initiatives.length} initiatives, ${programs.length} programs, ${subjectAreas.length} subject-areas`,
          current: 10,
          total: 10
        });

        // Phase 2: Import to Neo4j using BATCHED operations
        send('phase', { phase: 'import', message: 'Importing to Neo4j (batched)...' });

        const BATCH_SIZE = 50; // Process 50 items per batch query

        // Helper for batched import
        async function batchImport<T>(
          items: T[],
          typeName: string,
          query: string,
          mapFn: (item: T) => Record<string, unknown>
        ): Promise<ImportResult> {
          const result: ImportResult = { total: items.length, success: 0, failed: 0, errors: [] };

          for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const batchData = batch.map(mapFn);

            try {
              await session.run(query, { batch: batchData, source, importedAt });
              result.success += batch.length;
            } catch (e) {
              // Fall back to individual inserts for this batch
              for (const item of batch) {
                try {
                  await session.run(query.replace('UNWIND $batch AS row', 'WITH $row AS row'), {
                    row: mapFn(item),
                    source,
                    importedAt
                  });
                  result.success++;
                } catch (err) {
                  result.failed++;
                  result.errors.push({
                    id: (item as { id?: string }).id || 'unknown',
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }
            }

            send('progress', {
              step: `Importing ${typeName}: ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`,
              current: result.success + result.failed,
              total: items.length,
              type: typeName,
            });
          }

          return result;
        }

        // Import Terms (batched)
        results.terms = await batchImport(terms, 'terms',
          `UNWIND $batch AS row
           MERGE (n:Term {id: row.id})
           SET n.name = row.name,
               n.definition = row.definition,
               n.status = row.status,
               n.subject_area = row.subject_area,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (term) => ({
            id: term.id,
            name: term.name,
            definition: term.definition || '',
            status: term.status || '',
            subject_area: term.subject_area || '',
          })
        );

        // Import Datasets (batched, but fields need individual handling for relationships)
        results.datasets = await batchImport(datasets, 'datasets',
          `UNWIND $batch AS row
           MERGE (n:Dataset {id: row.id})
           SET n.name = row.name,
               n.description = row.description,
               n.system_name = row.system_name,
               n.subject_area = row.subject_area,
               n.field_count = row.field_count,
               n.categories = row.categories,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (ds) => ({
            id: ds.id,
            name: ds.name,
            description: ds.description || '',
            system_name: ds.system_name || '',
            subject_area: ds.subject_area || '',
            field_count: ds.field_count || 0,
            categories: ds.categories || [],
          })
        );

        // Fetch and import fields sequentially (rate limiter handles throttling)
        send('progress', { step: 'Fetching dataset fields...', current: 0, total: datasets.length });
        results.fields = { total: 0, success: 0, failed: 0, errors: [] };

        const allFields: Array<{ datasetId: string; field: SKPField }> = [];

        // Fetch fields sequentially - rate limiter ensures we stay under 8 req/s
        for (let i = 0; i < datasets.length; i++) {
          const ds = datasets[i];
          const fields = await fetchDatasetFields(ds.id);
          fields.forEach(f => allFields.push({ datasetId: ds.id, field: f }));

          // Update progress every 5 datasets
          if ((i + 1) % 5 === 0 || i === datasets.length - 1) {
            send('progress', {
              step: `Fetching fields: ${i + 1}/${datasets.length} datasets (${allFields.length} fields)`,
              current: i + 1,
              total: datasets.length,
            });
          }
        }

        // Batch import all fields
        if (allFields.length > 0) {
          results.fields.total = allFields.length;
          for (let i = 0; i < allFields.length; i += BATCH_SIZE) {
            const batch = allFields.slice(i, i + BATCH_SIZE);
            try {
              await session.run(
                `UNWIND $batch AS row
                 MERGE (f:Field {id: row.fieldId})
                 SET f.name = row.name,
                     f.description = row.description,
                     f.data_type = row.data_type,
                     f.is_nullable = row.is_nullable,
                     f.is_primary_key = row.is_primary_key,
                     f.dataset_id = row.dataset_id,
                     f.source = $source,
                     f.imported_at = $importedAt
                 ${labelClause}
                 WITH f, row
                 MATCH (d:Dataset {id: row.dataset_id})
                 MERGE (d)-[:HAS_FIELD]->(f)`,
                {
                  batch: batch.map(({ datasetId, field }) => ({
                    fieldId: field.id || `${datasetId}:${field.name}`,
                    name: field.name,
                    description: field.description || '',
                    data_type: field.data_type || '',
                    is_nullable: field.is_nullable ?? true,
                    is_primary_key: field.is_primary_key ?? false,
                    dataset_id: datasetId,
                  })),
                  source,
                  importedAt,
                }
              );
              results.fields.success += batch.length;
            } catch {
              results.fields.failed += batch.length;
            }
          }
          send('progress', { step: `Imported ${results.fields.success} fields`, current: allFields.length, total: allFields.length });
        }

        // Import Rules (batched)
        results.rules = await batchImport(rules, 'rules',
          `UNWIND $batch AS row
           MERGE (n:Rule {id: row.id})
           SET n.asset_id = row.asset_id,
               n.name = row.statement,
               n.statement = row.statement,
               n.implication = row.implication,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (rule) => ({
            id: rule.id,
            asset_id: rule.asset_id || '',
            statement: rule.statement || rule.asset_id || rule.id,
            implication: rule.implication || '',
          })
        );

        // Import Policies (batched)
        results.policies = await batchImport(policies, 'policies',
          `UNWIND $batch AS row
           MERGE (n:Policy {id: row.id})
           SET n.name = row.name,
               n.description = row.description,
               n.status = row.status,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (policy) => ({
            id: policy.id,
            name: policy.name,
            description: policy.description || '',
            status: policy.status || '',
          })
        );

        // Import Goals (batched)
        results.goals = await batchImport(goals, 'goals',
          `UNWIND $batch AS row
           MERGE (n:Goal {id: row.id})
           SET n.asset_id = row.asset_id,
               n.name = row.summary,
               n.summary = row.summary,
               n.description = row.description,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (goal) => ({
            id: goal.id,
            asset_id: goal.asset_id || '',
            summary: goal.summary || goal.asset_id || goal.id,
            description: goal.description || '',
          })
        );

        // Import Systems (batched)
        results.systems = await batchImport(systems, 'systems',
          `UNWIND $batch AS row
           MERGE (n:System {id: row.id})
           SET n.asset_id = row.asset_id,
               n.name = row.name,
               n.description = row.description,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (system) => ({
            id: system.id,
            asset_id: system.asset_id || '',
            name: system.name || system.asset_id || system.id,
            description: system.description || '',
          })
        );

        // Import Business Processes (batched)
        results.businessProcesses = await batchImport(businessProcesses, 'business-processes',
          `UNWIND $batch AS row
           MERGE (n:BusinessProcess {id: row.id})
           SET n.asset_id = row.asset_id,
               n.name = row.name,
               n.description = row.description,
               n.status = row.status,
               n.subject_area = row.subject_area,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (bp) => ({
            id: bp.id,
            asset_id: bp.asset_id || '',
            name: bp.name || bp.asset_id || bp.id,
            description: bp.description || '',
            status: bp.status || '',
            subject_area: bp.subject_area || '',
          })
        );

        // Import Initiatives (batched)
        results.initiatives = await batchImport(initiatives, 'initiatives',
          `UNWIND $batch AS row
           MERGE (n:Initiative {id: row.id})
           SET n.asset_id = row.asset_id,
               n.name = row.summary,
               n.summary = row.summary,
               n.description = row.description,
               n.status = row.status,
               n.level = row.level,
               n.time_frame = row.time_frame,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (initiative) => ({
            id: initiative.id,
            asset_id: initiative.asset_id || '',
            summary: initiative.summary || initiative.asset_id || initiative.id,
            description: initiative.description || '',
            status: initiative.status || '',
            level: initiative.level || '',
            time_frame: initiative.time_frame || '',
          })
        );

        // Import Programs (batched)
        results.programs = await batchImport(programs, 'programs',
          `UNWIND $batch AS row
           MERGE (n:Program {id: row.id})
           SET n.asset_id = row.asset_id,
               n.name = row.name,
               n.summary = row.summary,
               n.description = row.description,
               n.status = row.status,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (program) => ({
            id: program.id,
            asset_id: program.asset_id || '',
            name: program.name || program.summary || program.asset_id || program.id,
            summary: program.summary || '',
            description: program.description || '',
            status: program.status || '',
          })
        );

        // Import Subject Areas (batched)
        results.subjectAreas = await batchImport(subjectAreas, 'subject-areas',
          `UNWIND $batch AS row
           MERGE (n:SubjectArea {id: row.id})
           SET n.name = row.name,
               n.description = row.description,
               n.status = row.status,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          (sa) => ({
            id: sa.id,
            name: sa.name || sa.id,
            description: sa.description || '',
            status: sa.status || '',
          })
        );

        // Phase 3: Create relationships (batched) - from ALL asset types
        send('phase', { phase: 'relationships', message: 'Creating relationships from all assets...' });

        // Collect relationships from ALL asset types
        interface CollectedRelationship {
          sourceId: string;
          sourceType: string;   // The Neo4j label of the source node
          targetId: string;
          targetType: string;   // The type of the target asset from SKP
          relType: string;      // The relationship type (e.g., "related_to", "is part of")
          direction: string;    // "in", "out", or "both"
        }

        const allRelationships: CollectedRelationship[] = [];

        // Helper to extract relationships from any asset
        const extractRelationships = (
          assets: Array<{ id: string; relationships?: SKPRelationship[] }>,
          sourceType: string
        ) => {
          for (const asset of assets) {
            if (asset.relationships && asset.relationships.length > 0) {
              for (const rel of asset.relationships) {
                allRelationships.push({
                  sourceId: asset.id,
                  sourceType,
                  targetId: rel.id,
                  targetType: rel.type || 'unknown',
                  relType: rel.relationship || 'related_to',
                  direction: rel.direction || 'out',
                });
              }
            }
          }
        };

        // Extract relationships from all asset types
        extractRelationships(terms, 'Term');
        extractRelationships(datasets, 'Dataset');
        extractRelationships(rules, 'Rule');
        extractRelationships(policies, 'Policy');
        extractRelationships(goals, 'Goal');
        extractRelationships(systems, 'System');
        extractRelationships(businessProcesses, 'BusinessProcess');
        extractRelationships(initiatives, 'Initiative');
        extractRelationships(programs, 'Program');
        // Note: SubjectAreas typically don't have relationships in SKP

        send('progress', {
          step: `Found ${allRelationships.length} relationships across all assets`,
          current: 0,
          total: allRelationships.length
        });

        relationshipResults.total = allRelationships.length;
        if (allRelationships.length > 0) {
          for (let i = 0; i < allRelationships.length; i += BATCH_SIZE) {
            const batch = allRelationships.slice(i, i + BATCH_SIZE);
            try {
              // Use generic match that works with any node type
              // Create RELATES_TO relationship with properties describing the relationship
              await session.run(
                `UNWIND $batch AS row
                 MATCH (a {id: row.sourceId})
                 MATCH (b {id: row.targetId})
                 MERGE (a)-[r:RELATES_TO]->(b)
                 SET r.relationship_type = row.relType,
                     r.source_type = row.sourceType,
                     r.target_type = row.targetType,
                     r.direction = row.direction,
                     r.source = $source,
                     r.imported_at = $importedAt`,
                { batch, source, importedAt }
              );
              relationshipResults.success += batch.length;
            } catch {
              relationshipResults.failed += batch.length;
            }

            send('progress', {
              step: `Creating relationships: ${Math.min(i + BATCH_SIZE, allRelationships.length)}/${allRelationships.length}`,
              current: Math.min(i + BATCH_SIZE, allRelationships.length),
              total: allRelationships.length
            });
          }
        }

        // Calculate totals
        const totalNodes = Object.values(results).reduce((sum, r) => sum + r.total, 0);
        const successNodes = Object.values(results).reduce((sum, r) => sum + r.success, 0);
        const failedNodes = Object.values(results).reduce((sum, r) => sum + r.failed, 0);

        // Send completion
        send('complete', {
          success: true,
          summary: {
            nodes: { total: totalNodes, success: successNodes, failed: failedNodes },
            relationships: {
              total: relationshipResults.total,
              success: relationshipResults.success,
              failed: relationshipResults.failed,
            },
          },
          details: results,
        });

      } catch (e) {
        send('error', { message: e instanceof Error ? e.message : 'Unknown error' });
      } finally {
        await session.close();
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

export default skpImport;
