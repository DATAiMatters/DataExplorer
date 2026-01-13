import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { SankeyNode, SankeyLink } from 'd3-sankey';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCcw, Eye } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

interface FlowData {
  source: string;
  target: string;
  value: number;
  type: string;
  description?: string;
}

interface SankeyNodeData {
  name: string;
  category?: string;
}

export function FlowExplorer({ bundle }: Props) {
  const [hoveredElement, setHoveredElement] = useState<{
    type: 'node' | 'link';
    data: SankeyNode<SankeyNodeData, {}> | SankeyLink<SankeyNodeData, {}>;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  // Extract flow data from bundle
  const flowData = useMemo(() => {
    const sourceRole = bundle.mappings.find((m) => m.roleId === 'source');
    const targetRole = bundle.mappings.find((m) => m.roleId === 'target');
    const valueRole = bundle.mappings.find((m) => m.roleId === 'flow_value');
    const typeRole = bundle.mappings.find((m) => m.roleId === 'flow_type');
    const descriptionRole = bundle.mappings.find((m) => m.roleId === 'description');

    if (!sourceRole || !targetRole || !valueRole) {
      return null;
    }

    const flows: FlowData[] = [];
    const nodeSet = new Set<string>();

    for (const row of bundle.source.parsedData) {
      const source = String(row[sourceRole.sourceColumn] ?? '');
      const target = String(row[targetRole.sourceColumn] ?? '');
      const value = Number(row[valueRole.sourceColumn] ?? 0);
      const type = typeRole ? String(row[typeRole.sourceColumn] ?? 'flow') : 'flow';
      const description = descriptionRole ? String(row[descriptionRole.sourceColumn] ?? '') : '';

      if (source && target && value > 0) {
        flows.push({ source, target, value, type, description });
        nodeSet.add(source);
        nodeSet.add(target);
      }
    }

    const nodes = Array.from(nodeSet).map((name) => ({ name }));

    return { flows, nodes };
  }, [bundle]);

  // Flow type colors
  const flowTypeColors: Record<string, string> = {
    revenue: '#10b981',
    expense: '#ef4444',
    profit: '#3b82f6',
    allocation: '#8b5cf6',
    flow: '#6b7280',
  };

  // Compute Sankey layout
  const sankeyData = useMemo(() => {
    if (!flowData) return null;

    const width = 1200;
    const height = 800;
    const nodeWidth = 15;
    const nodePadding = 20;

    // Create sankey generator
    const sankeyGenerator = sankey<SankeyNodeData, {}>()
      .nodeWidth(nodeWidth)
      .nodePadding(nodePadding)
      .extent([
        [100, 50],
        [width - 100, height - 50],
      ]);

    // Prepare nodes and links
    const nodes: SankeyNode<SankeyNodeData, {}>[] = flowData.nodes.map((n) => ({ ...n }));
    const links: SankeyLink<SankeyNodeData, {}>[] = flowData.flows.map((f) => ({
      source: flowData.nodes.findIndex((n) => n.name === f.source),
      target: flowData.nodes.findIndex((n) => n.name === f.target),
      value: f.value,
    }));

    // Compute layout
    const graph = sankeyGenerator({
      nodes,
      links,
    });

    return { graph, width, height, flows: flowData.flows };
  }, [flowData]);

  // Zoom behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial transform
    svg.call(zoom.transform, d3.zoomIdentity.translate(20, 20).scale(1));

    return () => {
      svg.on('.zoom', null);
    };
  }, [sankeyData]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 3]);

    if (direction === 'reset') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(20, 20).scale(1));
    } else {
      svg.transition().duration(200).call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
    }
  };

  if (!flowData || !sankeyData) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">
          No flow data available. Ensure source, target, and flow_value columns are mapped.
        </p>
      </div>
    );
  }

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('viz')} />;
  }

  const { graph, width, height, flows } = sankeyData;

  // Helper to get flow color
  const getFlowColor = (link: SankeyLink<SankeyNodeData, {}>) => {
    const sourceNode = link.source as SankeyNode<SankeyNodeData, {}>;
    const targetNode = link.target as SankeyNode<SankeyNodeData, {}>;
    const flow = flows.find(
      (f) => f.source === sourceNode.name && f.target === targetNode.name
    );
    return flow ? flowTypeColors[flow.type] || flowTypeColors.flow : flowTypeColors.flow;
  };

  // Helper to get flow description
  const getFlowDescription = (link: SankeyLink<SankeyNodeData, {}>) => {
    const sourceNode = link.source as SankeyNode<SankeyNodeData, {}>;
    const targetNode = link.target as SankeyNode<SankeyNodeData, {}>;
    const flow = flows.find(
      (f) => f.source === sourceNode.name && f.target === targetNode.name
    );
    return flow?.description || '';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Flow Diagram (Sankey)</h3>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {graph.nodes.length} nodes
          </Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {graph.links.length} flows
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewMode('grid')}
            className="h-8 gap-1.5 border-zinc-700 hover:bg-zinc-800"
          >
            <Eye className="w-3.5 h-3.5" />
            View Data
          </Button>
        </div>
      </div>

      {/* Flow Type Legend */}
      <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-zinc-500">Flow Types:</span>
        {Object.entries(flowTypeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-xs text-zinc-300 capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Visualization Area */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex gap-1 z-10">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900"
            onClick={() => handleZoom('in')}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900"
            onClick={() => handleZoom('out')}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900"
            onClick={() => handleZoom('reset')}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-full overflow-auto p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="cursor-grab active:cursor-grabbing w-full h-full"
            style={{ minWidth: width, minHeight: height }}
          >
            <g ref={gRef}>
              {/* Links (flows) */}
              {graph.links.map((link, i) => {
                const isHovered =
                  hoveredElement?.type === 'link' && hoveredElement.data === link;
                const path = sankeyLinkHorizontal()(link);
                const color = getFlowColor(link);

                return (
                  <path
                    key={i}
                    d={path!}
                    fill="none"
                    stroke={color}
                    strokeWidth={Math.max(1, link.width || 0)}
                    strokeOpacity={isHovered ? 0.8 : 0.4}
                    onMouseEnter={() => setHoveredElement({ type: 'link', data: link })}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{ cursor: 'pointer' }}
                    className="transition-all duration-150"
                  />
                );
              })}

              {/* Nodes */}
              {graph.nodes.map((node, i) => {
                const isHovered =
                  hoveredElement?.type === 'node' && hoveredElement.data === node;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredElement({ type: 'node', data: node })}
                    onMouseLeave={() => setHoveredElement(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Node rectangle */}
                    <rect
                      x={node.x0}
                      y={node.y0}
                      width={node.x1! - node.x0!}
                      height={node.y1! - node.y0!}
                      fill={isHovered ? '#10b981' : '#52525b'}
                      stroke={isHovered ? '#fff' : '#71717a'}
                      strokeWidth={isHovered ? 2 : 1}
                      className="transition-all duration-150"
                    />

                    {/* Node label */}
                    <text
                      x={node.x0! < width / 2 ? node.x1! + 6 : node.x0! - 6}
                      y={(node.y0! + node.y1!) / 2}
                      textAnchor={node.x0! < width / 2 ? 'start' : 'end'}
                      dominantBaseline="middle"
                      className="text-sm fill-zinc-300 select-none"
                      style={{
                        fontFamily: 'system-ui',
                        fontWeight: isHovered ? 'bold' : 'normal',
                      }}
                    >
                      {node.name}
                    </text>

                    {/* Node value */}
                    {isHovered && (
                      <text
                        x={node.x0! < width / 2 ? node.x1! + 6 : node.x0! - 6}
                        y={(node.y0! + node.y1!) / 2 + 16}
                        textAnchor={node.x0! < width / 2 ? 'start' : 'end'}
                        className="text-xs fill-zinc-500"
                        style={{ fontFamily: 'system-ui' }}
                      >
                        ${((node.value || 0) / 1000000).toFixed(1)}M
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Detail Panel */}
        {hoveredElement && (
          <div className="absolute bottom-4 right-4 w-80 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-10">
            {hoveredElement.type === 'node' ? (
              <>
                <h3 className="font-semibold text-zinc-100 mb-3">
                  {(hoveredElement.data as SankeyNode<SankeyNodeData, {}>).name}
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Total Flow:</span>{' '}
                    <span className="text-emerald-400 font-bold">
                      $
                      {(
                        ((hoveredElement.data as SankeyNode<SankeyNodeData, {}>).value || 0) /
                        1000000
                      ).toFixed(2)}
                      M
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Incoming:</span>{' '}
                    <span className="text-zinc-200">
                      {
                        graph.links.filter(
                          (l) =>
                            (l.target as SankeyNode<SankeyNodeData, {}>).name ===
                            (hoveredElement.data as SankeyNode<SankeyNodeData, {}>).name
                        ).length
                      }{' '}
                      flows
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Outgoing:</span>{' '}
                    <span className="text-zinc-200">
                      {
                        graph.links.filter(
                          (l) =>
                            (l.source as SankeyNode<SankeyNodeData, {}>).name ===
                            (hoveredElement.data as SankeyNode<SankeyNodeData, {}>).name
                        ).length
                      }{' '}
                      flows
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <div className="text-sm text-zinc-400 mb-1">Flow</div>
                  <h3 className="font-semibold text-zinc-100">
                    {((hoveredElement.data as SankeyLink<SankeyNodeData, {}>).source as SankeyNode<SankeyNodeData, {}>).name} →{' '}
                    {((hoveredElement.data as SankeyLink<SankeyNodeData, {}>).target as SankeyNode<SankeyNodeData, {}>).name}
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Value:</span>{' '}
                    <span className="text-emerald-400 font-bold">
                      $
                      {(
                        ((hoveredElement.data as SankeyLink<SankeyNodeData, {}>).value || 0) /
                        1000000
                      ).toFixed(2)}
                      M
                    </span>
                  </div>
                  {getFlowDescription(hoveredElement.data as SankeyLink<SankeyNodeData, {}>) && (
                    <div className="pt-2 border-t border-zinc-800">
                      <p className="text-xs text-zinc-400">
                        {getFlowDescription(hoveredElement.data as SankeyLink<SankeyNodeData, {}>)}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
