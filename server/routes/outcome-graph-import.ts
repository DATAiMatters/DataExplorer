import { Hono } from 'hono';
import { getDriver } from '../lib/neo4j';
import neo4j from 'neo4j-driver';

const outcomeGraphImport = new Hono();

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
  errors: Array<{ from: string; to: string; error: string }>;
}

function neo4jInt(value: number) {
  return neo4j.int(value);
}

// POST /api/outcome-graph-import - Import a business outcome graph JSON
outcomeGraphImport.post('/', async (c) => {
  const db = c.req.query('db') || 'neo4j';
  const source = c.req.query('source') || 'outcome-graph';
  const label = c.req.query('label');
  const importedAt = new Date().toISOString();
  const driver = getDriver();

  // Validate label if provided
  let safeLabel = '';
  if (label) {
    safeLabel = label.replace(/[^a-zA-Z0-9_]/g, '_');
    if (!/^[a-zA-Z_]/.test(safeLabel)) {
      safeLabel = '_' + safeLabel;
    }
  }

  const labelClause = safeLabel ? `SET n:\`${safeLabel}\`` : '';

  let body: any;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.assets) {
    return c.json({ error: 'Missing assets in request body' }, 400);
  }

  const session = driver.session({ database: db });
  const results: Record<string, ImportResult> = {};
  const relationshipResults: RelationshipResult = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Import Goals
    const goals = body.assets.goals || [];
    results.goals = { total: goals.length, success: 0, failed: 0, errors: [] };
    for (const goal of goals) {
      try {
        await session.run(
          `MERGE (n:Goal {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.category = $category,
               n.owner = $owner,
               n.targetValue = $targetValue,
               n.status = $status,
               n.tags = $tags,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: goal.id,
            name: goal.name,
            description: goal.description || '',
            category: goal.category || '',
            owner: goal.owner || '',
            targetValue: goal.targetValue || '',
            status: goal.status || 'active',
            tags: goal.tags || [],
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

    // Import KPIs
    const kpis = body.assets.kpis || [];
    results.kpis = { total: kpis.length, success: 0, failed: 0, errors: [] };
    for (const kpi of kpis) {
      try {
        await session.run(
          `MERGE (n:KPI {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.formula = $formula,
               n.unit = $unit,
               n.direction = $direction,
               n.targetValue = $targetValue,
               n.warningThreshold = $warningThreshold,
               n.criticalThreshold = $criticalThreshold,
               n.frequency = $frequency,
               n.owner = $owner,
               n.status = $status,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: kpi.id,
            name: kpi.name,
            description: kpi.description || '',
            formula: kpi.formula || '',
            unit: kpi.unit || '',
            direction: kpi.direction || 'higher_is_better',
            targetValue: kpi.targetValue ?? null,
            warningThreshold: kpi.warningThreshold ?? null,
            criticalThreshold: kpi.criticalThreshold ?? null,
            frequency: kpi.frequency || 'monthly',
            owner: kpi.owner || '',
            status: kpi.status || 'active',
            source,
            importedAt,
          }
        );
        results.kpis.success++;
      } catch (e) {
        results.kpis.failed++;
        results.kpis.errors.push({
          id: kpi.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Decisions
    const decisions = body.assets.decisions || [];
    results.decisions = { total: decisions.length, success: 0, failed: 0, errors: [] };
    for (const decision of decisions) {
      try {
        await session.run(
          `MERGE (n:Decision {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.ownerRole = $ownerRole,
               n.system = $system,
               n.touchpoint = $touchpoint,
               n.cadence = $cadence,
               n.criticality = $criticality,
               n.cutoffRule = $cutoffRule,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: decision.id,
            name: decision.name,
            description: decision.description || '',
            ownerRole: decision.ownerRole || '',
            system: decision.system || '',
            touchpoint: decision.touchpoint || '',
            cadence: decision.cadence || '',
            criticality: decision.criticality || 'Medium',
            cutoffRule: decision.cutoffRule || '',
            source,
            importedAt,
          }
        );
        results.decisions.success++;
      } catch (e) {
        results.decisions.failed++;
        results.decisions.errors.push({
          id: decision.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Signals
    const signals = body.assets.signals || [];
    results.signals = { total: signals.length, success: 0, failed: 0, errors: [] };
    for (const signal of signals) {
      try {
        await session.run(
          `MERGE (n:Signal {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.state = $state,
               n.valueImpactBand = $valueImpactBand,
               n.ownerRole = $ownerRole,
               n.descriptionTemplate = $descriptionTemplate,
               n.blockedAmount = $blockedAmount,
               n.dueSoonCount = $dueSoonCount,
               n.criticalSupplierCount = $criticalSupplierCount,
               n.runBlockingFlag = $runBlockingFlag,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: signal.id,
            name: signal.name,
            description: signal.description || '',
            state: signal.state || 'UNKNOWN',
            valueImpactBand: signal.valueImpactBand || 'Medium',
            ownerRole: signal.ownerRole || '',
            descriptionTemplate: signal.descriptionTemplate || '',
            blockedAmount: signal.riskDrivers?.blockedAmount ?? null,
            dueSoonCount: signal.riskDrivers?.dueSoonCount ?? null,
            criticalSupplierCount: signal.riskDrivers?.criticalSupplierCount ?? null,
            runBlockingFlag: signal.riskDrivers?.runBlockingFlag ?? null,
            source,
            importedAt,
          }
        );
        results.signals.success++;
      } catch (e) {
        results.signals.failed++;
        results.signals.errors.push({
          id: signal.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Rules
    const rules = body.assets.rules || [];
    results.rules = { total: rules.length, success: 0, failed: 0, errors: [] };
    for (const rule of rules) {
      try {
        await session.run(
          `MERGE (n:Rule {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.ruleType = $ruleType,
               n.expression = $expression,
               n.severity = $severity,
               n.passThreshold = $passThreshold,
               n.isExecutable = $isExecutable,
               n.totalRecords = $totalRecords,
               n.passedRecords = $passedRecords,
               n.failedRecords = $failedRecords,
               n.passRate = $passRate,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: rule.id,
            name: rule.name,
            description: rule.description || '',
            ruleType: rule.ruleType || 'validity',
            expression: rule.expression || '',
            severity: rule.severity || 'major',
            passThreshold: rule.passThreshold ?? 100,
            isExecutable: rule.isExecutable ?? false,
            totalRecords: rule.lastRunResult?.totalRecords ?? null,
            passedRecords: rule.lastRunResult?.passedRecords ?? null,
            failedRecords: rule.lastRunResult?.failedRecords ?? null,
            passRate: rule.lastRunResult?.passRate ?? null,
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

    // Import DataProducts
    const dataProducts = body.assets.dataProducts || [];
    results.dataProducts = { total: dataProducts.length, success: 0, failed: 0, errors: [] };
    for (const dp of dataProducts) {
      try {
        await session.run(
          `MERGE (n:DataProduct {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.version = $version,
               n.grain = $grain,
               n.primaryKey = $primaryKey,
               n.fields = $fields,
               n.objectFamily = $objectFamily,
               n.contractStability = $contractStability,
               n.ownerRole = $ownerRole,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: dp.id,
            name: dp.name,
            description: dp.description || '',
            version: dp.version || 'v1',
            grain: dp.grain || '',
            primaryKey: dp.primaryKey || [],
            fields: dp.fields || [],
            objectFamily: dp.objectFamily || '',
            contractStability: dp.contractStability || 'EXPERIMENTAL',
            ownerRole: dp.ownerRole || '',
            source,
            importedAt,
          }
        );
        results.dataProducts.success++;
      } catch (e) {
        results.dataProducts.failed++;
        results.dataProducts.errors.push({
          id: dp.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Datasets
    const datasets = body.assets.datasets || [];
    results.datasets = { total: datasets.length, success: 0, failed: 0, errors: [] };
    for (const ds of datasets) {
      try {
        await session.run(
          `MERGE (n:Dataset {id: $id})
           SET n.name = $name,
               n.description = $description,
               n.system = $system,
               n.objectFamily = $objectFamily,
               n.tableName = $tableName,
               n.fieldCount = $fieldCount,
               n.source = $source,
               n.imported_at = $importedAt
           ${labelClause}`,
          {
            id: ds.id,
            name: ds.name,
            description: ds.description || '',
            system: ds.system || '',
            objectFamily: ds.objectFamily || '',
            tableName: ds.tableName || '',
            fieldCount: ds.fieldCount ?? 0,
            source,
            importedAt,
          }
        );
        results.datasets.success++;
      } catch (e) {
        results.datasets.failed++;
        results.datasets.errors.push({
          id: ds.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Import Relationships
    const relationships = body.relationships || [];
    for (const rel of relationships) {
      relationshipResults.total++;
      try {
        // Use dynamic relationship type
        const relType = rel.type.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        await session.run(
          `MATCH (a {id: $fromId})
           MATCH (b {id: $toId})
           MERGE (a)-[r:\`${relType}\`]->(b)
           SET r.cardinality = $cardinality,
               r.source = $source,
               r.imported_at = $importedAt`,
          {
            fromId: rel.fromId,
            toId: rel.toId,
            cardinality: rel.cardinality || '',
            source,
            importedAt,
          }
        );
        relationshipResults.success++;
      } catch (e) {
        relationshipResults.failed++;
        relationshipResults.errors.push({
          from: rel.fromId,
          to: rel.toId,
          error: e instanceof Error ? e.message : String(e),
        });
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
    console.error('Outcome Graph Import error:', message);
    return c.json({ error: message }, 500);
  } finally {
    await session.close();
  }
});

export default outcomeGraphImport;
