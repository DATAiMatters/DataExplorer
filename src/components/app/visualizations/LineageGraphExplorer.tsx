import { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { LineageGraph } from '@/lib/lineageGraph';
import { useAppStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, GitBranch } from 'lucide-react';
import type { LineageNode } from '@/types';

interface SimulationNode extends LineageNode, d3.SimulationNodeDatum {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  type: string;
  label?: string;
}

export function LineageGraphExplorer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LineageNode | null>(null);
  const [linkStrength, setLinkStrength] = useState(0.3);
  const [chargeStrength, setChargeStrength] = useState(-500);

  const bundles = useAppStore((s) => s.bundles);
  const joins = useAppStore((s) => s.joins);
  const virtualBundles = useAppStore((s) => s.virtualBundles);
  const schemas = useAppStore((s) => s.schemas);

  const lineageData = useMemo(() => {
    const lineage = LineageGraph.build(bundles, joins, virtualBundles, schemas);
    return lineage.exportForVisualization();
  }, [bundles, joins, virtualBundles, schemas]);

  const stats = useMemo(() => {
    const nodeDegrees = new Map<string, number>();
    for (const edge of lineageData.edges) {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    }
    return {
      nodeCount: lineageData.nodes.length,
      edgeCount: lineageData.edges.length,
      bundles: lineageData.nodes.filter((n) => n.type === 'bundle').length,
      virtualBundles: lineageData.nodes.filter((n) => n.type === 'virtual_bundle').length,
      schemas: lineageData.nodes.filter((n) => n.type === 'schema').length,
    };
  }, [lineageData]);

  // Color scale for node types
  const nodeTypeColors = useMemo(() => ({
    bundle: '#10b981',       // emerald-500
    virtual_bundle: '#8b5cf6', // violet-500
    schema: '#f59e0b',       // amber-500
  }), []);

  // Color scale for edge types
  const edgeTypeColors = useMemo(() => ({
    join: '#3b82f6',          // blue-500
    derived_from: '#ec4899',  // pink-500
    uses_schema: '#6b7280',   // gray-500
  }), []);

  useEffect(() => {
    if (!svgRef.current || lineageData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 1000;
    const height = svgRef.current.clientHeight || 600;

    const nodes: SimulationNode[] = lineageData.nodes.map((d) => ({ ...d }));
    const links: SimulationLink[] = lineageData.edges.map((d) => ({
      source: d.source,
      target: d.target,
      type: d.type,
      label: d.label,
    }));

    // Size nodes based on their degree
    const nodeDegrees = new Map<string, number>();
    for (const edge of lineageData.edges) {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    }

    const sizeScale = d3
      .scaleSqrt()
      .domain([0, Math.max(...Array.from(nodeDegrees.values()), 1)])
      .range([8, 24]);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<SimulationNode, SimulationLink>(links)
          .id((d) => d.id)
          .strength(linkStrength)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimulationNode>().radius((d) => sizeScale(nodeDegrees.get(d.id) || 0) + 10));

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    // Store zoom behavior for button controls
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Add arrow markers for directed edges
    const defs = svg.append('defs');
    Object.entries(edgeTypeColors).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
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
      .attr('stroke', (d) => edgeTypeColors[d.type as keyof typeof edgeTypeColors] || '#404040')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', (d) => `url(#arrow-${d.type})`);

    // Draw edge labels
    const edgeLabel = g
      .append('g')
      .attr('class', 'edge-labels')
      .selectAll('text')
      .data(links)
      .enter()
      .append('text')
      .text((d) => d.label || '')
      .attr('font-size', 9)
      .attr('fill', '#71717a')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    // Draw nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => sizeScale(nodeDegrees.get(d.id) || 0))
      .attr('fill', (d) => nodeTypeColors[d.type as keyof typeof nodeTypeColors] || '#6366f1')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('stroke', '#fbbf24').attr('stroke-width', 3);
        setHoveredNode(d);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
        setHoveredNode(null);
      })
      .call(
        d3
          .drag<SVGCircleElement, SimulationNode>()
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

    // Draw node labels
    const label = g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('fill', '#e4e4e7')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => sizeScale(nodeDegrees.get(d.id) || 0) + 16)
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimulationNode).x!)
        .attr('y1', (d) => (d.source as SimulationNode).y!)
        .attr('x2', (d) => (d.target as SimulationNode).x!)
        .attr('y2', (d) => (d.target as SimulationNode).y!);

      edgeLabel
        .attr('x', (d) => ((d.source as SimulationNode).x! + (d.target as SimulationNode).x!) / 2)
        .attr('y', (d) => ((d.source as SimulationNode).y! + (d.target as SimulationNode).y!) / 2);

      node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

      label.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [lineageData, linkStrength, chargeStrength, nodeTypeColors, edgeTypeColors]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = zoomBehaviorRef.current;

    if (direction === 'reset') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    } else {
      svg.transition().duration(200).call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
    }
  };

  if (lineageData.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <GitBranch className="w-16 h-16 text-zinc-700" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">No Data Lineage Yet</h3>
          <p className="text-sm text-zinc-500 max-w-md">
            Create data bundles and joins to see the lineage graph. The graph visualizes relationships between bundles, virtual bundles, and schemas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-100">Data Lineage</span>
          </div>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            {stats.bundles} bundles
          </Badge>
          <Badge variant="secondary" className="bg-violet-500/10 text-violet-400 border-violet-500/20">
            {stats.virtualBundles} virtual
          </Badge>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
            {stats.schemas} schemas
          </Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {stats.edgeCount} connections
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Link strength</span>
            <Slider
              value={[linkStrength]}
              onValueChange={([v]) => setLinkStrength(v)}
              min={0.1}
              max={1}
              step={0.1}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Repulsion</span>
            <Slider
              value={[-chargeStrength]}
              onValueChange={([v]) => setChargeStrength(-v)}
              min={100}
              max={1500}
              step={100}
              className="w-24"
            />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('in')}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('out')}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('reset')}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-zinc-950 overflow-hidden">
        <svg ref={svgRef} width="100%" height="100%" />
      </div>

      {hoveredNode && (
        <div className="absolute bottom-4 left-4 w-72 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: nodeTypeColors[hoveredNode.type as keyof typeof nodeTypeColors] }}
            />
            <h3 className="font-semibold text-zinc-100">{hoveredNode.label}</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <div>
              <span className="text-zinc-500">Type: </span>
              <span className="text-zinc-300 capitalize">{hoveredNode.type.replace('_', ' ')}</span>
            </div>
            {hoveredNode.metadata && (
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                {(() => {
                  const description = hoveredNode.metadata?.description;
                  if (typeof description === 'string') {
                    return <div className="text-xs text-zinc-400">{description}</div>;
                  }
                  return null;
                })()}
                {(() => {
                  const rowCount = hoveredNode.metadata?.rowCount;
                  if (typeof rowCount === 'number') {
                    return (
                      <div className="text-xs">
                        <span className="text-zinc-500">Rows: </span>
                        <span className="text-zinc-300">{rowCount}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {(() => {
                  const dataType = hoveredNode.metadata?.dataType;
                  if (typeof dataType === 'string') {
                    return (
                      <div className="text-xs">
                        <span className="text-zinc-500">Data Type: </span>
                        <span className="text-zinc-300">{dataType}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-3 pt-2 border-t border-zinc-800">
            Drag to reposition • Scroll to zoom
          </div>
        </div>
      )}

      <div className="absolute top-16 right-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <div className="text-xs font-semibold text-zinc-400 mb-2">Node Types</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-300">Bundle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-xs text-zinc-300">Virtual Bundle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-zinc-300">Schema</span>
          </div>
        </div>
      </div>

      <div className="absolute top-16 left-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <div className="text-xs font-semibold text-zinc-400 mb-2">Edge Types</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500" />
            <span className="text-xs text-zinc-300">Join</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-pink-500" />
            <span className="text-xs text-zinc-300">Derived From</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-500" />
            <span className="text-xs text-zinc-300">Uses Schema</span>
          </div>
        </div>
      </div>
    </div>
  );
}
