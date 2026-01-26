import { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, ArrowRight, Database, HardDrive, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Extended node types matching the business outcome traceability chain
type NodeType =
  | 'goal' | 'outcome'
  | 'kpi'
  | 'decision'
  | 'signal'
  | 'rule'
  | 'dataproduct'
  | 'dataset'
  | 'field'
  | 'cde'
  | 'policy' | 'term' | 'system';

// Layer assignment for the extended model
type LayerIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface LayeredNode {
  id: string;
  label: string;
  type: NodeType;
  layer: LayerIndex;
  entity: Record<string, unknown>;
  dqScore: number | null;
  signalState?: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  x?: number;
  y?: number;
  columnIndex?: number;
}

interface LayeredLink {
  source: string;
  target: string;
  type: string;
}

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

const nodeTypeColors: Record<NodeType, string> = {
  goal: '#10b981',        // emerald-500
  outcome: '#10b981',     // emerald-500
  kpi: '#3b82f6',         // blue-500
  decision: '#f97316',    // orange-500
  signal: '#eab308',      // yellow-500
  rule: '#8b5cf6',        // violet-500
  dataproduct: '#06b6d4', // cyan-500
  dataset: '#6366f1',     // indigo-500
  field: '#a855f7',       // purple-500
  cde: '#f59e0b',         // amber-500
  policy: '#84cc16',      // lime-500
  term: '#ec4899',        // pink-500
  system: '#14b8a6',      // teal-500
};

// Map node types to layers
const nodeTypeToLayer: Record<NodeType, LayerIndex> = {
  goal: 0,
  outcome: 0,
  kpi: 1,
  decision: 2,
  signal: 3,
  rule: 4,
  dataproduct: 5,
  dataset: 6,
  field: 6,
  cde: 4,       // Legacy - same as rule
  policy: 0,    // SKP types
  term: 1,
  system: 6,
};

const layerLabels: Record<LayerIndex, string> = {
  0: 'Goals',
  1: 'KPIs',
  2: 'Decisions',
  3: 'Signals',
  4: 'Rules',
  5: 'Data Products',
  6: 'Datasets',
};

const layerColors: Record<LayerIndex, string> = {
  0: 'rgba(16, 185, 129, 0.08)',  // emerald
  1: 'rgba(59, 130, 246, 0.08)',  // blue
  2: 'rgba(249, 115, 22, 0.08)',  // orange
  3: 'rgba(234, 179, 8, 0.08)',   // yellow
  4: 'rgba(139, 92, 246, 0.08)',  // violet
  5: 'rgba(6, 182, 212, 0.08)',   // cyan
  6: 'rgba(99, 102, 241, 0.08)',  // indigo
};

// DQ health score colors
const getDqHealthColor = (score: number | null): string => {
  if (score === null) return '#52525b';
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

// Signal state colors
const getSignalStateColor = (state?: string): string => {
  switch (state) {
    case 'HEALTHY': return '#10b981';
    case 'WARNING': return '#f59e0b';
    case 'CRITICAL': return '#ef4444';
    default: return '#52525b';
  }
};

export function OutcomeLineage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LayeredNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dataSource, setDataSource] = useState<'local' | 'neo4j'>('neo4j');
  const [neo4jData, setNeo4jData] = useState<Neo4jGraphResponse | null>(null);
  const [loadingNeo4j, setLoadingNeo4j] = useState(false);
  const [importSource, setImportSource] = useState('ptp-sample');
  const [importLabel, setImportLabel] = useState('PTP_Demo');
  const [importDb, setImportDb] = useState('neo4j');
  const { toast } = useToast();

  // Local store data (legacy)
  const outcomes = useAppStore((s) => s.businessOutcomes);
  const kpis = useAppStore((s) => s.kpis);
  const cdes = useAppStore((s) => s.cdes);
  const dqRules = useAppStore((s) => s.dqRules);

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 600,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch Neo4j graph data
  const fetchNeo4jGraph = async () => {
    setLoadingNeo4j(true);
    try {
      const sourceParam = importSource ? `&source=${encodeURIComponent(importSource)}` : '';
      const labelParam = importLabel ? `&label=${encodeURIComponent(importLabel)}` : '';
      const res = await fetch(`/api/graph?limit=500&db=${encodeURIComponent(importDb)}${sourceParam}${labelParam}`);
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

  // Auto-fetch on mount if Neo4j selected
  useEffect(() => {
    if (dataSource === 'neo4j' && !neo4jData) {
      fetchNeo4jGraph();
    }
  }, [dataSource]);

  // Build graph data from Neo4j response
  const neo4jGraphData = useMemo(() => {
    if (!neo4jData) return { nodes: [], links: [] };

    const validNodeTypes: NodeType[] = [
      'goal', 'outcome', 'kpi', 'decision', 'signal', 'rule',
      'dataproduct', 'dataset', 'field', 'cde', 'policy', 'term', 'system'
    ];

    const nodes: LayeredNode[] = neo4jData.nodes.map((n) => {
      const label = n.labels[0]?.toLowerCase() || 'dataset';
      const nodeType: NodeType = validNodeTypes.includes(label as NodeType)
        ? (label as NodeType)
        : 'dataset';

      const signalState = nodeType === 'signal'
        ? (n.properties.state as 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN')
        : undefined;

      const dqScore = nodeType === 'rule' && n.properties.passRate != null
        ? (n.properties.passRate as number)
        : null;

      return {
        id: n.id,
        label: (n.properties.name as string) || (n.properties.id as string) || n.id,
        type: nodeType,
        layer: nodeTypeToLayer[nodeType],
        entity: n.properties,
        dqScore,
        signalState,
      };
    });

    const links: LayeredLink[] = neo4jData.relationships.map((r) => ({
      source: r.startNodeId,
      target: r.endNodeId,
      type: r.type || 'RELATION',
    }));

    return { nodes, links };
  }, [neo4jData]);

  // Build graph data from local store (legacy 4-layer model)
  const localGraphData = useMemo(() => {
    const nodes: LayeredNode[] = [];
    const links: LayeredLink[] = [];

    // Layer 0: Outcomes
    for (const outcome of outcomes) {
      nodes.push({
        id: `outcome-${outcome.id}`,
        label: outcome.name,
        type: 'outcome',
        layer: 0,
        entity: outcome as unknown as Record<string, unknown>,
        dqScore: null,
      });
    }

    // Layer 1: KPIs
    for (const kpi of kpis) {
      nodes.push({
        id: `kpi-${kpi.id}`,
        label: kpi.name,
        type: 'kpi',
        layer: 1,
        entity: kpi as unknown as Record<string, unknown>,
        dqScore: null,
      });

      for (const outcomeId of kpi.outcomeIds) {
        links.push({
          source: `outcome-${outcomeId}`,
          target: `kpi-${kpi.id}`,
          type: 'ISMEASUREDBY',
        });
      }
    }

    // Layer 4: CDEs (mapped to rules layer)
    for (const cde of cdes) {
      nodes.push({
        id: `cde-${cde.id}`,
        label: cde.name,
        type: 'cde',
        layer: 4,
        entity: cde as unknown as Record<string, unknown>,
        dqScore: null,
      });

      for (const kpiId of cde.kpiIds) {
        links.push({
          source: `kpi-${kpiId}`,
          target: `cde-${cde.id}`,
          type: 'USES',
        });
      }
    }

    // Layer 4: Rules
    for (const rule of dqRules) {
      const ruleScore = rule.lastRunResult?.passRate ?? null;
      nodes.push({
        id: `rule-${rule.id}`,
        label: rule.name,
        type: 'rule',
        layer: 4,
        entity: rule as unknown as Record<string, unknown>,
        dqScore: ruleScore,
      });

      if (rule.cdeId) {
        links.push({
          source: `cde-${rule.cdeId}`,
          target: `rule-${rule.id}`,
          type: 'VALIDATES',
        });
      }
    }

    return { nodes, links };
  }, [outcomes, kpis, cdes, dqRules]);

  // Select data source
  const graphData = dataSource === 'neo4j' ? neo4jGraphData : localGraphData;

  // Calculate node positions using layered layout
  const layoutData = useMemo(() => {
    const { nodes, links } = graphData;
    if (nodes.length === 0) return { nodes: [], links: [], margin: undefined, innerWidth: undefined, innerHeight: undefined };

    const { width, height } = dimensions;
    const margin = { top: 60, right: 40, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Group nodes by layer
    const layers: LayeredNode[][] = [[], [], [], [], [], [], []];
    for (const node of nodes) {
      if (node.layer >= 0 && node.layer <= 6) {
        layers[node.layer].push(node);
      }
    }

    // Find which layers have nodes
    const activeLayers = layers.map((l, i) => ({ index: i, nodes: l })).filter(l => l.nodes.length > 0);
    const numActiveLayers = activeLayers.length;

    if (numActiveLayers === 0) return { nodes: [], links: [], margin, innerWidth, innerHeight };

    // Calculate layer X positions
    const layerWidth = innerWidth / numActiveLayers;
    const layerXPositions: number[] = [];
    activeLayers.forEach((_, i) => {
      layerXPositions.push(margin.left + layerWidth * i + layerWidth / 2);
    });

    // Create mapping from layer index to X position
    const layerIndexToX = new Map<number, number>();
    activeLayers.forEach((layer, i) => {
      layerIndexToX.set(layer.index, layerXPositions[i]);
    });

    // Position nodes within each layer
    const positionedNodes: LayeredNode[] = [];

    for (const { index: layerIndex, nodes: layerNodes } of activeLayers) {
      const nodeCount = layerNodes.length;
      const nodeHeight = 36;
      const verticalGap = Math.min(20, (innerHeight - nodeCount * nodeHeight) / (nodeCount + 1));
      const totalHeight = nodeCount * nodeHeight + (nodeCount - 1) * verticalGap;
      const startY = margin.top + (innerHeight - totalHeight) / 2;

      layerNodes.forEach((node, index) => {
        const positionedNode = {
          ...node,
          x: layerIndexToX.get(layerIndex)!,
          y: startY + index * (nodeHeight + verticalGap) + nodeHeight / 2,
          columnIndex: index,
        };
        positionedNodes.push(positionedNode);
      });
    }

    // Create positioned node map for link rendering
    const positionedNodeMap = new Map<string, LayeredNode>();
    for (const node of positionedNodes) {
      positionedNodeMap.set(node.id, node);
    }

    // Create positioned links
    const positionedLinks = links.map(link => ({
      ...link,
      sourceNode: positionedNodeMap.get(link.source),
      targetNode: positionedNodeMap.get(link.target),
    })).filter(link => link.sourceNode && link.targetNode);

    return {
      nodes: positionedNodes,
      links: positionedLinks,
      activeLayers,
      layerIndexToX,
      margin,
      innerWidth,
      innerHeight,
    };
  }, [graphData, dimensions]);

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

  // Render the visualization
  useEffect(() => {
    if (!svgRef.current || layoutData.nodes.length === 0) return;
    if (!layoutData.margin || !layoutData.innerWidth) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const { nodes, links, activeLayers, layerIndexToX, margin, innerWidth } = layoutData;

    if (!activeLayers || !layerIndexToX) return;

    const g = svg.append('g');

    // Setup zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Draw layer backgrounds
    const numActiveLayers = activeLayers.length;
    const layerWidth = innerWidth / numActiveLayers;
    const layerG = g.append('g').attr('class', 'layers');

    activeLayers.forEach((layer, i) => {
      const x = margin.left + i * layerWidth;

      // Layer background
      layerG.append('rect')
        .attr('x', x)
        .attr('y', margin.top - 40)
        .attr('width', layerWidth)
        .attr('height', height - margin.top)
        .attr('fill', layerColors[layer.index as LayerIndex])
        .attr('stroke', 'none');

      // Layer label
      layerG.append('text')
        .attr('x', x + layerWidth / 2)
        .attr('y', margin.top - 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#71717a')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .text(layerLabels[layer.index as LayerIndex]);

      // Flow arrow between layers (except after last)
      if (i < numActiveLayers - 1) {
        const arrowX = x + layerWidth - 4;
        layerG.append('path')
          .attr('d', `M${arrowX},${margin.top + 80} L${arrowX + 8},${margin.top + 85} L${arrowX},${margin.top + 90}`)
          .attr('fill', 'none')
          .attr('stroke', '#3f3f46')
          .attr('stroke-width', 1.5);
      }
    });

    // Draw links as curved paths
    const linkG = g.append('g').attr('class', 'links');

    const linkPath = (link: typeof links[0]) => {
      const source = link.sourceNode!;
      const target = link.targetNode!;
      const sx = source.x! + 60;
      const sy = source.y!;
      const tx = target.x! - 60;
      const ty = target.y!;
      const midX = (sx + tx) / 2;
      return `M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}`;
    };

    linkG.selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', linkPath)
      .attr('fill', 'none')
      .attr('stroke', (d) => {
        const sourceNode = d.sourceNode!;
        return nodeTypeColors[sourceNode.type];
      })
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2);

    // Draw nodes as rounded rectangles
    const nodeG = g.append('g').attr('class', 'nodes');
    const nodeWidth = 120;
    const nodeHeight = 32;

    const nodeGroups = nodeG.selectAll('g.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x! - nodeWidth / 2}, ${d.y! - nodeHeight / 2})`)
      .style('cursor', 'pointer')
      .on('mouseenter', function (_, d) {
        d3.select(this).select('rect')
          .attr('stroke-width', 2)
          .attr('stroke', '#fff');
        setHoveredNode(d);
      })
      .on('mouseleave', function () {
        d3.select(this).select('rect')
          .attr('stroke-width', 1)
          .attr('stroke', '#3f3f46');
        setHoveredNode(null);
      });

    // Node background
    nodeGroups.append('rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', '#18181b')
      .attr('stroke', '#3f3f46')
      .attr('stroke-width', 1);

    // Color indicator on left side
    nodeGroups.append('rect')
      .attr('width', 4)
      .attr('height', nodeHeight)
      .attr('rx', 2)
      .attr('ry', 0)
      .attr('fill', (d) => nodeTypeColors[d.type]);

    // Node label
    nodeGroups.append('text')
      .attr('x', 12)
      .attr('y', nodeHeight / 2)
      .attr('dy', '0.35em')
      .attr('fill', '#e4e4e7')
      .attr('font-size', '11px')
      .text((d) => {
        const maxLen = 12;
        return d.label.length > maxLen ? d.label.slice(0, maxLen - 1) + '...' : d.label;
      });

    // Health indicator (signal state or DQ score)
    nodeGroups.append('circle')
      .attr('cx', nodeWidth - 14)
      .attr('cy', nodeHeight / 2)
      .attr('r', 6)
      .attr('fill', (d) => {
        if (d.type === 'signal' && d.signalState) {
          return getSignalStateColor(d.signalState);
        }
        return getDqHealthColor(d.dqScore);
      })
      .attr('stroke', '#18181b')
      .attr('stroke-width', 1.5)
      .attr('opacity', (d) => {
        if (d.type === 'signal' && d.signalState) return 1;
        return d.dqScore !== null ? 1 : 0.5;
      });

    // DQ score text
    nodeGroups.append('text')
      .attr('x', nodeWidth - 14)
      .attr('y', nodeHeight / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#18181b')
      .attr('font-size', '7px')
      .attr('font-weight', 'bold')
      .text((d) => d.dqScore !== null ? Math.round(d.dqScore) : '');

    // Initial zoom to fit
    const bounds = g.node()?.getBBox();
    if (bounds) {
      const scale = Math.min(
        width / (bounds.width + 80),
        height / (bounds.height + 80),
        1
      );
      const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
  }, [layoutData, dimensions]);

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

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4">
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
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNeo4jGraph}
                disabled={loadingNeo4j}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingNeo4j ? 'animate-spin' : ''}`} />
                {loadingNeo4j ? 'Loading...' : 'Refresh'}
              </Button>
              <input
                type="text"
                className="px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs w-24"
                value={importSource}
                onChange={e => setImportSource(e.target.value)}
                placeholder="Source"
                title="Filter by source tag"
              />
              <input
                type="text"
                className="px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs w-24"
                value={importLabel}
                onChange={e => setImportLabel(e.target.value)}
                placeholder="Label"
                title="Filter by label"
              />
            </>
          )}

          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <span className="text-emerald-400">Goals</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-blue-400">KPIs</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-orange-400">Decisions</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-yellow-400">Signals</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-violet-400">Rules</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-cyan-400">Products</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-indigo-400">Datasets</span>
          </div>
        </div>

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
            </>
          )}
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-zinc-950" />

        {/* Hover Panel */}
        {hoveredNode && (
          <div className="absolute top-4 right-4 bg-zinc-900/95 border border-zinc-800 rounded-lg p-4 max-w-xs z-10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors[hoveredNode.type] }} />
                <Badge variant="outline" className="text-xs">{hoveredNode.type.toUpperCase()}</Badge>
              </div>
              {hoveredNode.type === 'signal' && hoveredNode.signalState && (
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    hoveredNode.signalState === 'HEALTHY'
                      ? 'border-emerald-500/50 text-emerald-400'
                      : hoveredNode.signalState === 'WARNING'
                      ? 'border-amber-500/50 text-amber-400'
                      : 'border-red-500/50 text-red-400'
                  }`}
                >
                  {hoveredNode.signalState}
                </Badge>
              )}
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
            {hoveredNode.entity.description && (
              <div className="text-xs text-zinc-400">
                {String(hoveredNode.entity.description)}
              </div>
            )}
            {hoveredNode.entity.formula && (
              <div className="text-xs text-zinc-500 mt-1">
                Formula: {String(hoveredNode.entity.formula)}
              </div>
            )}
            {hoveredNode.entity.system && (
              <div className="text-xs text-zinc-500 mt-1">
                System: {String(hoveredNode.entity.system)}
              </div>
            )}
            {hoveredNode.entity.ownerRole && (
              <div className="text-xs text-zinc-500 mt-1">
                Owner: {String(hoveredNode.entity.ownerRole)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
