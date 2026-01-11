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
    };

    // Top values for categorical
    if (dataType === 'string' && uniqueValues.size <= 100) {
      const valueCounts = new Map<string, number>();
      for (const v of nonNullValues) {
        const key = String(v);
        valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
      }
      profile.topValues = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
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

    profiles.push(profile);
  }

  // Also profile unmapped columns with basic info
  for (const column of source.columns) {
    if (!mappings.some((m) => m.sourceColumn === column)) {
      const values = source.parsedData.map((row) => row[column]);
      const nullCount = values.filter((v) => v === null || v === undefined || v === '').length;
      const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
      
      profiles.push({
        column,
        displayName: column,
        dataType: 'mixed',
        nullCount,
        uniqueCount: new Set(nonNullValues.map(String)).size,
        totalCount: values.length,
      });
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

  if (!sourceMapping || !targetMapping) {
    throw new Error('Network requires source_node and target_node mappings');
  }

  const nodesSet = new Set<string>();
  const edges: NetworkData['edges'] = [];

  for (const row of source.parsedData) {
    const sourceId = String(row[sourceMapping.sourceColumn] ?? '');
    const targetId = String(row[targetMapping.sourceColumn] ?? '');

    if (sourceId && targetId) {
      nodesSet.add(sourceId);
      nodesSet.add(targetId);

      edges.push({
        source: sourceId,
        target: targetId,
        weight: weightMapping ? Number(row[weightMapping.sourceColumn]) || 1 : 1,
        label: labelMapping ? String(row[labelMapping.sourceColumn] ?? '') : undefined,
      });
    }
  }

  const nodes: NetworkNode[] = Array.from(nodesSet).map((id) => ({
    id,
    label: id,
  }));

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
