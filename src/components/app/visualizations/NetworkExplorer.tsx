import { useMemo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { transformToNetwork } from '@/lib/dataUtils';
import { useAppStore } from '@/store';
import { getRelationshipType } from '@/config/relationshipTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Info, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema, NetworkData, NetworkNode } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

interface SimulationNode extends NetworkNode, d3.SimulationNodeDatum {}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  weight?: number;
  label?: string;
  relationshipType?: string;
  cardinality?: string;
}

export function NetworkExplorer({ bundle }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');
  const [linkStrength, setLinkStrength] = useState(0.5);
  const [chargeStrength, setChargeStrength] = useState(-300);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const relationshipTypeConfig = useAppStore((s) => s.relationshipTypeConfig);

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

  const groups = useMemo(() => {
    return Array.from(new Set(networkData.nodes.map((n) => n.group).filter((g): g is string => Boolean(g))));
  }, [networkData]);

  const groupColorScale = useMemo(() => {
    return d3.scaleOrdinal<string>()
      .domain(groups)
      .range(d3.schemeTableau10);
  }, [groups]);

  const relationshipTypes = useMemo(() => {
    const types = new Set<string>();
    networkData.edges.forEach((edge) => {
      if (edge.relationshipType) {
        types.add(edge.relationshipType);
      }
    });
    return Array.from(types);
  }, [networkData]);

  const relationshipsByCategory = useMemo(() => {
    const byCategory = new Map<string, Set<string>>();
    relationshipTypes.forEach((typeName) => {
      const relType = getRelationshipType(relationshipTypeConfig, typeName);
      if (relType) {
        if (!byCategory.has(relType.category)) {
          byCategory.set(relType.category, new Set());
        }
        byCategory.get(relType.category)!.add(typeName);
      }
    });
    return byCategory;
  }, [relationshipTypes, relationshipTypeConfig]);

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
      relationshipType: d.relationshipType,
      cardinality: d.cardinality,
    }));

    // Extract unique groups for color scale
    const groups = Array.from(new Set(networkData.nodes.map((n) => n.group).filter((g): g is string => Boolean(g))));
    const colorScale = d3.scaleOrdinal<string>()
      .domain(groups)
      .range(d3.schemeTableau10);

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
      .attr('stroke', (d) => {
        if (d.relationshipType) {
          const relType = getRelationshipType(relationshipTypeConfig, d.relationshipType);
          return relType?.color || '#404040';
        }
        return '#404040';
      })
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.sqrt(d.weight || 1))
      .attr('stroke-dasharray', (d) => {
        if (d.relationshipType) {
          const relType = getRelationshipType(relationshipTypeConfig, d.relationshipType);
          if (relType?.lineStyle === 'dashed') return '5,5';
          if (relType?.lineStyle === 'dotted') return '2,3';
        }
        return 'none';
      });

    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => sizeScale(nodeDegrees.get(d.id) || 0))
      .attr('fill', (d) => d.group ? colorScale(d.group) : '#6366f1')
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
  }, [networkData, linkStrength, chargeStrength, relationshipTypeConfig]);

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

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('viz')} />;
  }

  // Show visualization view
  return (
    <div className="h-full flex flex-col relative">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewMode('grid')}
            className="h-8 gap-1.5 border-zinc-700 hover:bg-zinc-800"
          >
            <Eye className="w-3.5 h-3.5" />
            View Data
          </Button>
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

      {groups.length > 0 && (
        <div className="absolute top-16 right-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 shadow-xl">
          <div className="text-xs font-semibold text-zinc-400 mb-2">Node Groups</div>
          <div className="space-y-1.5">
            {groups.map((group) => (
              <div key={group} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: groupColorScale(group) }}
                />
                <span className="text-xs text-zinc-300">{group}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {relationshipTypes.length > 0 && (
        <div className="absolute top-16 left-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 shadow-xl max-h-[calc(100vh-10rem)] overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-400 mb-2">Relationship Types</div>
          <div className="space-y-2">
            {Array.from(relationshipsByCategory.entries()).map(([category, types]) => (
              <div key={category} className="space-y-1">
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedCategories);
                    if (newExpanded.has(category)) {
                      newExpanded.delete(category);
                    } else {
                      newExpanded.add(category);
                    }
                    setExpandedCategories(newExpanded);
                  }}
                  className="flex items-center gap-1.5 w-full text-left hover:text-zinc-200 transition-colors"
                >
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-zinc-500" />
                  )}
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: relationshipTypeConfig.categoryColors[category] || '#6b7280' }}
                  />
                  <span className="text-xs text-zinc-300 font-medium">{category}</span>
                  <span className="text-xs text-zinc-500">({types.size})</span>
                </button>
                {expandedCategories.has(category) && (
                  <div className="ml-5 space-y-1">
                    {Array.from(types).map((typeName) => {
                      const relType = getRelationshipType(relationshipTypeConfig, typeName);
                      return (
                        <div key={typeName} className="flex items-center gap-2">
                          <div
                            className="w-8 h-0.5 flex-shrink-0"
                            style={{
                              backgroundColor: relType?.color || '#404040',
                              borderStyle: relType?.lineStyle === 'dashed' ? 'dashed' : relType?.lineStyle === 'dotted' ? 'dotted' : 'solid',
                              borderWidth: relType?.lineStyle !== 'solid' ? '1px' : '0',
                              borderColor: relType?.color || '#404040',
                              borderTop: 'none',
                              borderBottom: relType?.lineStyle !== 'solid' ? '1px' : '0',
                              height: relType?.lineStyle !== 'solid' ? '0' : '2px',
                            }}
                          />
                          <span className="text-xs text-zinc-400">{typeName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
