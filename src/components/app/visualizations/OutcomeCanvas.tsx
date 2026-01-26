import { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Target, Network, GitBranch, Database, RefreshCw, HardDrive, Maximize2, Minimize2 } from 'lucide-react';
import { OutcomeLineage } from './OutcomeLineage';
import { useToast } from '@/hooks/use-toast';
import type { BusinessOutcome, KPI, CriticalDataElement, DataQualityRule } from '@/types';

// --- Semantic Graph Node & Edge Types ---
// Extended model: Goal → KPI → Decision → Signal → Rule → DataProduct → Dataset
type NodeType =
  | 'goal' | 'outcome'           // Business outcomes (goal is preferred, outcome kept for backwards compat)
  | 'kpi'                        // Key Performance Indicators
  | 'decision'                   // Decision points that protect goals
  | 'signal'                     // Health signals that can degrade decisions
  | 'rule'                       // Data quality rules
  | 'dataproduct'                // Logical data products combining datasets
  | 'dataset'                    // Physical source datasets
  | 'field'                      // Dataset fields/columns
  | 'cde'                        // Critical Data Elements (legacy)
  | 'policy' | 'term' | 'system' // SKP imports
  | 'property'                   // Property subnode (expanded from parent)
  | 'arrayitem';                 // Array item subnode (e.g., individual field names)

interface CanvasNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  entity: any; // Accept any asset type for extensibility
  dqScore: number | null;
  signalState?: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  impactScore?: number; // For business value
  maturityTier?: string; // For semantic maturity
}

interface CanvasLink extends d3.SimulationLinkDatum<CanvasNode> {
  type: string; // Allow any relationship type
}

const nodeTypeColors: Record<NodeType, string> = {
  // Core outcome traceability chain
  goal: '#10b981',        // emerald-500 - business outcomes
  outcome: '#10b981',     // emerald-500 - alias for goal
  kpi: '#3b82f6',         // blue-500 - metrics
  decision: '#f97316',    // orange-500 - decision points
  signal: '#eab308',      // yellow-500 - health signals
  rule: '#8b5cf6',        // violet-500 - DQ rules
  dataproduct: '#06b6d4', // cyan-500 - logical data products
  dataset: '#6366f1',     // indigo-500 - physical datasets
  field: '#a855f7',       // purple-500 - dataset fields/columns
  // Legacy / SKP types
  cde: '#f59e0b',         // amber-500 - critical data elements
  policy: '#84cc16',      // lime-500 - governance policies
  term: '#ec4899',        // pink-500 - business terms
  system: '#14b8a6',      // teal-500 - source systems
  // Property expansion types
  property: '#71717a',    // zinc-500 - property subnodes
  arrayitem: '#94a3b8',   // slate-400 - array items
};

// DQ health score colors
const getDqHealthColor = (score: number | null): string => {
  if (score === null) return '#52525b'; // zinc-600 - not run
  if (score >= 80) return '#10b981';    // emerald-500 - healthy
  if (score >= 60) return '#f59e0b';    // amber-500 - warning
  return '#ef4444';                      // red-500 - critical
};

// Signal state colors for health indicator rings
const getSignalStateColor = (state?: string): string => {
  switch (state) {
    case 'HEALTHY': return '#10b981';  // emerald-500
    case 'WARNING': return '#f59e0b';  // amber-500
    case 'CRITICAL': return '#ef4444'; // red-500
    default: return '#52525b';         // zinc-600 - unknown
  }
};

const edgeTypeColors: Record<string, string> = {
  // Core traceability relationships
  'ISMEASUREDBY': '#10b981',    // Goal → KPI
  'PROTECTS': '#f97316',        // Decision → Goal
  'DEGRADES': '#ef4444',        // Signal → Decision
  'ISDERIVEDFROM': '#eab308',   // Signal → Rule
  'VALIDATES': '#8b5cf6',       // Rule → DataProduct
  'USES': '#06b6d4',            // DataProduct → Dataset
  'HAS_FIELD': '#a855f7',       // Dataset → Field
  'HAS_PROPERTY': '#71717a',    // Property expansion
  // Legacy relationships
  'outcome-kpi': '#10b981',
  'kpi-cde': '#3b82f6',
  'cde-rule': '#f59e0b',
  'enforces': '#eab308',
  'defines': '#6366f1',
  'impacts': '#ef4444',
  'RELATES_TO': '#71717a',
  'RELATION': '#71717a', // Default for Neo4j relationships
};

// Neo4j graph response types
interface Neo4jNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

interface Neo4jRelationship {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  startNodeId: string;
  endNodeId: string;
}

interface Neo4jGraphResponse {
  nodes: Neo4jNode[];
  relationships: Neo4jRelationship[];
}

