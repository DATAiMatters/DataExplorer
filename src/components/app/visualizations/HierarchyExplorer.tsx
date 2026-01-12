import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '@/store';
import { transformToHierarchy, findNodeById, flattenHierarchy } from '@/lib/dataUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronRight, Home, Maximize, LayoutGrid, GitBranch, ZoomIn, ZoomOut, RotateCcw, ArrowRight, ArrowDown, Eye } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema, HierarchyNode } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

type ViewType = 'treemap' | 'tree';
type TreeOrientation = 'horizontal' | 'vertical';

export function HierarchyExplorer({ bundle }: Props) {
  const breadcrumb = useAppStore((s) => s.explorerState.breadcrumb);
  const focusedNodeId = useAppStore((s) => s.explorerState.focusedNodeId);
  const pushBreadcrumb = useAppStore((s) => s.pushBreadcrumb);
  const popBreadcrumb = useAppStore((s) => s.popBreadcrumb);
  const resetBreadcrumb = useAppStore((s) => s.resetBreadcrumb);

  const [hoveredNode, setHoveredNode] = useState<HierarchyNode | null>(null);
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');
  const [viewType, setViewType] = useState<ViewType>('treemap');
  const [treeOrientation, setTreeOrientation] = useState<TreeOrientation>('horizontal');

  // Transform data to hierarchy
  const hierarchyData = useMemo(() => {
    try {
      return transformToHierarchy(bundle.source, bundle.mappings);
    } catch (e) {
      console.error('Failed to transform hierarchy:', e);
      return [];
    }
  }, [bundle]);

  // Get current view nodes based on breadcrumb
  const currentNodes = useMemo(() => {
    if (!focusedNodeId) return hierarchyData;
    const focusedNode = findNodeById(hierarchyData, focusedNodeId);
    return focusedNode?.children || [];
  }, [hierarchyData, focusedNodeId]);

  const handleNodeClick = useCallback(
    (node: HierarchyNode) => {
      if (node.children && node.children.length > 0) {
        pushBreadcrumb(node.id);
      }
    },
    [pushBreadcrumb]
  );

  // Color scale based on depth
  const colorScale = useMemo(() => {
    return d3
      .scaleOrdinal<string>()
      .domain(['0', '1', '2', '3', '4', '5'])
      .range(['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899']);
  }, []);

  // Get breadcrumb labels
  const breadcrumbItems = useMemo(() => {
    const items: { id: string; label: string }[] = [{ id: '__root__', label: 'Root' }];
    for (const nodeId of breadcrumb) {
      const node = findNodeById(hierarchyData, nodeId);
      if (node) {
        items.push({ id: node.id, label: node.label });
      }
    }
    return items;
  }, [breadcrumb, hierarchyData]);

  const stats = useMemo(() => {
    const flat = flattenHierarchy(hierarchyData);
    const maxDepth = Math.max(...flat.map((n) => n.depth || 0));
    return {
      totalNodes: flat.length,
      rootNodes: hierarchyData.length,
      maxDepth,
      currentViewNodes: currentNodes.length,
    };
  }, [hierarchyData, currentNodes]);

  if (hierarchyData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">No hierarchy data available. Check your column mappings.</p>
      </div>
    );
  }

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('viz')} />;
  }

  // Show visualization view
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
            onClick={resetBreadcrumb}
          >
            <Home className="w-4 h-4" />
          </Button>

          {breadcrumbItems.map((item, index) => (
            <div key={item.id} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 text-zinc-600" />}
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 ${
                  index === breadcrumbItems.length - 1
                    ? 'text-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => {
                  if (index === 0) {
                    resetBreadcrumb();
                  } else {
                    const popsNeeded = breadcrumbItems.length - 1 - index;
                    for (let i = 0; i < popsNeeded; i++) {
                      popBreadcrumb();
                    }
                  }
                }}
              >
                {item.label}
              </Button>
            </div>
          ))}
        </div>

        {/* View Toggle & Stats */}
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

          <ToggleGroup type="single" value={viewType} onValueChange={(v) => v && setViewType(v as ViewType)}>
            <ToggleGroupItem value="treemap" aria-label="Treemap view" className="h-8 px-3 data-[state=on]:bg-zinc-700">
              <LayoutGrid className="w-4 h-4 mr-1" />
              Treemap
            </ToggleGroupItem>
            <ToggleGroupItem value="tree" aria-label="Tree view" className="h-8 px-3 data-[state=on]:bg-zinc-700">
              <GitBranch className="w-4 h-4 mr-1" />
              Tree
            </ToggleGroupItem>
          </ToggleGroup>

          {viewType === 'tree' && (
            <ToggleGroup type="single" value={treeOrientation} onValueChange={(v) => v && setTreeOrientation(v as TreeOrientation)}>
              <ToggleGroupItem value="horizontal" aria-label="Horizontal layout" className="h-8 px-2 data-[state=on]:bg-zinc-700">
                <ArrowRight className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="vertical" aria-label="Vertical layout" className="h-8 px-2 data-[state=on]:bg-zinc-700">
                <ArrowDown className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {stats.currentViewNodes} nodes in view
          </Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {stats.totalNodes} total
          </Badge>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="flex-1 overflow-hidden relative">
        {viewType === 'treemap' ? (
          <TreemapView
            currentNodes={currentNodes}
            colorScale={colorScale}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
            onNodeClick={handleNodeClick}
          />
        ) : (
          <TreeView
            hierarchyData={hierarchyData}
            focusedNodeId={focusedNodeId}
            colorScale={colorScale}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
            onNodeClick={handleNodeClick}
            orientation={treeOrientation}
          />
        )}

        {/* Node Detail Panel */}
        {hoveredNode && (
          <div className="absolute bottom-4 right-4 w-72 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-10">
            <h3 className="font-semibold text-zinc-100 mb-1">{hoveredNode.label}</h3>
            <p className="text-xs text-zinc-500 font-mono mb-3">{hoveredNode.id}</p>

            {Object.keys(hoveredNode.metrics).length > 0 && (
              <div className="space-y-1 mb-3">
                {Object.entries(hoveredNode.metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{key}</span>
                    <span className="text-zinc-200 font-medium">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hoveredNode.children && hoveredNode.children.length > 0 && (
              <div className="text-xs text-zinc-500">
                Click to drill into {hoveredNode.children.length} children
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// TREEMAP VIEW COMPONENT
// ============================================

interface TreemapViewProps {
  currentNodes: HierarchyNode[];
  colorScale: d3.ScaleOrdinal<string, string>;
  hoveredNode: HierarchyNode | null;
  setHoveredNode: (node: HierarchyNode | null) => void;
  onNodeClick: (node: HierarchyNode) => void;
}

function TreemapView({ currentNodes, colorScale, hoveredNode, setHoveredNode, onNodeClick }: TreemapViewProps) {
  const treemapData = useMemo(() => {
    if (currentNodes.length === 0) return null;

    const virtualRoot: HierarchyNode = {
      id: '__root__',
      label: 'Root',
      parentId: null,
      metrics: {},
      children: currentNodes,
    };

    const root = d3
      .hierarchy(virtualRoot)
      .sum((d) => {
        const firstMetric = Object.values(d.metrics)[0];
        return firstMetric || (d.children?.length ? 0 : 1);
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const width = 1200;
    const height = 700;

    d3.treemap<HierarchyNode>()
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(2)
      .round(true)(root);

    return root;
  }, [currentNodes]);

  if (!treemapData) return null;

  return (
    <div className="h-full overflow-auto p-4 bg-zinc-950">
      <div className="relative" style={{ width: 1200, height: 700 }}>
        <svg width="100%" height="100%" viewBox="0 0 1200 700">
          {treemapData?.children?.map((d) => {
            const node = d.data;
            const x0 = (d as unknown as { x0: number }).x0;
            const y0 = (d as unknown as { y0: number }).y0;
            const x1 = (d as unknown as { x1: number }).x1;
            const y1 = (d as unknown as { y1: number }).y1;
            const width = x1 - x0;
            const height = y1 - y0;
            const hasChildren = node.children && node.children.length > 0;

            const color = colorScale(String((node.depth || 0) % 6));
            const isHovered = hoveredNode?.id === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${x0},${y0})`}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick(node)}
                style={{ cursor: hasChildren ? 'pointer' : 'default' }}
              >
                <rect
                  width={width}
                  height={height}
                  fill={color}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  stroke={isHovered ? '#fff' : color}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={0.8}
                  rx={4}
                  className="transition-all duration-150"
                />

                {width > 40 && height > 30 && (
                  <foreignObject x={4} y={4} width={width - 8} height={height - 8}>
                    <div className="h-full flex flex-col overflow-hidden">
                      <div
                        className="text-white font-medium text-sm truncate"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                      >
                        {node.label}
                      </div>
                      {height > 50 && (
                        <div
                          className="text-white/70 text-xs truncate"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                        >
                          {node.id}
                        </div>
                      )}
                      {height > 70 && Object.keys(node.metrics).length > 0 && (
                        <div className="mt-auto">
                          {Object.entries(node.metrics)
                            .slice(0, 2)
                            .map(([key, value]) => (
                              <div
                                key={key}
                                className="text-white/80 text-xs"
                                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                              >
                                {key}: {typeof value === 'number' ? value.toLocaleString() : value}
                              </div>
                            ))}
                        </div>
                      )}
                      {hasChildren && width > 60 && (
                        <div className="mt-auto">
                          <span className="inline-flex items-center gap-1 text-white/60 text-xs bg-black/20 rounded px-1">
                            <Maximize className="w-3 h-3" />
                            {node.children!.length} children
                          </span>
                        </div>
                      )}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ============================================
// TREE VIEW COMPONENT
// ============================================

interface TreeViewProps {
  hierarchyData: HierarchyNode[];
  focusedNodeId: string | null;
  colorScale: d3.ScaleOrdinal<string, string>;
  hoveredNode: HierarchyNode | null;
  setHoveredNode: (node: HierarchyNode | null) => void;
  onNodeClick: (node: HierarchyNode) => void;
  orientation: TreeOrientation;
}

function TreeView({ hierarchyData, focusedNodeId, colorScale, hoveredNode, setHoveredNode, onNodeClick, orientation }: TreeViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  const isVertical = orientation === 'vertical';

  // Get the subtree to display
  const displayRoot = useMemo(() => {
    if (!focusedNodeId) {
      // Show all roots under a virtual root
      return {
        id: '__virtual_root__',
        label: 'Root',
        parentId: null,
        metrics: {},
        children: hierarchyData,
      } as HierarchyNode;
    }
    const node = findNodeById(hierarchyData, focusedNodeId);
    return node || hierarchyData[0];
  }, [hierarchyData, focusedNodeId]);

  const treeLayout = useMemo(() => {
    if (!displayRoot) return null;

    const root = d3.hierarchy(displayRoot);
    
    // Calculate dimensions based on tree size
    const nodeCount = root.descendants().length;
    const maxDepth = root.height;
    
    let width: number;
    let height: number;
    
    if (isVertical) {
      // Top-down: width based on node count, height based on depth
      width = Math.max(800, nodeCount * 80);
      height = Math.max(600, maxDepth * 120 + 100);
    } else {
      // Left-right: width based on depth, height based on node count
      width = Math.max(800, maxDepth * 250);
      height = Math.max(600, nodeCount * 28);
    }

    const treeGen = d3.tree<HierarchyNode>()
      .size(isVertical ? [width - 100, height - 100] : [height - 40, width - 200])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

    treeGen(root);

    return { root, width, height };
  }, [displayRoot, isVertical]);

  // Zoom behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initial transform to center - different for each orientation
    if (isVertical) {
      svg.call(zoom.transform, d3.zoomIdentity.translate(50, 50).scale(0.8));
    } else {
      svg.call(zoom.transform, d3.zoomIdentity.translate(100, 20).scale(0.9));
    }

    return () => {
      svg.on('.zoom', null);
    };
  }, [treeLayout, isVertical]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 3]);

    if (direction === 'reset') {
      if (isVertical) {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(50, 50).scale(0.8));
      } else {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(100, 20).scale(0.9));
      }
    } else {
      svg.transition().duration(200).call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
    }
  };

  if (!treeLayout) return null;

  const { root } = treeLayout;

  return (
    <div className="h-full bg-zinc-950 overflow-hidden relative">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex gap-1 z-10">
        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900" onClick={() => handleZoom('in')}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900" onClick={() => handleZoom('out')}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700 bg-zinc-900" onClick={() => handleZoom('reset')}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <svg ref={svgRef} width="100%" height="100%" className="cursor-grab active:cursor-grabbing">
        <g ref={gRef}>
          {/* Links */}
          <g fill="none" stroke="#404040" strokeWidth={1.5}>
            {root.links().map((link, i) => {
              // D3 tree layout uses x for vertical position and y for horizontal
              // We need to swap these based on orientation
              let sourceX: number, sourceY: number, targetX: number, targetY: number;
              
              if (isVertical) {
                // Top-down: x stays x, y stays y (but d3 swaps them)
                sourceX = (link.source as unknown as { x: number }).x;
                sourceY = (link.source as unknown as { y: number }).y;
                targetX = (link.target as unknown as { x: number }).x;
                targetY = (link.target as unknown as { y: number }).y;
              } else {
                // Left-right: swap x and y
                sourceX = (link.source as unknown as { y: number }).y;
                sourceY = (link.source as unknown as { x: number }).x;
                targetX = (link.target as unknown as { y: number }).y;
                targetY = (link.target as unknown as { x: number }).x;
              }

              // Create curved path based on orientation
              const pathD = isVertical
                ? `M${sourceX},${sourceY} C${sourceX},${(sourceY + targetY) / 2} ${targetX},${(sourceY + targetY) / 2} ${targetX},${targetY}`
                : `M${sourceX},${sourceY} C${(sourceX + targetX) / 2},${sourceY} ${(sourceX + targetX) / 2},${targetY} ${targetX},${targetY}`;

              return (
                <path
                  key={i}
                  d={pathD}
                  className="transition-all duration-150"
                  stroke={hoveredNode?.id === link.target.data.id ? '#10b981' : '#404040'}
                  strokeWidth={hoveredNode?.id === link.target.data.id ? 2 : 1.5}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {root.descendants().map((d) => {
              const node = d.data;
              // Position based on orientation
              const x = isVertical 
                ? (d as unknown as { x: number }).x 
                : (d as unknown as { y: number }).y;
              const y = isVertical 
                ? (d as unknown as { y: number }).y 
                : (d as unknown as { x: number }).x;
              const hasChildren = node.children && node.children.length > 0;
              const isHovered = hoveredNode?.id === node.id;
              const isVirtualRoot = node.id === '__virtual_root__';

              if (isVirtualRoot) return null;

              const color = colorScale(String((node.depth || 0) % 6));

              // Label positioning based on orientation
              const labelX = isVertical ? 0 : 10;
              const labelY = isVertical ? -12 : 4;
              const textAnchor = isVertical ? 'middle' : 'start';

              return (
                <g
                  key={node.id}
                  transform={`translate(${x},${y})`}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => onNodeClick(node)}
                  style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                >
                  {/* Node circle */}
                  <circle
                    r={isHovered ? 8 : 6}
                    fill={color}
                    stroke={isHovered ? '#fff' : color}
                    strokeWidth={2}
                    className="transition-all duration-150"
                  />

                  {/* Node label */}
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={textAnchor}
                    className="text-xs fill-zinc-300 select-none"
                    style={{ fontFamily: 'system-ui' }}
                  >
                    {node.label}
                    {hasChildren && (
                      <tspan className="fill-zinc-500"> ({node.children!.length})</tspan>
                    )}
                  </text>

                  {/* Metrics on hover */}
                  {isHovered && Object.keys(node.metrics).length > 0 && (
                    <g transform={isVertical ? "translate(12, 4)" : "translate(10, 16)"}>
                      {Object.entries(node.metrics).slice(0, 2).map(([key, value], i) => (
                        <text
                          key={key}
                          y={i * 14}
                          className="text-xs fill-zinc-500"
                          style={{ fontFamily: 'system-ui', fontSize: '10px' }}
                        >
                          {key}: {typeof value === 'number' ? value.toLocaleString() : value}
                        </text>
                      ))}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
