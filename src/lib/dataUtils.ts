import Papa from 'papaparse';
import type { DataSource, ColumnMapping, HierarchyNode, TabularProfile, NetworkData, NetworkNode } from '@/types';

// ============================================
// FILE PARSING
// ============================================

export function parseCSV(rawData: string): { data: Record<string, unknown>[]; columns: string[] } {
  const result = Papa.parse(rawData, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const columns = result.meta.fields || [];
  const data = result.data as Record<string, unknown>[];

  return { data, columns };
}

export function parseJSON(rawData: string): { data: Record<string, unknown>[]; columns: string[] } {
  const parsed = JSON.parse(rawData);
  
  // Handle array of objects
  const data = Array.isArray(parsed) ? parsed : [parsed];
  
  // Extract columns from first object
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  return { data, columns };
}

export function parseFile(fileName: string, rawData: string): { data: Record<string, unknown>[]; columns: string[] } {
  const ext = fileName.toLowerCase().split('.').pop();
  
  if (ext === 'json') {
    return parseJSON(rawData);
  }
  
  return parseCSV(rawData);
}

// ============================================
// DATA TRANSFORMATION - HIERARCHY
// ============================================

export function transformToHierarchy(
  source: DataSource,
  mappings: ColumnMapping[]
): HierarchyNode[] {
  const nodeIdMapping = mappings.find((m) => m.roleId === 'node_id');
  const nodeLabelMapping = mappings.find((m) => m.roleId === 'node_label');
  const parentIdMapping = mappings.find((m) => m.roleId === 'parent_id');
  const metricMappings = mappings.filter((m) => m.roleId === 'metric');

  if (!nodeIdMapping || !parentIdMapping) {
    throw new Error('Hierarchy requires node_id and parent_id mappings');
  }

  const nodesMap = new Map<string, HierarchyNode>();

  // First pass: create all nodes
  for (const row of source.parsedData) {
    const id = String(row[nodeIdMapping.sourceColumn] ?? '');
    const label = nodeLabelMapping
      ? String(row[nodeLabelMapping.sourceColumn] ?? id)
      : id;
    const parentId = row[parentIdMapping.sourceColumn];
    
    const metrics: Record<string, number> = {};
    for (const mm of metricMappings) {
      const value = row[mm.sourceColumn];
      if (value !== null && value !== undefined) {
        metrics[mm.displayName] = Number(value) || 0;
      }
    }

    nodesMap.set(id, {
      id,
      label,
      parentId: parentId ? String(parentId) : null,
      metrics,
      children: [],
    });
  }

  // Second pass: build tree structure
  const roots: HierarchyNode[] = [];

  for (const node of nodesMap.values()) {
    if (!node.parentId || node.parentId === '' || !nodesMap.has(node.parentId)) {
      node.depth = 0;
      roots.push(node);
    } else {
      const parent = nodesMap.get(node.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  }

  // Third pass: calculate depths
  function setDepths(nodes: HierarchyNode[], depth: number) {
    for (const node of nodes) {
      node.depth = depth;
      if (node.children && node.children.length > 0) {
        setDepths(node.children, depth + 1);
      }
    }
  }
  setDepths(roots, 0);

  return roots;
}

// ============================================
// DATA TRANSFORMATION - TABULAR PROFILING
// ============================================

function calculateQualityScore(
  values: unknown[],
  dataType: string,
  uniqueCount: number,
  nullCount: number,
  totalCount: number,
  numericStats?: { mean: number; stdDev: number }
): { score: number; issues: import('@/types').QualityIssue[] } {
  const issues: import('@/types').QualityIssue[] = [];
  let completenessScore = 0;
  let consistencyScore = 0;
  let validityScore = 0;

  // 1. Completeness (40% weight)
  const completenessRate = (totalCount - nullCount) / totalCount;
  completenessScore = completenessRate * 40;

  if (completenessRate < 0.8) {
    issues.push({
      type: 'high_nulls',
      severity: completenessRate < 0.5 ? 'error' : 'warning',
      message: `High null rate: ${((1 - completenessRate) * 100).toFixed(1)}% missing`,
      count: nullCount,
    });
  }

  // 2. Consistency (30% weight)
  // Check for low cardinality (single value column)
  if (uniqueCount === 1 && totalCount > 1) {
    consistencyScore = 0;
    issues.push({
      type: 'low_cardinality',
      severity: 'warning',
      message: 'All values are identical',
      count: 1,
    });
  } else {
    consistencyScore = 30; // Default good score

    // For numeric columns, check for outliers
    if (dataType === 'number' && numericStats) {
      const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
      const nums = nonNullValues.map(Number).filter((n) => !isNaN(n));
      const outlierThreshold = numericStats.mean + (3 * numericStats.stdDev);
      const lowerThreshold = numericStats.mean - (3 * numericStats.stdDev);
      const outliers = nums.filter((n) => n > outlierThreshold || n < lowerThreshold);

      if (outliers.length > 0) {
        const outlierRate = outliers.length / nums.length;
        if (outlierRate > 0.05) {
          consistencyScore -= 15;
          issues.push({
            type: 'outliers',
            severity: 'info',
            message: `${outliers.length} outliers detected (>3 std dev)`,
            count: outliers.length,
          });
        }
      }
    }
  }

  // 3. Validity (30% weight)
  validityScore = 30; // Default good score

  // For string columns, check format consistency
  if (dataType === 'string') {
    const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
    const stringValues = nonNullValues.map(String);

    // Check for mixed casing
    const hasUpper = stringValues.some((v) => v !== v.toLowerCase());
    const hasLower = stringValues.some((v) => v !== v.toUpperCase());
    const hasMixedCase = hasUpper && hasLower;

    if (hasMixedCase && stringValues.length > 10) {
      const upperCount = stringValues.filter((v) => v === v.toUpperCase()).length;
      const lowerCount = stringValues.filter((v) => v === v.toLowerCase()).length;
      const mixedRate = Math.abs(upperCount - lowerCount) / stringValues.length;

      if (mixedRate > 0.3) {
        validityScore -= 10;
        issues.push({
          type: 'format_inconsistency',
          severity: 'info',
          message: 'Mixed uppercase/lowercase detected',
        });
      }
    }
  }

  const totalScore = Math.round(completenessScore + consistencyScore + validityScore);
  return { score: totalScore, issues };
}

export function profileTabularData(
  source: DataSource,
  mappings: ColumnMapping[]
): TabularProfile[] {
  const profiles: TabularProfile[] = [];

  // Profile each mapped column
  for (const mapping of mappings) {
    const column = mapping.sourceColumn;
    const values = source.parsedData.map((row) => row[column]);
    
    const nullCount = values.filter((v) => v === null || v === undefined || v === '').length;
    const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
    const uniqueValues = new Set(nonNullValues.map(String));

    // Detect data type
    let dataType: TabularProfile['dataType'] = 'string';
    const sampleNonNull = nonNullValues.slice(0, 100);
    
    if (sampleNonNull.every((v) => typeof v === 'number')) {
      dataType = 'number';
    } else if (sampleNonNull.every((v) => typeof v === 'boolean')) {
      dataType = 'boolean';
    } else if (sampleNonNull.every((v) => !isNaN(Date.parse(String(v))))) {
      dataType = 'date';
    }

    const profile: TabularProfile = {
      column,
      displayName: mapping.displayName,
      dataType,
      nullCount,
      uniqueCount: uniqueValues.size,
      totalCount: values.length,
      qualityScore: 0,
      qualityIssues: [],
    };

    // All unique values with counts for all data types (limit to 1000 unique values)
    if (uniqueValues.size <= 1000) {
      const valueCounts = new Map<string, number>();
      for (const v of nonNullValues) {
        const key = String(v);
        valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
      }
      profile.topValues = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }));
    }

    // Numeric stats
    if (dataType === 'number') {
      const nums = nonNullValues.map(Number).filter((n) => !isNaN(n));
      if (nums.length > 0) {
        nums.sort((a, b) => a - b);
        const sum = nums.reduce((a, b) => a + b, 0);
        const mean = sum / nums.length;
        const median = nums[Math.floor(nums.length / 2)];
        const variance = nums.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / nums.length;

        profile.numericStats = {
          min: nums[0],
          max: nums[nums.length - 1],
          mean,
          median,
          stdDev: Math.sqrt(variance),
        };
      }
    }

    // Calculate quality score
    const quality = calculateQualityScore(
      values,
      dataType,
      uniqueValues.size,
      nullCount,
      values.length,
      profile.numericStats
    );
    profile.qualityScore = quality.score;
    profile.qualityIssues = quality.issues;

    profiles.push(profile);
  }

  // Also profile unmapped columns with basic info
  for (const column of source.columns) {
    if (!mappings.some((m) => m.sourceColumn === column)) {
      const values = source.parsedData.map((row) => row[column]);
      const nullCount = values.filter((v) => v === null || v === undefined || v === '').length;
      const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
      const uniqueValues = new Set(nonNullValues.map(String));

      const profile: TabularProfile = {
        column,
        displayName: column,
        dataType: 'mixed',
        nullCount,
        uniqueCount: uniqueValues.size,
        totalCount: values.length,
        qualityScore: 0,
        qualityIssues: [],
      };

      // Add unique values with counts for unmapped columns too (limit to 1000)
      if (uniqueValues.size <= 1000) {
        const valueCounts = new Map<string, number>();
        for (const v of nonNullValues) {
          const key = String(v);
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        }
        profile.topValues = Array.from(valueCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({ value, count }));
      }

      // Calculate quality score for unmapped columns
      const quality = calculateQualityScore(
        values,
        'mixed',
        uniqueValues.size,
        nullCount,
        values.length
      );
      profile.qualityScore = quality.score;
      profile.qualityIssues = quality.issues;

      profiles.push(profile);
    }
  }

  return profiles;
}

