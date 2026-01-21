import { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Target, Network, GitBranch } from 'lucide-react';
import { OutcomeLineage } from './OutcomeLineage';
import type { BusinessOutcome, KPI, CriticalDataElement, DataQualityRule } from '@/types';

type NodeType = 'outcome' | 'kpi' | 'cde' | 'rule';

interface CanvasNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  entity: BusinessOutcome | KPI | CriticalDataElement | DataQualityRule;
  dqScore: number | null; // DQ score 0-100, null if not computed
}

interface CanvasLink extends d3.SimulationLinkDatum<CanvasNode> {
  type: 'outcome-kpi' | 'kpi-cde' | 'cde-rule';
}

const nodeTypeColors: Record<NodeType, string> = {
  outcome: '#10b981', // emerald-500
  kpi: '#3b82f6',     // blue-500
  cde: '#f59e0b',     // amber-500
  rule: '#8b5cf6',    // violet-500
};

// DQ health score colors
const getDqHealthColor = (score: number | null): string => {
  if (score === null) return '#52525b'; // zinc-600 - not run
  if (score >= 80) return '#10b981';    // emerald-500 - healthy
  if (score >= 60) return '#f59e0b';    // amber-500 - warning
  return '#ef4444';                      // red-500 - critical
};

const edgeTypeColors: Record<string, string> = {
  'outcome-kpi': '#10b981',
  'kpi-cde': '#3b82f6',
  'cde-rule': '#f59e0b',
};

export function OutcomeCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);
  const [linkStrength, setLinkStrength] = useState(0.4);
  const [chargeStrength, setChargeStrength] = useState(-400);
  const [viewMode, setViewMode] = useState<'force' | 'lineage'>('force');

  const outcomes = useAppStore((s) => s.businessOutcomes);
  const kpis = useAppStore((s) => s.kpis);
  const cdes = useAppStore((s) => s.cdes);
  const dqRules = useAppStore((s) => s.dqRules);

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

  // Build graph data from business outcomes entities
  const graphData = useMemo(() => {
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

  const stats = useMemo(() => {
    return {
      outcomes: outcomes.length,
      kpis: kpis.length,
      cdes: cdes.length,
      rules: dqRules.length,
      links: graphData.links.length,
    };
  }, [outcomes, kpis, cdes, dqRules, graphData.links]);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 500;

    const nodes: CanvasNode[] = graphData.nodes.map((d) => ({ ...d }));
    const links: CanvasLink[] = graphData.links.map((d) => ({
      source: d.source as string,
      target: d.target as string,
      type: d.type,
    }));

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

    // Draw edges
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d) => edgeTypeColors[d.type] || '#404040')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', (d) => `url(#arrow-${d.type})`);

    // Draw DQ health indicator rings (outer ring showing health status)
    const healthRing = g
      .append('g')
      .attr('class', 'health-rings')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => sizeScale(nodeDegrees.get(d.id) || 0) + 4)
      .attr('fill', 'none')
      .attr('stroke', (d) => getDqHealthColor(d.dqScore))
      .attr('stroke-width', 3)
      .attr('stroke-opacity', (d) => d.dqScore !== null ? 0.8 : 0.3)
      .attr('stroke-dasharray', (d) => d.dqScore === null ? '4,2' : 'none');

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
      .attr('stroke', '#18181b')
      .attr('stroke-width', 2)
      .style('cursor', 'grab')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 3);
        setHoveredNode(d);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', '#18181b').attr('stroke-width', 2);
        setHoveredNode(null);
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
            d.fx = null;
            d.fy = null;
          })
      );

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

    return () => {
      simulation.stop();
    };
  }, [graphData, linkStrength, chargeStrength]);

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
          <div className="flex items-center gap-2">
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
    <div className="h-full flex flex-col">
      {/* Controls */}
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
      <div className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full bg-zinc-950" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs font-medium text-zinc-400 mb-2">Node Types</div>
          <div className="space-y-1 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.outcome }} />
              <span className="text-xs text-zinc-300">Outcome</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.kpi }} />
              <span className="text-xs text-zinc-300">KPI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.cde }} />
              <span className="text-xs text-zinc-300">CDE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeTypeColors.rule }} />
              <span className="text-xs text-zinc-300">DQ Rule</span>
            </div>
          </div>
          <div className="text-xs font-medium text-zinc-400 mb-2 pt-2 border-t border-zinc-700">DQ Health (Ring)</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#10b981' }} />
              <span className="text-xs text-zinc-300">Healthy (≥80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#f59e0b' }} />
              <span className="text-xs text-zinc-300">Warning (60-79%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#ef4444' }} />
              <span className="text-xs text-zinc-300">Critical (&lt;60%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: '#52525b' }} />
              <span className="text-xs text-zinc-300">Not run</span>
            </div>
          </div>
        </div>

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
      </div>
    </div>
  );
}
