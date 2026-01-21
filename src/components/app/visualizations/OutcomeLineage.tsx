import { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Target, ArrowRight } from 'lucide-react';
import type { BusinessOutcome, KPI, CriticalDataElement, DataQualityRule } from '@/types';

type NodeType = 'outcome' | 'kpi' | 'cde' | 'rule';
type LayerIndex = 0 | 1 | 2 | 3;

interface LayeredNode {
  id: string;
  label: string;
  type: NodeType;
  layer: LayerIndex;
  entity: BusinessOutcome | KPI | CriticalDataElement | DataQualityRule;
  x?: number;
  y?: number;
  columnIndex?: number;
}

interface LayeredLink {
  source: string;
  target: string;
  type: 'outcome-kpi' | 'kpi-cde' | 'cde-rule';
}

const nodeTypeColors: Record<NodeType, string> = {
  outcome: '#10b981', // emerald-500
  kpi: '#3b82f6',     // blue-500
  cde: '#f59e0b',     // amber-500
  rule: '#8b5cf6',    // violet-500
};

const layerLabels: Record<LayerIndex, string> = {
  0: 'Outcomes',
  1: 'KPIs',
  2: 'CDEs',
  3: 'DQ Rules',
};

const layerColors: Record<LayerIndex, string> = {
  0: 'rgba(16, 185, 129, 0.08)', // emerald
  1: 'rgba(59, 130, 246, 0.08)', // blue
  2: 'rgba(245, 158, 11, 0.08)', // amber
  3: 'rgba(139, 92, 246, 0.08)', // violet
};

export function OutcomeLineage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LayeredNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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

  // Build layered graph data
  const graphData = useMemo(() => {
    const nodes: LayeredNode[] = [];
    const links: LayeredLink[] = [];
    const nodeMap = new Map<string, LayeredNode>();

    // Layer 0: Outcomes
    for (const outcome of outcomes) {
      const node: LayeredNode = {
        id: `outcome-${outcome.id}`,
        label: outcome.name,
        type: 'outcome',
        layer: 0,
        entity: outcome,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    }

    // Layer 1: KPIs
    for (const kpi of kpis) {
      const node: LayeredNode = {
        id: `kpi-${kpi.id}`,
        label: kpi.name,
        type: 'kpi',
        layer: 1,
        entity: kpi,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Links to outcomes
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

    // Layer 2: CDEs
    for (const cde of cdes) {
      const node: LayeredNode = {
        id: `cde-${cde.id}`,
        label: cde.name,
        type: 'cde',
        layer: 2,
        entity: cde,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Links to KPIs
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

    // Layer 3: Rules
    for (const rule of dqRules) {
      const node: LayeredNode = {
        id: `rule-${rule.id}`,
        label: rule.name,
        type: 'rule',
        layer: 3,
        entity: rule,
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

    return { nodes, links, nodeMap };
  }, [outcomes, kpis, cdes, dqRules]);

  // Calculate node positions using layered layout
  const layoutData = useMemo(() => {
    const { nodes, links } = graphData;
    if (nodes.length === 0) return { nodes: [], links: [], margin: undefined, innerWidth: undefined, innerHeight: undefined };

    const { width, height } = dimensions;
    const margin = { top: 60, right: 40, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Group nodes by layer
    const layers: LayeredNode[][] = [[], [], [], []];
    for (const node of nodes) {
      layers[node.layer].push(node);
    }

    // Calculate layer X positions (4 layers spread across width)
    const layerWidth = innerWidth / 4;
    const layerXPositions = [0, 1, 2, 3].map(i => margin.left + layerWidth * i + layerWidth / 2);

    // Position nodes within each layer
    const positionedNodes: LayeredNode[] = [];

    for (let layerIndex = 0; layerIndex < 4; layerIndex++) {
      const layerNodes = layers[layerIndex];
      const nodeCount = layerNodes.length;

      if (nodeCount === 0) continue;

      // Calculate vertical spacing
      const nodeHeight = 36;
      const verticalGap = Math.min(20, (innerHeight - nodeCount * nodeHeight) / (nodeCount + 1));
      const totalHeight = nodeCount * nodeHeight + (nodeCount - 1) * verticalGap;
      const startY = margin.top + (innerHeight - totalHeight) / 2;

      layerNodes.forEach((node, index) => {
        const positionedNode = {
          ...node,
          x: layerXPositions[layerIndex],
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
      layerXPositions,
      margin,
      innerWidth,
      innerHeight,
    };
  }, [graphData, dimensions]);

  const stats = useMemo(() => {
    return {
      outcomes: outcomes.length,
      kpis: kpis.length,
      cdes: cdes.length,
      rules: dqRules.length,
      links: graphData.links.length,
    };
  }, [outcomes, kpis, cdes, dqRules, graphData.links]);

  // Render the visualization
  useEffect(() => {
    if (!svgRef.current || layoutData.nodes.length === 0) return;
    if (!layoutData.margin || !layoutData.innerWidth) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const { nodes, links, margin, innerWidth } = layoutData;

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
    const layerWidth = innerWidth / 4;
    const layerG = g.append('g').attr('class', 'layers');

    [0, 1, 2, 3].forEach((layerIndex) => {
      const x = margin.left + layerIndex * layerWidth;

      // Layer background
      layerG.append('rect')
        .attr('x', x)
        .attr('y', margin.top - 40)
        .attr('width', layerWidth)
        .attr('height', height - margin.top)
        .attr('fill', layerColors[layerIndex as LayerIndex])
        .attr('stroke', 'none');

      // Layer label
      layerG.append('text')
        .attr('x', x + layerWidth / 2)
        .attr('y', margin.top - 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#71717a')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .text(layerLabels[layerIndex as LayerIndex]);

      // Flow arrow between layers (except after last)
      if (layerIndex < 3) {
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
      const sx = source.x! + 60; // Right edge of source node
      const sy = source.y!;
      const tx = target.x! - 60; // Left edge of target node
      const ty = target.y!;

      // Bezier curve control points
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
        const maxLen = 14;
        return d.label.length > maxLen ? d.label.slice(0, maxLen - 1) + '...' : d.label;
      });

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

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Target className="w-8 h-8 text-zinc-600" />
        </div>
        <h3 className="text-lg font-medium text-zinc-300">No traceability data</h3>
        <p className="text-zinc-500 text-sm mt-1 max-w-sm">
          Create outcomes, KPIs, CDEs, and rules, then link them together to see the lineage flow.
        </p>
      </div>
    );
  }

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

          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <span className="text-emerald-400">Outcomes</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-blue-400">KPIs</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-amber-400">CDEs</span>
            <ArrowRight className="w-3 h-3" />
            <span className="text-violet-400">Rules</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{stats.outcomes} Outcomes</span>
          <span>{stats.kpis} KPIs</span>
          <span>{stats.cdes} CDEs</span>
          <span>{stats.rules} Rules</span>
          <span>{stats.links} Links</span>
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="bg-zinc-950" />

        {/* Hover Panel */}
        {hoveredNode && (
          <div className="absolute top-4 right-4 bg-zinc-900/95 border border-zinc-800 rounded-lg p-4 max-w-xs z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors[hoveredNode.type] }} />
              <Badge variant="outline" className="text-xs">{hoveredNode.type.toUpperCase()}</Badge>
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