// ============================================
// DATA TRANSFORMATION - NETWORK
// ============================================

export function transformToNetwork(
  source: DataSource,
  mappings: ColumnMapping[]
): NetworkData {
  const sourceMapping = mappings.find((m) => m.roleId === 'source_node');
  const targetMapping = mappings.find((m) => m.roleId === 'target_node');
  const weightMapping = mappings.find((m) => m.roleId === 'edge_weight');
  const labelMapping = mappings.find((m) => m.roleId === 'edge_label');
  const nodeGroupMapping = mappings.find((m) => m.roleId === 'node_group');
  const relationshipTypeMapping = mappings.find((m) => m.roleId === 'relationship_type');
  const cardinalityMapping = mappings.find((m) => m.roleId === 'cardinality');

  if (!sourceMapping || !targetMapping) {
    throw new Error('Network requires source_node and target_node mappings');
  }

  const nodesMap = new Map<string, { id: string; label: string; group?: string }>();
  const edges: NetworkData['edges'] = [];

  // Build nodes with group information
  for (const row of source.parsedData) {
    const sourceId = String(row[sourceMapping.sourceColumn] ?? '');
    const targetId = String(row[targetMapping.sourceColumn] ?? '');
    const nodeGroup = nodeGroupMapping ? String(row[nodeGroupMapping.sourceColumn] ?? '') : undefined;

    if (sourceId && targetId) {
      // Add source node with group if not already present
      if (!nodesMap.has(sourceId)) {
        nodesMap.set(sourceId, {
          id: sourceId,
          label: sourceId,
          group: nodeGroup,
        });
      }

      // Add target node with group if not already present
      if (!nodesMap.has(targetId)) {
        nodesMap.set(targetId, {
          id: targetId,
          label: targetId,
          group: nodeGroup,
        });
      }

      edges.push({
        source: sourceId,
        target: targetId,
        weight: weightMapping ? Number(row[weightMapping.sourceColumn]) || 1 : 1,
        label: labelMapping ? String(row[labelMapping.sourceColumn] ?? '') : undefined,
        relationshipType: relationshipTypeMapping
          ? String(row[relationshipTypeMapping.sourceColumn] ?? '')
          : undefined,
        cardinality: cardinalityMapping
          ? String(row[cardinalityMapping.sourceColumn] ?? '')
          : undefined,
      });
    }
  }

  const nodes: NetworkNode[] = Array.from(nodesMap.values());

  return { nodes, edges };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function flattenHierarchy(nodes: HierarchyNode[]): HierarchyNode[] {
  const flat: HierarchyNode[] = [];
  
  function traverse(nodeList: HierarchyNode[]) {
    for (const node of nodeList) {
      flat.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  
  traverse(nodes);
  return flat;
}

export function findNodeById(nodes: HierarchyNode[], id: string): HierarchyNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
