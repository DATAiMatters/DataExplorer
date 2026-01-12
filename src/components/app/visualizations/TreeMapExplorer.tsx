import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCcw, Eye, Home, ChevronRight } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

interface TreeMapNode {
  id: string;
  label: string;
  parent: string | null;
  value: number;
  colorMetric?: number;
  children?: TreeMapNode[];
}

export function TreeMapExplorer({ bundle }: Props) {
  const [hoveredNode, setHoveredNode] = useState<TreeMapNode | null>(null);
  const [clickedPath, setClickedPath] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  // Extract tree map data from bundle
  const { treeData, colorRange } = useMemo(() => {
    const categoryRole = bundle.mappings.find((m) => m.roleId === 'category');
    const parentRole = bundle.mappings.find((m) => m.roleId === 'parent_category');
    const valueRole = bundle.mappings.find((m) => m.roleId === 'value');
    const colorRole = bundle.mappings.find((m) => m.roleId === 'color_metric');
    const labelRole = bundle.mappings.find((m) => m.roleId === 'label');

    if (!categoryRole || !parentRole || !valueRole) {
      return { treeData: null, colorRange: null };
    }

    const nodesMap = new Map<string, TreeMapNode>();
    const colorValues: number[] = [];

    // First pass: create all nodes
    for (const row of bundle.source.parsedData) {
      const id = String(row[categoryRole.sourceColumn] ?? '');
      const parent = String(row[parentRole.sourceColumn] ?? 'null');
      const value = Number(row[valueRole.sourceColumn] ?? 0);
      const colorMetric = colorRole ? Number(row[colorRole.sourceColumn] ?? value) : value;
      const label = labelRole ? String(row[labelRole.sourceColumn] ?? id) : id;

      if (id) {
        const node: TreeMapNode = {
          id,
          label,
          parent: parent === 'null' ? null : parent,
          value,
          colorMetric,
          children: [],
        };
        nodesMap.set(id, node);
        if (colorMetric !== undefined) {
          colorValues.push(colorMetric);
        }
      }
    }

    // Second pass: build tree structure
    const roots: TreeMapNode[] = [];
    nodesMap.forEach((node) => {
      if (node.parent === null) {
        roots.push(node);
      } else {
        const parentNode = nodesMap.get(node.parent);
        if (parentNode) {
          parentNode.children?.push(node);
        } else {
          // Orphaned node, treat as root
          roots.push(node);
        }
      }
    });

    const colorMin = colorValues.length > 0 ? Math.min(...colorValues) : 0;
    const colorMax = colorValues.length > 0 ? Math.max(...colorValues) : 1;

    return { treeData: roots, colorRange: [colorMin, colorMax] as [number, number] };
  }, [bundle]);

  // Color scale
  const colorScale = useMemo(() => {
    if (!colorRange) return null;
    return d3.scaleSequential(d3.interpolateTurbo).domain(colorRange);
  }, [colorRange]);

  // Zoom behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial transform
    svg.call(zoom.transform, d3.zoomIdentity.translate(20, 20).scale(1));

    return () => {
      svg.on('.zoom', null);
    };
  }, [treeData, clickedPath]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 4]);

    if (direction === 'reset') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(20, 20).scale(1));
    } else {
      svg.transition().duration(200).call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
    }
  };

  // Get current visible tree based on clicked path
  const visibleRoot = useMemo(() => {
    if (!treeData) return null;
    if (clickedPath.length === 0) {
      // Show all roots under a virtual root
      return {
        id: '__root__',
        label: 'All Categories',
        parent: null,
        value: 0,
        children: treeData,
      } as TreeMapNode;
    }

    // Find the clicked node
    const findNode = (nodes: TreeMapNode[], path: string[]): TreeMapNode | null => {
      if (path.length === 0) return null;
      const targetId = path[0];
      for (const node of nodes) {
        if (node.id === targetId) {
          if (path.length === 1) return node;
          if (node.children) {
            return findNode(node.children, path.slice(1));
          }
        }
        if (node.children) {
          const found = findNode(node.children, path);
          if (found) return found;
        }
      }
      return null;
    };

    return findNode(treeData, clickedPath);
  }, [treeData, clickedPath]);

  // Compute treemap layout
  const treemapLayout = useMemo(() => {
    if (!visibleRoot) return null;

    const width = 1200;
    const height = 700;

    const root = d3
      .hierarchy(visibleRoot)
      .sum((d) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3
      .treemap<TreeMapNode>()
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(2)
      .round(true)(root);

    return { root, width, height };
  }, [visibleRoot]);

  if (!treeData || !colorScale) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">
          No tree map data available. Ensure category, parent_category, and value columns are mapped.
        </p>
      </div>
    );
  }

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('viz')} />;
  }

  if (!treemapLayout) return null;

  const { root, width, height } = treemapLayout;

  // Build breadcrumb from clicked path
  const breadcrumb = useMemo(() => {
    const items: { id: string; label: string }[] = [{ id: '__root__', label: 'All Categories' }];
    let current: TreeMapNode[] | undefined = treeData;
    for (const nodeId of clickedPath) {
      const found: TreeMapNode | undefined = current?.find((n) => n.id === nodeId);
      if (found) {
        items.push({ id: found.id, label: found.label });
        current = found.children;
      }
    }
    return items;
  }, [clickedPath, treeData]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
            onClick={() => setClickedPath([])}
          >
            <Home className="w-4 h-4" />
          </Button>

          {breadcrumb.map((item, index) => (
            <div key={item.id} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 text-zinc-600" />}
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 ${
                  index === breadcrumb.length - 1 ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => {
                  if (index === 0) {
                    setClickedPath([]);
                  } else {
                    setClickedPath(clickedPath.slice(0, index));
                  }
                }}
              >
                {item.label}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {root.descendants().filter((d) => d.depth > 0).length} categories
          </Badge>
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
            width={width}
            height={height}
            className="cursor-grab active:cursor-grabbing"
          >
            <g ref={gRef}>
              {root.descendants().filter(d => d.depth > 0).map((d) => {
                const node = d.data;
                const x0 = (d as unknown as { x0: number }).x0;
                const y0 = (d as unknown as { y0: number }).y0;
                const x1 = (d as unknown as { x1: number }).x1;
                const y1 = (d as unknown as { y1: number }).y1;
                const rectWidth = x1 - x0;
                const rectHeight = y1 - y0;
                const hasChildren = node.children && node.children.length > 0;
                const isHovered = hoveredNode?.id === node.id;

                const color = colorScale(node.colorMetric ?? node.value);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${x0},${y0})`}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => {
                      if (hasChildren) {
                        setClickedPath([...clickedPath, node.id]);
                      }
                    }}
                    style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                  >
                    <rect
                      width={rectWidth}
                      height={rectHeight}
                      fill={color}
                      fillOpacity={isHovered ? 0.9 : 0.75}
                      stroke={isHovered ? '#fff' : '#27272a'}
                      strokeWidth={isHovered ? 3 : 1}
                      rx={4}
                      className="transition-all duration-150"
                    />

                    {rectWidth > 40 && rectHeight > 30 && (
                      <foreignObject x={4} y={4} width={rectWidth - 8} height={rectHeight - 8}>
                        <div className="h-full flex flex-col overflow-hidden p-1">
                          <div
                            className="text-white font-semibold text-sm truncate"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                          >
                            {node.id}
                          </div>
                          {rectHeight > 50 && (
                            <div
                              className="text-white/90 text-xs truncate"
                              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                            >
                              {node.label}
                            </div>
                          )}
                          {rectHeight > 70 && (
                            <div
                              className="text-white/80 text-xs font-bold mt-1"
                              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                            >
                              ${(node.value / 1000000).toFixed(1)}M
                            </div>
                          )}
                          {hasChildren && rectWidth > 80 && rectHeight > 90 && (
                            <div className="mt-auto">
                              <span className="inline-flex text-white/60 text-xs bg-black/30 rounded px-1.5 py-0.5">
                                {node.children!.length} subcategories
                              </span>
                            </div>
                          )}
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Node Detail Panel */}
        {hoveredNode && (
          <div className="absolute bottom-4 right-4 w-72 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-10">
            <h3 className="font-semibold text-zinc-100 mb-1">{hoveredNode.id}</h3>
            <p className="text-sm text-zinc-400 mb-3">{hoveredNode.label}</p>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Value</span>
                <span className="text-sm text-emerald-400 font-bold">
                  ${(hoveredNode.value / 1000000).toFixed(2)}M
                </span>
              </div>
              {hoveredNode.colorMetric !== undefined && hoveredNode.colorMetric !== hoveredNode.value && (
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Color Metric</span>
                  <span className="text-sm text-zinc-200 font-medium">
                    {hoveredNode.colorMetric.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {hoveredNode.children && hoveredNode.children.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500">
                Click to drill into {hoveredNode.children.length} subcategories
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