export function OutcomeCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);
  const [linkStrength, setLinkStrength] = useState(0.4);
  const [chargeStrength, setChargeStrength] = useState(-400);
  const [viewMode, setViewMode] = useState<'force' | 'lineage'>('force');
  const [semanticQuery, setSemanticQuery] = useState('');
  const [showInspirationModal, setShowInspirationModal] = useState(false);
  const [showAISuggestionPanel, setShowAISuggestionPanel] = useState(false);
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    phase: string;
    message: string;
    step?: string;
    current?: number;
    total?: number;
    type?: string;
  } | null>(null);
  const [importDb, setImportDb] = useState('neo4j');
  const [importSource, setImportSource] = useState('skp');
  const [importLabel, setImportLabel] = useState('');
  const [dataSource, setDataSource] = useState<'local' | 'neo4j'>('local');
  const [neo4jData, setNeo4jData] = useState<Neo4jGraphResponse | null>(null);
  const [loadingNeo4j, setLoadingNeo4j] = useState(false);
  const [nodeLimit, setNodeLimit] = useState(500);
  const [filteredNodeIds, setFilteredNodeIds] = useState<Set<string> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Radial context menu state
  const [contextMenuNode, setContextMenuNode] = useState<CanvasNode | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  // Locked nodes (fixed position)
  const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set());
  // Nodes with expanded properties shown
  const [expandedPropertyNodes, setExpandedPropertyNodes] = useState<Set<string>>(new Set());
  // Nodes with collapsed edges
  const [collapsedEdgeNodes, setCollapsedEdgeNodes] = useState<Set<string>>(new Set());
  // Property subnodes that are dynamically added to the graph
  const [propertyNodes, setPropertyNodes] = useState<CanvasNode[]>([]);
  const [propertyLinks, setPropertyLinks] = useState<CanvasLink[]>([]);

  const outcomes = useAppStore((s) => s.businessOutcomes);
  const kpis = useAppStore((s) => s.kpis);
  const cdes = useAppStore((s) => s.cdes);
  const dqRules = useAppStore((s) => s.dqRules);

  // Fetch Neo4j graph data
  const fetchNeo4jGraph = async () => {
    setLoadingNeo4j(true);
    try {
      const sourceParam = importSource ? `&source=${encodeURIComponent(importSource)}` : '';
      const labelParam = importLabel ? `&label=${encodeURIComponent(importLabel)}` : '';
      const res = await fetch(`/api/graph?limit=${nodeLimit}&db=${encodeURIComponent(importDb)}${sourceParam}${labelParam}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch graph: ${res.status}`);
      }
      const data: Neo4jGraphResponse = await res.json();
      setNeo4jData(data);
      toast({
        title: 'Graph Loaded',
        description: `${data.nodes.length} nodes, ${data.relationships.length} relationships`,
      });
    } catch (e) {
      toast({
        title: 'Failed to load Neo4j graph',
        description: String(e),
        variant: 'destructive',
      });
    } finally {
      setLoadingNeo4j(false);
    }
  };

  // Helper to calculate DQ score for a CDE based on its rules
  const calculateCdeDqScore = (cdeId: string): number | null => {
    const cdeRules = dqRules.filter((r) => r.cdeId === cdeId && r.lastRunResult);
    if (cdeRules.length === 0) return null;
    return cdeRules.reduce((sum, r) => sum + (r.lastRunResult?.passRate || 0), 0) / cdeRules.length;
  };

  // Helper to calculate DQ score for a KPI based on linked CDEs
  const calculateKpiDqScore = (kpiId: string): number | null => {
    const kpiCdes = cdes.filter((cde) => cde.kpiIds.includes(kpiId));
    const scores = kpiCdes.map((cde) => calculateCdeDqScore(cde.id)).filter((s): s is number => s !== null);
    if (scores.length === 0) return null;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  };

  // Helper to calculate DQ score for an Outcome based on linked KPIs
  const calculateOutcomeDqScore = (outcomeId: string): number | null => {
    const outcomeKpis = kpis.filter((kpi) => kpi.outcomeIds.includes(outcomeId));
    const scores = outcomeKpis.map((kpi) => calculateKpiDqScore(kpi.id)).filter((s): s is number => s !== null);
    if (scores.length === 0) return null;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  };

  // Build graph data from local business outcomes entities
  const localGraphData = useMemo(() => {
    const nodes: CanvasNode[] = [];
    const links: CanvasLink[] = [];
    const nodeMap = new Map<string, CanvasNode>();

    // Add outcome nodes
    for (const outcome of outcomes) {
      const node: CanvasNode = {
        id: `outcome-${outcome.id}`,
        label: outcome.name,
        type: 'outcome',
        entity: outcome,
        dqScore: calculateOutcomeDqScore(outcome.id),
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    }

    // Add KPI nodes and links to outcomes
    for (const kpi of kpis) {
      const node: CanvasNode = {
        id: `kpi-${kpi.id}`,
        label: kpi.name,
        type: 'kpi',
        entity: kpi,
        dqScore: calculateKpiDqScore(kpi.id),
      };
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Link to outcomes
      for (const outcomeId of kpi.outcomeIds) {
        const outcomeNodeId = `outcome-${outcomeId}`;
        if (nodeMap.has(outcomeNodeId)) {
          links.push({
            source: outcomeNodeId,
            target: node.id,
            type: 'outcome-kpi',
          });
        }
      }
    }

    // Add CDE nodes and links to KPIs
    for (const cde of cdes) {
      const node: CanvasNode = {
        id: `cde-${cde.id}`,
        label: cde.name,
        type: 'cde',
        entity: cde,
        dqScore: calculateCdeDqScore(cde.id),
      };
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Link to KPIs
      for (const kpiId of cde.kpiIds) {
        const kpiNodeId = `kpi-${kpiId}`;
        if (nodeMap.has(kpiNodeId)) {
          links.push({
            source: kpiNodeId,
            target: node.id,
            type: 'kpi-cde',
          });
        }
      }
    }

    // Add Rule nodes and links to CDEs
    for (const rule of dqRules) {
      // Rule score is directly from lastRunResult
      const ruleScore = rule.lastRunResult?.passRate ?? null;
      const node: CanvasNode = {
        id: `rule-${rule.id}`,
        label: rule.name,
        type: 'rule',
        entity: rule,
        dqScore: ruleScore,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Link to CDE
      if (rule.cdeId) {
        const cdeNodeId = `cde-${rule.cdeId}`;
        if (nodeMap.has(cdeNodeId)) {
          links.push({
            source: cdeNodeId,
            target: node.id,
            type: 'cde-rule',
          });
        }
      }
    }

    return { nodes, links };
  }, [outcomes, kpis, cdes, dqRules]);

  // Convert Neo4j data to canvas format
  const neo4jGraphData = useMemo(() => {
    if (!neo4jData) return { nodes: [], links: [] };

    const validNodeTypes: NodeType[] = [
      'goal', 'outcome', 'kpi', 'decision', 'signal', 'rule',
      'dataproduct', 'dataset', 'cde', 'policy', 'term', 'system'
    ];

    const nodes: CanvasNode[] = neo4jData.nodes.map((n) => {
      // Map Neo4j labels to our node types
      const label = n.labels[0]?.toLowerCase() || 'dataset';
      const nodeType: NodeType = validNodeTypes.includes(label as NodeType)
        ? (label as NodeType)
        : 'dataset';

      // Extract signal state for Signal nodes
      const signalState = nodeType === 'signal'
        ? (n.properties.state as 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN')
        : undefined;

      // Extract DQ score from rules (passRate property)
      const dqScore = nodeType === 'rule' && n.properties.passRate != null
        ? (n.properties.passRate as number)
        : null;

      return {
        id: n.id,
        label: (n.properties.name as string) || (n.properties.id as string) || n.id,
        type: nodeType,
        entity: n.properties,
        dqScore,
        signalState,
      };
    });

    const links: CanvasLink[] = neo4jData.relationships.map((r) => ({
      source: r.startNodeId,
      target: r.endNodeId,
      type: r.type || 'RELATION',
    }));

    return { nodes, links };
  }, [neo4jData]);

  // Select data source
  const graphData = dataSource === 'neo4j' ? neo4jGraphData : localGraphData;

  const stats = useMemo(() => {
    if (dataSource === 'neo4j') {
      return {
        nodes: graphData.nodes.length,
        relationships: graphData.links.length,
        source: 'Neo4j',
      };
    }
    return {
      outcomes: outcomes.length,
      kpis: kpis.length,
      cdes: cdes.length,
      rules: dqRules.length,
      links: graphData.links.length,
      source: 'Local',
    };
  }, [dataSource, outcomes, kpis, cdes, dqRules, graphData]);

  // Compute counts per node type for legend (including property nodes)
  const nodeCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of graphData.nodes) {
      counts[node.type] = (counts[node.type] || 0) + 1;
    }
    // Also count dynamically added property nodes
    for (const node of propertyNodes) {
      counts[node.type] = (counts[node.type] || 0) + 1;
    }
    return counts;
  }, [graphData.nodes, propertyNodes]);

  // Legend panel visibility
  const [showLegend, setShowLegend] = useState(true);

  // --- Traceability Path Highlighting ---
  // tracePath is used in the D3 rendering to highlight paths
  const [tracePath, _setTracePath] = useState<string[]>([]);

  async function handleSKPImport() {
    setImporting(true);
    setImportProgress({ phase: 'connecting', message: 'Connecting to SKP API...' });

    try {
      const sourceParam = importSource ? `&source=${encodeURIComponent(importSource)}` : '';
      const labelParam = importLabel ? `&label=${encodeURIComponent(importLabel)}` : '';

      // Use streaming endpoint for progress updates
      const eventSource = new EventSource(`/api/skp-import/stream?db=${encodeURIComponent(importDb)}${sourceParam}${labelParam}`);

      await new Promise<void>((resolve, reject) => {
        eventSource.addEventListener('phase', (e) => {
          const data = JSON.parse(e.data);
          setImportProgress({
            phase: data.phase,
            message: data.message,
            total: data.totalItems,
          });
        });

        eventSource.addEventListener('progress', (e) => {
          const data = JSON.parse(e.data);
          setImportProgress(prev => ({
            ...prev!,
            step: data.step,
            current: data.current,
            total: data.total || prev?.total,
            type: data.type,
          }));
        });

        eventSource.addEventListener('complete', (e) => {
          const data = JSON.parse(e.data);
          eventSource.close();

          if (data.success) {
            const nodeCount = data.summary?.nodes?.success ?? 0;
            const relCount = data.summary?.relationships?.success ?? 0;

            let details = '';
            if (data.details) {
              const parts: string[] = [];
              for (const [type, result] of Object.entries(data.details)) {
                const r = result as { success: number };
                if (r.success > 0) {
                  parts.push(`${r.success} ${type}`);
                }
              }
              if (parts.length > 0) {
                details = ` (${parts.join(', ')})`;
              }
            }

            toast({
              title: 'SKP Import Complete',
              description: `${nodeCount} nodes${details}, ${relCount} relationships imported.`
            });
          }
          resolve();
        });

        eventSource.addEventListener('error', (e) => {
          if (e instanceof MessageEvent) {
            const data = JSON.parse(e.data);
            reject(new Error(data.message || 'Unknown error'));
          } else {
            reject(new Error('Connection error'));
          }
          eventSource.close();
        });

        eventSource.onerror = () => {
          eventSource.close();
          reject(new Error('Connection lost'));
        };
      });

      // Auto-switch to Neo4j view and refresh
      setDataSource('neo4j');
      await fetchNeo4jGraph();

    } catch (e) {
      toast({
        title: 'SKP Import Error',
        description: String(e),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function handlePTPSampleImport() {
    setImporting(true);
    try {
      // Fetch the PTP sample JSON
      const sampleRes = await fetch('/samples/ptp-business-outcome-graph.json');
      if (!sampleRes.ok) {
        throw new Error('Failed to load PTP sample file');
      }
      const sampleData = await sampleRes.json();

      // Import to Neo4j
      const sourceParam = `&source=ptp-sample`;
      const labelParam = importLabel ? `&label=${encodeURIComponent(importLabel)}` : '&label=PTP_Demo';
      const res = await fetch(`/api/outcome-graph-import?db=${encodeURIComponent(importDb)}${sourceParam}${labelParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleData),
      });
      const data = await res.json();

      if (data.success) {
        const nodeCount = data.summary?.nodes?.success ?? 0;
        const relCount = data.summary?.relationships?.success ?? 0;

        let details = '';
        if (data.details) {
          const parts: string[] = [];
          for (const [type, result] of Object.entries(data.details)) {
            const r = result as { success: number };
            if (r.success > 0) {
              parts.push(`${r.success} ${type}`);
            }
          }
          if (parts.length > 0) {
            details = ` (${parts.join(', ')})`;
          }
        }

        toast({
          title: 'PTP Sample Import Complete',
          description: `${nodeCount} nodes${details}, ${relCount} relationships imported. Refreshing graph...`
        });
        // Set filters to show only PTP sample data, then switch to Neo4j view
        setImportSource('ptp-sample');
        setImportLabel('PTP_Demo');
        setDataSource('neo4j');
        // Fetch with the PTP filters
        const ptpSourceParam = '&source=ptp-sample';
        const ptpLabelParam = '&label=PTP_Demo';
        const ptpRes = await fetch(`/api/graph?limit=${nodeLimit}&db=${encodeURIComponent(importDb)}${ptpSourceParam}${ptpLabelParam}`);
        if (ptpRes.ok) {
          const ptpData = await ptpRes.json();
          setNeo4jData(ptpData);
        }
      } else {
        toast({
          title: 'PTP Import Error',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'PTP Import Error',
        description: String(e),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }

  // Keyboard handler for fullscreen mode (Escape to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 500;

    // Merge base graph data with dynamically expanded property nodes
    const nodes: CanvasNode[] = [
      ...graphData.nodes.map((d) => ({ ...d })),
      ...propertyNodes.map((d) => ({ ...d })),
    ];
    const links: CanvasLink[] = [
      ...graphData.links.map((d) => ({
        source: d.source as string,
        target: d.target as string,
        type: d.type,
      })),
      ...propertyLinks.map((d) => ({
        source: d.source as string,
        target: d.target as string,
        type: d.type,
      })),
    ];

    // Size nodes based on their connections
    const nodeDegrees = new Map<string, number>();
    for (const link of graphData.links) {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as CanvasNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as CanvasNode).id;
      nodeDegrees.set(sourceId, (nodeDegrees.get(sourceId) || 0) + 1);
      nodeDegrees.set(targetId, (nodeDegrees.get(targetId) || 0) + 1);
    }

    const sizeScale = d3
      .scaleSqrt()
      .domain([0, Math.max(...Array.from(nodeDegrees.values()), 1)])
      .range([12, 28]);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<CanvasNode, CanvasLink>(links)
          .id((d) => d.id)
          .strength(linkStrength)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<CanvasNode>().radius((d) => sizeScale(nodeDegrees.get(d.id) || 0) + 8));

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Add arrow markers
    const defs = svg.append('defs');
    Object.entries(edgeTypeColors).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color);
    });

    // Draw edges (respecting collapsed nodes)
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d) => tracePath.includes(d.source as string) && tracePath.includes(d.target as string)
        ? '#ef4444' // Highlighted path color
        : edgeTypeColors[d.type] || '#404040')
      .attr('stroke-opacity', (d) => {
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as CanvasNode).id;
        const targetId = typeof d.target === 'string' ? d.target : (d.target as CanvasNode).id;
        // Hide edges if either node is collapsed
        if (collapsedEdgeNodes.has(sourceId) || collapsedEdgeNodes.has(targetId)) {
          return 0;
        }
        return 0.6;
      })
      .attr('stroke-width', (d) => tracePath.includes(d.source as string) && tracePath.includes(d.target as string)
        ? 4 : 2)
      .attr('marker-end', (d) => `url(#arrow-${d.type})`);

    // Draw health indicator rings (outer ring showing health status)
    // For Signal nodes: use signal state color
    // For Rule nodes: use DQ score color
    // For others: use DQ score if available
    const healthRing = g
      .append('g')
      .attr('class', 'health-rings')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => sizeScale(nodeDegrees.get(d.id) || 0) + 4)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        // Signal nodes use signal state
        if (d.type === 'signal' && d.signalState) {
          return getSignalStateColor(d.signalState);
        }
        // Others use DQ score
        return getDqHealthColor(d.dqScore);
      })
      .attr('stroke-width', 3)
      .attr('stroke-opacity', (d) => {
        if (d.type === 'signal' && d.signalState) return 0.8;
        return d.dqScore !== null ? 0.8 : 0.3;
      })
      .attr('stroke-dasharray', (d) => {
        if (d.type === 'signal' && d.signalState) return 'none';
        return d.dqScore === null ? '4,2' : 'none';
      });

    // Draw nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => sizeScale(nodeDegrees.get(d.id) || 0))
      .attr('fill', (d) => nodeTypeColors[d.type])
      .attr('stroke', (d) => lockedNodes.has(d.id) ? '#f59e0b' : '#18181b')
      .attr('stroke-width', (d) => lockedNodes.has(d.id) ? 3 : 2)
      .attr('opacity', (d) => filteredNodeIds === null || filteredNodeIds.has(d.id) ? 1 : 0.15)
      .style('cursor', 'grab')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 3);
        setHoveredNode(d);
      })
      .on('mouseout', function (_event, d) {
        d3.select(this)
          .attr('stroke', lockedNodes.has(d.id) ? '#f59e0b' : '#18181b')
          .attr('stroke-width', lockedNodes.has(d.id) ? 3 : 2);
        setHoveredNode(null);
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        // Show radial context menu at node position
        setContextMenuNode(d);
        setContextMenuPosition({ x: d.x!, y: d.y! });
      })
      .call(
        d3
          .drag<SVGCircleElement, CanvasNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            // Keep node fixed if locked
            if (!lockedNodes.has(d.id)) {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Radial context menu group
    const radialMenuGroup = g.append('g').attr('class', 'radial-menu').style('display', 'none');

    // Menu background circle
    radialMenuGroup.append('circle')
      .attr('r', 50)
      .attr('fill', 'rgba(24, 24, 27, 0.9)')
      .attr('stroke', '#3f3f46')
      .attr('stroke-width', 2);

    // Define menu actions with icons (as SVG paths)
    const menuActions = [
      {
        id: 'lock',
        angle: -90, // top
        icon: 'M12 17a2 2 0 002-2v-4a2 2 0 00-2-2H8a2 2 0 00-2 2v4a2 2 0 002 2h4zm0 0V9a4 4 0 10-8 0v8', // lock icon path
        label: 'Lock'
      },
      {
        id: 'properties',
        angle: 30, // bottom-right
        icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', // eye icon path
        label: 'Properties'
      },
      {
        id: 'collapse',
        angle: 150, // bottom-left
        icon: 'M19 14l-7 7m0 0l-7-7m7 7V3', // collapse icon path
        label: 'Collapse'
      }
    ];

    // Create menu buttons
    menuActions.forEach((action) => {
      const angleRad = (action.angle * Math.PI) / 180;
      const buttonRadius = 35;
      const bx = Math.cos(angleRad) * buttonRadius;
      const by = Math.sin(angleRad) * buttonRadius;

      const buttonGroup = radialMenuGroup.append('g')
        .attr('class', `menu-button menu-button-${action.id}`)
        .attr('transform', `translate(${bx}, ${by})`)
        .style('cursor', 'pointer');

      // Button background
      buttonGroup.append('circle')
        .attr('r', 16)
        .attr('fill', '#27272a')
        .attr('stroke', '#52525b')
        .attr('stroke-width', 1.5)
        .on('mouseover', function() {
          d3.select(this).attr('fill', '#3f3f46').attr('stroke', '#71717a');
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill', '#27272a').attr('stroke', '#52525b');
        });

      // Button icon (simplified - using text for now)
      const iconText = action.id === 'lock' ? '🔒' : action.id === 'properties' ? '👁' : '⇄';
      buttonGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#a1a1aa')
        .attr('font-size', '12px')
        .text(iconText);

      // Click handler for each button
      buttonGroup.on('click', function(event) {
        event.stopPropagation();
        const menuNode = contextMenuNode;
        if (!menuNode) return;

        if (action.id === 'lock') {
          // Toggle lock
          setLockedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(menuNode.id)) {
              newSet.delete(menuNode.id);
              // Unlock the node in simulation
              const simNode = nodes.find(n => n.id === menuNode.id);
              if (simNode) {
                simNode.fx = null;
                simNode.fy = null;
              }
            } else {
              newSet.add(menuNode.id);
              // Lock the node at current position
              const simNode = nodes.find(n => n.id === menuNode.id);
              if (simNode) {
                simNode.fx = simNode.x;
                simNode.fy = simNode.y;
              }
            }
            return newSet;
          });
        } else if (action.id === 'properties') {
          // Toggle property expansion - works for both regular nodes and property nodes (to expand arrays)
          setExpandedPropertyNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(menuNode.id)) {
              newSet.delete(menuNode.id);
              // Remove child property/array nodes
              setPropertyNodes(pn => pn.filter(p => !p.id.startsWith(`prop:${menuNode.id}:`) && !p.id.startsWith(`arr:${menuNode.id}:`)));
              setPropertyLinks(pl => pl.filter(l => {
                const sourceId = typeof l.source === 'string' ? l.source : (l.source as CanvasNode).id;
                return sourceId !== menuNode.id;
              }));
            } else {
              newSet.add(menuNode.id);

              // Check if this is a property node containing an array (for expanding array items)
              if (menuNode.type === 'property' && menuNode.entity?.isArray && Array.isArray(menuNode.entity.value)) {
                const arrayValues = menuNode.entity.value as unknown[];
                const newArrayNodes: CanvasNode[] = [];
                const newArrayLinks: CanvasLink[] = [];

                arrayValues.forEach((item, idx) => {
                  const arrNodeId = `arr:${menuNode.id}:${idx}`;
                  const displayValue = typeof item === 'object'
                    ? JSON.stringify(item).slice(0, 25)
                    : String(item).slice(0, 25);

                  newArrayNodes.push({
                    id: arrNodeId,
                    label: displayValue,
                    type: 'arrayitem',
                    entity: { value: item, parentId: menuNode.id, index: idx },
                    dqScore: null,
                    x: (menuNode.x || 0) + Math.cos(idx * 0.5) * 60,
                    y: (menuNode.y || 0) + Math.sin(idx * 0.5) * 60,
                  });

                  newArrayLinks.push({
                    source: menuNode.id,
                    target: arrNodeId,
                    type: 'HAS_PROPERTY',
                  });
                });

                setPropertyNodes(pn => [...pn, ...newArrayNodes]);
                setPropertyLinks(pl => [...pl, ...newArrayLinks]);
              } else {
                // Regular node - expand its properties
                const entity = menuNode.entity;
                if (entity && typeof entity === 'object') {
                  const newPropNodes: CanvasNode[] = [];
                  const newPropLinks: CanvasLink[] = [];

                  Object.entries(entity).forEach(([key, value], idx) => {
                    if (value === null || value === undefined || key === 'id') return;

                    const isArray = Array.isArray(value);
                    const propNodeId = `prop:${menuNode.id}:${key}`;
                    const displayValue = isArray
                      ? `${key} [${(value as unknown[]).length}]`
                      : `${key}: ${String(value).slice(0, 20)}${String(value).length > 20 ? '...' : ''}`;

                    newPropNodes.push({
                      id: propNodeId,
                      label: displayValue,
                      type: 'property',
                      entity: { key, value, parentId: menuNode.id, isArray },
                      dqScore: null,
                      x: (menuNode.x || 0) + Math.cos(idx * 0.8) * 80,
                      y: (menuNode.y || 0) + Math.sin(idx * 0.8) * 80,
                    });

                    newPropLinks.push({
                      source: menuNode.id,
                      target: propNodeId,
                      type: 'HAS_PROPERTY',
                    });
                  });

                  setPropertyNodes(pn => [...pn, ...newPropNodes]);
                  setPropertyLinks(pl => [...pl, ...newPropLinks]);
                }
              }
            }
            return newSet;
          });
        } else if (action.id === 'collapse') {
          // Toggle edge collapse
          setCollapsedEdgeNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(menuNode.id)) {
              newSet.delete(menuNode.id);
            } else {
              newSet.add(menuNode.id);
            }
            return newSet;
          });
        }

        // Hide menu after action
        setContextMenuNode(null);
        setContextMenuPosition(null);
      });
    });

    // Click on background to close menu
    svg.on('click', () => {
      setContextMenuNode(null);
      setContextMenuPosition(null);
    });

    // Draw labels
    const label = g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => sizeScale(nodeDegrees.get(d.id) || 0) + 14)
      .attr('fill', '#a1a1aa')
      .attr('font-size', '11px')
      .attr('pointer-events', 'none')
      .attr('opacity', (d) => filteredNodeIds === null || filteredNodeIds.has(d.id) ? 1 : 0.15)
      .text((d) => d.label.length > 20 ? d.label.slice(0, 18) + '...' : d.label);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as CanvasNode).x!)
        .attr('y1', (d) => (d.source as CanvasNode).y!)
        .attr('x2', (d) => (d.target as CanvasNode).x!)
        .attr('y2', (d) => (d.target as CanvasNode).y!);

      healthRing.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

      node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

      label.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
    });

    // Update radial menu position when contextMenuPosition changes
    if (contextMenuPosition) {
      radialMenuGroup
        .style('display', 'block')
        .attr('transform', `translate(${contextMenuPosition.x}, ${contextMenuPosition.y})`);

      // Update lock button icon based on locked state
      const lockButton = radialMenuGroup.select('.menu-button-lock text');
      if (contextMenuNode && lockedNodes.has(contextMenuNode.id)) {
        lockButton.text('🔓'); // unlocked icon when node is locked
      } else {
        lockButton.text('🔒'); // locked icon when node is unlocked
      }

      // Update properties button icon
      const propsButton = radialMenuGroup.select('.menu-button-properties text');
      if (contextMenuNode && expandedPropertyNodes.has(contextMenuNode.id)) {
        propsButton.text('🙈'); // hide properties
      } else {
        propsButton.text('👁'); // show properties
      }

      // Update collapse button icon
      const collapseButton = radialMenuGroup.select('.menu-button-collapse text');
      if (contextMenuNode && collapsedEdgeNodes.has(contextMenuNode.id)) {
        collapseButton.text('⤢'); // expand
      } else {
        collapseButton.text('⇄'); // collapse
      }
    } else {
      radialMenuGroup.style('display', 'none');
    }

    return () => {
      simulation.stop();
    };
  }, [graphData, linkStrength, chargeStrength, tracePath, filteredNodeIds, lockedNodes, contextMenuPosition, contextMenuNode, expandedPropertyNodes, collapsedEdgeNodes, propertyNodes, propertyLinks]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      zoomBehaviorRef.current.scaleBy,
      factor
    );
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      zoomBehaviorRef.current.transform,
      d3.zoomIdentity
    );
  };

  const handleSemanticQuery = () => {
    if (!semanticQuery.trim()) {
      // Clear filter
      setFilteredNodeIds(null);
      return;
    }

    const query = semanticQuery.toLowerCase();
    const matchingIds = new Set<string>();

    // Simple text matching across node properties
    for (const node of graphData.nodes) {
      const searchText = [
        node.label,
        node.type,
        node.entity?.description,
        node.entity?.name,
        node.entity?.formula,
        node.entity?.expression,
        node.entity?.system,
        node.entity?.tableName,
        node.entity?.objectFamily,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (searchText.includes(query)) {
        matchingIds.add(node.id);
      }
    }

    // Also include connected nodes (one hop) for context
    for (const link of graphData.links) {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as CanvasNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as CanvasNode).id;

      if (matchingIds.has(sourceId)) {
        matchingIds.add(targetId);
      }
      if (matchingIds.has(targetId)) {
        matchingIds.add(sourceId);
      }
    }

    setFilteredNodeIds(matchingIds.size > 0 ? matchingIds : null);

    toast({
      title: matchingIds.size > 0 ? `Found ${matchingIds.size} matching nodes` : 'No matches found',
      description: matchingIds.size > 0 ? 'Matching nodes are highlighted' : 'Try a different search term',
    });
  };

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Target className="w-8 h-8 text-zinc-600" />
        </div>
        <h3 className="text-lg font-medium text-zinc-300">No traceability data</h3>
        <p className="text-zinc-500 text-sm mt-1 max-w-sm">
          Create outcomes, KPIs, CDEs, and rules, then link them together to see the traceability graph.
        </p>
      </div>
    );
  }

  // Render lineage view
  if (viewMode === 'lineage') {
    return (
      <div className="h-full flex flex-col">
        {/* View Toggle */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('force')}
              className="h-7 px-3 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <Network className="w-3.5 h-3.5 mr-1.5" />
              Force
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('lineage')}
              className="h-7 px-3 text-xs bg-zinc-700 text-zinc-100"
            >
              <GitBranch className="w-3.5 h-3.5 mr-1.5" />
              Lineage
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{stats.outcomes} Outcomes</span>
            <span>{stats.kpis} KPIs</span>
            <span>{stats.cdes} CDEs</span>
            <span>{stats.rules} Rules</span>
          </div>
        </div>
        <div className="flex-1">
          <OutcomeLineage />
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-zinc-950' : 'h-full'} flex flex-col`}>
      {/* Controls - hidden in fullscreen */}
      {!isFullscreen && (
      <>
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('force')}
              className="h-7 px-3 text-xs bg-zinc-700 text-zinc-100"
            >
              <Network className="w-3.5 h-3.5 mr-1.5" />
              Force
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('lineage')}
              className="h-7 px-3 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <GitBranch className="w-3.5 h-3.5 mr-1.5" />
              Lineage
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handleZoom(1.3)}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleZoom(0.7)}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleResetZoom}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Link:</span>
            <Slider
              className="w-20"
              value={[linkStrength]}
              min={0.1}
              max={1}
              step={0.1}
              onValueChange={([v]) => setLinkStrength(v)}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Spread:</span>
            <Slider
              className="w-20"
              value={[-chargeStrength]}
              min={100}
              max={800}
              step={50}
              onValueChange={([v]) => setChargeStrength(-v)}
            />
          </div>

          {/* Data Source Toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDataSource('local')}
              className={`h-7 px-3 text-xs ${dataSource === 'local' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <HardDrive className="w-3.5 h-3.5 mr-1.5" />
              Local
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDataSource('neo4j');
                if (!neo4jData) fetchNeo4jGraph();
              }}
              className={`h-7 px-3 text-xs ${dataSource === 'neo4j' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Database className="w-3.5 h-3.5 mr-1.5" />
              Neo4j
            </Button>
          </div>

          {dataSource === 'neo4j' && (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNeo4jGraph}
              disabled={loadingNeo4j}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingNeo4j ? 'animate-spin' : ''}`} />
              {loadingNeo4j ? 'Loading...' : 'Refresh'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={handleSKPImport}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import SKP'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ml-1"
            onClick={handlePTPSampleImport}
            disabled={importing}
          >
            PTP Sample
          </Button>
          <input
            type="text"
            className="ml-2 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs w-24"
            value={importDb}
            onChange={e => setImportDb(e.target.value)}
            placeholder="Database"
            aria-label="Neo4j database name"
            title="Neo4j database name"
          />
          <input
            type="text"
            className="ml-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs w-24"
            value={importSource}
            onChange={e => setImportSource(e.target.value)}
            placeholder="Source tag"
            aria-label="Source tag for filtering"
            title="Source tag to identify this import (for filtering)"
          />
          <input
            type="text"
            className="ml-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs w-32"
            value={importLabel}
            onChange={e => setImportLabel(e.target.value)}
            placeholder="Label (e.g. SKP_Prod)"
            aria-label="Neo4j label for nodes"
            title="Additional Neo4j label applied to all imported nodes"
          />
          <input
            type="number"
            className="ml-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs w-20"
            value={nodeLimit}
            onChange={e => setNodeLimit(Math.max(1, Math.min(10000, parseInt(e.target.value) || 500)))}
            min={1}
            max={10000}
            aria-label="Node limit"
            title="Maximum number of nodes to fetch (1-10000)"
          />
        </div>

        {/* Import Progress Indicator */}
        {importProgress && (
          <div className="flex items-center gap-3 bg-zinc-800/80 rounded-lg px-3 py-1.5 border border-zinc-700">
            <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
            <div className="flex flex-col">
              <span className="text-xs text-zinc-200 font-medium">{importProgress.message}</span>
              {importProgress.step && (
                <span className="text-xs text-zinc-400">{importProgress.step}</span>
              )}
            </div>
            {importProgress.current !== undefined && importProgress.total !== undefined && importProgress.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-12 text-right">
                  {Math.round((importProgress.current / importProgress.total) * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        {!importProgress && (
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {dataSource === 'neo4j' ? (
              <>
                <span className="text-emerald-500">{stats.source}</span>
                <span>{(stats as { nodes: number }).nodes} Nodes</span>
                <span>{(stats as { relationships: number }).relationships} Relationships</span>
              </>
            ) : (
              <>
                <span className="text-blue-500">{stats.source}</span>
                <span>{(stats as { outcomes: number }).outcomes} Outcomes</span>
                <span>{(stats as { kpis: number }).kpis} KPIs</span>
                <span>{(stats as { cdes: number }).cdes} CDEs</span>
                <span>{(stats as { rules: number }).rules} Rules</span>
                <span>{(stats as { links: number }).links} Links</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Semantic Query/Filter Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/30">
        <input
          type="text"
          className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm flex-1 max-w-md"
          placeholder="Semantic query: e.g. 'rules impacting high-value datasets'"
          onChange={(e) => setSemanticQuery(e.target.value)}
          value={semanticQuery}
          aria-label="Semantic Query Filter"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSemanticQuery}
        >
          Filter
        </Button>
        <span className="text-xs text-zinc-500 ml-2">Press Enter or click Filter to search</span>
      </div>
      </>
      )}

      {/* Graph Area with Fixed Left Legend */}
      <div className="flex-1 flex overflow-hidden">
        {/* Fixed Left Legend Panel - floating in fullscreen, docked otherwise */}
        {showLegend && (
          <div className={`${isFullscreen ? 'absolute top-16 left-4 z-10 rounded-lg border border-zinc-700 shadow-xl max-h-[calc(100vh-8rem)] overflow-y-auto' : 'w-48 flex-shrink-0 border-r border-zinc-800'} bg-zinc-900 overflow-y-auto`}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-300">Traceability Chain</span>
                <button
                  onClick={() => setShowLegend(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                  title="Hide legend"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.goal }} />
                    <span className="text-xs text-zinc-300">Goal</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.goal || nodeCountsByType.outcome || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.kpi }} />
                    <span className="text-xs text-zinc-300">KPI</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.kpi || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.decision }} />
                    <span className="text-xs text-zinc-300">Decision</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.decision || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.signal }} />
                    <span className="text-xs text-zinc-300">Signal</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.signal || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.rule }} />
                    <span className="text-xs text-zinc-300">Rule</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.rule || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.dataproduct }} />
                    <span className="text-xs text-zinc-300">DataProduct</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.dataproduct || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.dataset }} />
                    <span className="text-xs text-zinc-300">Dataset</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.dataset || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.field }} />
                    <span className="text-xs text-zinc-300">Field</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.field || 0}</span>
                </div>
              </div>

              <div className="text-xs font-medium text-zinc-400 mb-2 pt-2 border-t border-zinc-700">SKP / Other</div>
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.term }} />
                    <span className="text-xs text-zinc-300">Term</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.term || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.policy }} />
                    <span className="text-xs text-zinc-300">Policy</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.policy || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.system }} />
                    <span className="text-xs text-zinc-300">System</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.system || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.cde }} />
                    <span className="text-xs text-zinc-300">CDE (legacy)</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.cde || 0}</span>
                </div>
              </div>

              <div className="text-xs font-medium text-zinc-400 mb-2 pt-2 border-t border-zinc-700">Relationships</div>
              <div className="space-y-1 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: edgeTypeColors['ISMEASUREDBY'] }} />
                  <span className="text-xs text-zinc-300">isMeasuredBy</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: edgeTypeColors['PROTECTS'] }} />
                  <span className="text-xs text-zinc-300">protects</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: edgeTypeColors['DEGRADES'] }} />
                  <span className="text-xs text-zinc-300">degrades</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: edgeTypeColors['ISDERIVEDFROM'] }} />
                  <span className="text-xs text-zinc-300">isDerivedFrom</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: edgeTypeColors['VALIDATES'] }} />
                  <span className="text-xs text-zinc-300">validates</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 rounded" style={{ backgroundColor: edgeTypeColors['USES'] }} />
                  <span className="text-xs text-zinc-300">uses</span>
                </div>
              </div>

              <div className="text-xs font-medium text-zinc-400 mb-2 pt-2 border-t border-zinc-700">Health (Ring)</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#10b981' }} />
                  <span className="text-xs text-zinc-300">Healthy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#f59e0b' }} />
                  <span className="text-xs text-zinc-300">Warning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#ef4444' }} />
                  <span className="text-xs text-zinc-300">Critical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: '#52525b' }} />
                  <span className="text-xs text-zinc-300">Unknown</span>
                </div>
              </div>

              <div className="text-xs font-medium text-zinc-400 mb-2 pt-2 border-t border-zinc-700">Expanded Properties</div>
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.property }} />
                    <span className="text-xs text-zinc-300">Property</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.property || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.arrayitem }} />
                    <span className="text-xs text-zinc-300">Array Item</span>
                  </div>
                  <span className="text-xs text-zinc-500">{nodeCountsByType.arrayitem || 0}</span>
                </div>
              </div>

              <div className="text-xs font-medium text-zinc-400 mb-2 pt-2 border-t border-zinc-700">Node Actions</div>
              <div className="text-xs text-zinc-500 space-y-1">
                <p>Click a node for options:</p>
                <div className="flex items-center gap-2">
                  <span>🔒</span>
                  <span className="text-zinc-400">Lock position</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>👁</span>
                  <span className="text-zinc-400">Show properties</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⇄</span>
                  <span className="text-zinc-400">Collapse edges</span>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-2">Tip: Click 👁 on array properties to expand items</p>
            </div>
          </div>
        )}

        {/* Graph Canvas */}
        <div className="flex-1 relative">
          {!showLegend && !isFullscreen && (
            <button
              onClick={() => setShowLegend(true)}
              className="absolute top-2 left-2 z-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded border border-zinc-700"
              title="Show legend"
            >
              Legend
            </button>
          )}

          {/* Fullscreen Controls - minimal floating bar */}
          {isFullscreen && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-3 py-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleZoom(1.3)} title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleZoom(0.7)} title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom} title="Reset zoom">
                <RotateCcw className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-zinc-700 mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowLegend(!showLegend)} title="Toggle legend">
                <Target className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-zinc-700 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700"
                onClick={() => setIsFullscreen(false)}
                title="Exit fullscreen (Esc)"
              >
                <Minimize2 className="w-4 h-4 mr-1.5" />
                Exit
              </Button>
            </div>
          )}

          {/* Fullscreen Toggle Button - only shown when not fullscreen */}
          {!isFullscreen && (
            <button
              onClick={() => setIsFullscreen(true)}
              className="absolute top-2 right-2 z-10 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2 rounded border border-zinc-700"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          <svg ref={svgRef} className="w-full h-full bg-zinc-950" />

          {/* Hover Panel */}
        {hoveredNode && (
          <div className="absolute top-4 right-4 bg-zinc-900/95 border border-zinc-800 rounded-lg p-4 max-w-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors[hoveredNode.type] }} />
                <Badge variant="outline" className="text-xs">{hoveredNode.type.toUpperCase()}</Badge>
              </div>
              {hoveredNode.dqScore !== null && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    hoveredNode.dqScore >= 80
                      ? 'border-emerald-500/50 text-emerald-400'
                      : hoveredNode.dqScore >= 60
                      ? 'border-amber-500/50 text-amber-400'
                      : 'border-red-500/50 text-red-400'
                  }`}
                >
                  DQ: {Math.round(hoveredNode.dqScore)}%
                </Badge>
              )}
            </div>
            <div className="font-medium text-zinc-200 mb-1">{hoveredNode.label}</div>
            {hoveredNode.type === 'outcome' && (
              <div className="text-xs text-zinc-400">
                {(hoveredNode.entity as BusinessOutcome).description}
              </div>
            )}
            {hoveredNode.type === 'kpi' && (
              <div className="text-xs text-zinc-400">
                <div>{(hoveredNode.entity as KPI).description}</div>
                {(hoveredNode.entity as KPI).formula && (
                  <div className="mt-1 text-zinc-500">Formula: {(hoveredNode.entity as KPI).formula}</div>
                )}
              </div>
            )}
            {hoveredNode.type === 'cde' && (
              <div className="text-xs text-zinc-400">
                {(hoveredNode.entity as CriticalDataElement).businessDefinition}
              </div>
            )}
            {hoveredNode.type === 'rule' && (
              <div className="text-xs text-zinc-400">
                <div>{(hoveredNode.entity as DataQualityRule).description}</div>
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs mr-1">{(hoveredNode.entity as DataQualityRule).ruleType}</Badge>
                  <Badge variant="outline" className="text-xs">{(hoveredNode.entity as DataQualityRule).severity}</Badge>
                </div>
                {(hoveredNode.entity as DataQualityRule).lastRunResult && (
                  <div className="mt-2 pt-2 border-t border-zinc-700">
                    <div className="text-zinc-500">Last Run:</div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-emerald-400">{(hoveredNode.entity as DataQualityRule).lastRunResult!.passedRecords.toLocaleString()} passed</span>
                      <span className="text-red-400">{(hoveredNode.entity as DataQualityRule).lastRunResult!.failedRecords.toLocaleString()} failed</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- Visual Inspiration & Impact Modal --- */}
        {showInspirationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-lg w-full relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => setShowInspirationModal(false)}
                aria-label="Close Inspiration Modal"
              >
                ×
              </Button>
              <h2 className="text-lg font-bold text-emerald-400 mb-2">Semantic Graph Inspiration</h2>
              <div className="text-sm text-zinc-300 mb-4">
                <ul className="list-disc pl-4">
                  <li>Transform SKP from a flat catalog to a semantic network</li>
                  <li>Query: "Which rules impact high-value datasets?"</li>
                  <li>Traceability from data issue to ROI</li>
                  <li>Governance silo reduction: <span className="text-amber-400">30%</span> (industry benchmark)</li>
                </ul>
              </div>
              <div className="mb-4">
                <div className="font-semibold text-zinc-400 mb-1">Visual Examples:</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-800 rounded p-2 text-xs text-zinc-300">[Entity-Relationship Diagram]</div>
                  <div className="bg-zinc-800 rounded p-2 text-xs text-zinc-300">[Semantic Network Viz]</div>
                  <div className="bg-zinc-800 rounded p-2 text-xs text-zinc-300">[Business Outcome Traceability]</div>
                  <div className="bg-zinc-800 rounded p-2 text-xs text-zinc-300">[Neo4j Browser Screenshot]</div>
                </div>
              </div>
              <div className="text-xs text-zinc-500">Build on this graph to add kinetics like remediation actions!</div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="absolute bottom-4 right-4 z-10"
          onClick={() => setShowInspirationModal(true)}
        >
          Inspiration & Impact
        </Button>

        {/* --- Extensibility for Engineers: AI Suggestion Panel Placeholder --- */}
        {showAISuggestionPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => setShowAISuggestionPanel(false)}
                aria-label="Close AI Suggestion Panel"
              >
                ×
              </Button>
              <h2 className="text-lg font-bold text-indigo-400 mb-2">AI Relationship Suggestions</h2>
              <div className="text-sm text-zinc-300 mb-4">
                <ul className="list-disc pl-4">
                  <li>Suggest new relationships between assets</li>
                  <li>Infer missing links for semantic maturity</li>
                  <li>Highlight potential governance gaps</li>
                </ul>
              </div>
              <div className="text-xs text-zinc-500">(Future roadmap: Integrate with AI service for live suggestions)</div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="absolute bottom-20 right-4 z-10"
          onClick={() => setShowAISuggestionPanel(true)}
        >
          AI Suggestion
        </Button>
        </div>
      </div>
    </div>
  );
}
