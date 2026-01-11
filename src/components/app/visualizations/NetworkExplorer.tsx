import { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { transformToNetwork } from '@/lib/dataUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import type { DataBundle, SemanticSchema, NetworkData, NetworkNode } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

interface SimulationNode extends NetworkNode, d3.SimulationNodeDatum {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  weight?: number;
  label?: string;
}

export function NetworkExplorer({ bundle }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [linkStrength, setLinkStrength] = useState(0.5);
  const [chargeStrength, setChargeStrength] = useState(-300);

  const networkData = useMemo<NetworkData>(() => {
    try {
      return transformToNetwork(bundle.source, bundle.mappings);
    } catch (e) {
      console.error('Failed to transform network:', e);
      return { nodes: [], edges: [] };
    }
  }, [bundle]);

  const stats = useMemo(() => {
    const nodeDegrees = new Map<string, number>();
    for (const edge of networkData.edges) {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    }
    const degrees = Array.from(nodeDegrees.values());
    return {
      nodeCount: networkData.nodes.length,
      edgeCount: networkData.edges.length,
      avgDegree: degrees.length > 0 ? (degrees.reduce((a, b) => a + b, 0) / degrees.length).toFixed(1) : '0',
      maxDegree: degrees.length > 0 ? Math.max(...degrees) : 0,
    };
  }, [networkData]);

  useEffect(() => {
    if (!svgRef.current || networkData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 1000;
    const height = svgRef.current.clientHeight || 600;

    const nodes: SimulationNode[] = networkData.nodes.map((d) => ({ ...d }));
    const links: SimulationLink[] = networkData.edges.map((d) => ({
      source: d.source,
      target: d.target,
      weight: d.weight,
      label: d.label,
    }));

    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    const nodeDegrees = new Map<string, number>();
    for (const edge of networkData.edges) {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    }

    const sizeScale = d3
      .scaleSqrt()
      .domain([0, Math.max(...Array.from(nodeDegrees.values()), 1)])
      .range([4, 20]);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<SimulationNode, SimulationLink>(links)
          .id((d) => d.id)
          .strength(linkStrength)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimulationNode>().radius((d) => sizeScale(nodeDegrees.get(d.id) || 0) + 2));

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#404040')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.sqrt(d.weight || 1));

    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => sizeScale(nodeDegrees.get(d.id) || 0))
      .attr('fill', (_d, i) => colorScale(String(i % 10)))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        d3.select(this).attr('stroke', '#10b981').attr('stroke-width', 3);
        setHoveredNode(d);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
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

    const label = g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('font-size', 10)
      .attr('fill', '#a1a1aa')
      .attr('dx', (d) => sizeScale(nodeDegrees.get(d.id) || 0) + 4)
      .attr('dy', 3);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimulationNode).x!)
        .attr('y1', (d) => (d.source as SimulationNode).y!)
        .attr('x2', (d) => (d.target as SimulationNode).x!)
        .attr('y2', (d) => (d.target as SimulationNode).y!);

      node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

      label.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [networkData, linkStrength, chargeStrength]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>();

    if (direction === 'reset') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    } else {
      svg.transition().duration(200).call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
    }
  };

  if (networkData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">No network data available. Check your column mappings.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">{stats.nodeCount} nodes</Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">{stats.edgeCount} edges</Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">Avg degree: {stats.avgDegree}</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Link strength</span>
            <Slider value={[linkStrength]} onValueChange={([v]) => setLinkStrength(v)} min={0} max={1} step={0.1} className="w-24" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Repulsion</span>
            <Slider value={[-chargeStrength]} onValueChange={([v]) => setChargeStrength(-v)} min={50} max={1000} step={50} className="w-24" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('in')}><ZoomIn className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('out')}><ZoomOut className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('reset')}><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-zinc-950 overflow-hidden">
        <svg ref={svgRef} width="100%" height="100%" />
      </div>

      {hoveredNode && (
        <div className="absolute bottom-4 left-4 w-64 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-zinc-100">{hoveredNode.label}</h3>
          </div>
          <p className="text-xs text-zinc-500 font-mono mb-2">{hoveredNode.id}</p>
          {hoveredNode.group && (
            <div className="text-sm"><span className="text-zinc-500">Group: </span><span className="text-zinc-300">{hoveredNode.group}</span></div>
          )}
          <div className="text-xs text-zinc-500 mt-2">Drag to reposition • Scroll to zoom</div>
        </div>
      )}
    </div>
  );
}
