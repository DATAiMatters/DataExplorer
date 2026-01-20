import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { transformToNetwork } from '@/lib/dataUtils';
import { useAppStore } from '@/store';
import { getRelationshipType } from '@/config/relationshipTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Info, Eye, Play, Pause, ChevronDown, ChevronRight } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema, NetworkData, NetworkNode } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
  onSwitchToSVG?: () => void;
}

// Performance thresholds
const LAYOUT_ITERATION_LIMIT = 100;
const SKIP_AUTO_LAYOUT_THRESHOLD = 50000; // Skip auto-layout for very large graphs

export function NetworkExplorerWebGL({ bundle, onSwitchToSVG }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const layoutRunningRef = useRef(false);

  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');
  const [layoutRunning, setLayoutRunning] = useState(false);
  const [layoutProgress, setLayoutProgress] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [graphReady, setGraphReady] = useState(false);
  const [buildingGraph, setBuildingGraph] = useState(false);

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

  // Color scale for groups
  const groupColors = useMemo(() => {
    const colors = [
      '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
      '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
    ];
    const colorMap = new Map<string, string>();
    groups.forEach((group, i) => {
      colorMap.set(group, colors[i % colors.length]);
    });
    return colorMap;
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

  // Build the graphology graph asynchronously for large graphs
  const buildGraphAsync = useCallback(async (): Promise<Graph> => {
    const graph = new Graph();
    const nodeCount = networkData.nodes.length;
    const edgeCount = networkData.edges.length;

    // Calculate node degrees for sizing
    const nodeDegrees = new Map<string, number>();
    for (const edge of networkData.edges) {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    }
    const maxDegree = Math.max(...Array.from(nodeDegrees.values()), 1);

    // Use circular layout for initial positions (better than random for large graphs)
    const radius = Math.min(1000, Math.sqrt(nodeCount) * 10);
    const centerX = 500;
    const centerY = 500;

    // Add nodes in batches to avoid blocking UI
    const BATCH_SIZE = 5000;
    for (let i = 0; i < nodeCount; i += BATCH_SIZE) {
      const batch = networkData.nodes.slice(i, i + BATCH_SIZE);

      batch.forEach((node, batchIndex) => {
        const globalIndex = i + batchIndex;
        const angle = (globalIndex / nodeCount) * 2 * Math.PI;
        const degree = nodeDegrees.get(node.id) || 0;
        const size = 3 + (degree / maxDegree) * 12;

        // Circular layout with some randomness
        const r = radius * (0.3 + 0.7 * Math.random());
        graph.addNode(node.id, {
          label: node.label,
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle),
          size,
          color: node.group ? groupColors.get(node.group) || '#6366f1' : '#6366f1',
          originalNode: node,
        });
      });

      // Yield to UI thread
      if (i + BATCH_SIZE < nodeCount) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Add edges in batches
    for (let i = 0; i < edgeCount; i += BATCH_SIZE) {
      const batch = networkData.edges.slice(i, i + BATCH_SIZE);

      batch.forEach((edge, batchIndex) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          const relType = edge.relationshipType
            ? getRelationshipType(relationshipTypeConfig, edge.relationshipType)
            : null;

          try {
            graph.addEdge(edge.source, edge.target, {
              id: `edge-${i + batchIndex}`,
              size: Math.sqrt(edge.weight || 1),
              color: relType?.color || '#404040',
              type: 'arrow',
            });
          } catch {
            // Skip duplicate edges
          }
        }
      });

      // Yield to UI thread
      if (i + BATCH_SIZE < edgeCount) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return graph;
  }, [networkData, groupColors, relationshipTypeConfig]);

  // Run force-directed layout
  const runLayout = useCallback(async () => {
    if (!graphRef.current || layoutRunningRef.current) return;

    layoutRunningRef.current = true;
    setLayoutRunning(true);
    setLayoutProgress(0);

    const graph = graphRef.current;
    const nodeCount = graph.order;

    // Adjust settings based on graph size
    const settings = {
      iterations: Math.min(LAYOUT_ITERATION_LIMIT, Math.max(10, 500 / Math.sqrt(nodeCount))),
      settings: {
        gravity: 1,
        scalingRatio: 2,
        strongGravityMode: true,
        slowDown: 1 + Math.log10(nodeCount),
        barnesHutOptimize: nodeCount > 1000,
        barnesHutTheta: 0.5,
      },
    };

    // Run layout in batches to avoid blocking UI
    const totalIterations = settings.iterations;
    const batchIterations = Math.ceil(totalIterations / 10);

    for (let i = 0; i < 10 && layoutRunningRef.current; i++) {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          forceAtlas2.assign(graph, {
            iterations: batchIterations,
            settings: settings.settings,
          });
          setLayoutProgress(((i + 1) / 10) * 100);
          resolve();
        }, 0);
      });

      // Refresh sigma
      if (sigmaRef.current) {
        sigmaRef.current.refresh();
      }
    }

    layoutRunningRef.current = false;
    setLayoutRunning(false);
  }, []);

  const stopLayout = useCallback(() => {
    layoutRunningRef.current = false;
    setLayoutRunning(false);
  }, []);

  // Initialize Sigma
  useEffect(() => {
    if (!containerRef.current || networkData.nodes.length === 0) return;

    let cancelled = false;
    setBuildingGraph(true);
    setGraphReady(false);

    const initGraph = async () => {
      // Build graph asynchronously
      const graph = await buildGraphAsync();

      if (cancelled) {
        return;
      }

      graphRef.current = graph;

      // Create Sigma instance
      const sigma = new Sigma(graph, containerRef.current!, {
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        defaultNodeColor: '#6366f1',
        defaultEdgeColor: '#404040',
        labelColor: { color: '#a1a1aa' },
        labelSize: 12,
        labelRenderedSizeThreshold: 6,
        zIndex: true,
      });

      sigmaRef.current = sigma;
      setBuildingGraph(false);
      setGraphReady(true);

      // Handle node hover
      sigma.on('enterNode', ({ node }) => {
        const attrs = graph.getNodeAttributes(node);
        setHoveredNode(attrs.originalNode as NetworkNode);
      });

      sigma.on('leaveNode', () => {
        setHoveredNode(null);
      });

      // Only auto-run layout for smaller graphs
      // Very large graphs start with circular layout and user can manually trigger force layout
      if (networkData.nodes.length < SKIP_AUTO_LAYOUT_THRESHOLD) {
        runLayout();
      }
    };

    initGraph();

    return () => {
      cancelled = true;
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
      graphRef.current = null;
    };
  }, [networkData, buildGraphAsync, runLayout]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!sigmaRef.current) return;
    const camera = sigmaRef.current.getCamera();

    if (direction === 'reset') {
      camera.animatedReset({ duration: 500 });
    } else {
      const factor = direction === 'in' ? 1.3 : 0.7;
      camera.animatedZoom({ factor, duration: 200 });
    }
  };

  if (networkData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">No network data available. Check your column mappings.</p>
      </div>
    );
  }

  // Show loading state while building graph
  if (buildingGraph || !graphReady) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        <div className="text-center">
          <p className="text-zinc-300 font-medium">Building graph...</p>
          <p className="text-zinc-500 text-sm mt-1">
            {stats.nodeCount.toLocaleString()} nodes, {stats.edgeCount.toLocaleString()} edges
          </p>
          {stats.nodeCount > SKIP_AUTO_LAYOUT_THRESHOLD && (
            <p className="text-amber-500 text-xs mt-2">
              Large graph detected. Layout will be circular initially.
            </p>
          )}
        </div>
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
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            WebGL
          </Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">{stats.nodeCount.toLocaleString()} nodes</Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">{stats.edgeCount.toLocaleString()} edges</Badge>
          {stats.nodeCount >= SKIP_AUTO_LAYOUT_THRESHOLD && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              Circular layout (click Run Layout for force-directed)
            </Badge>
          )}
          {onSwitchToSVG && stats.nodeCount < 5000 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onSwitchToSVG}
              className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Switch to SVG
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button
            size="sm"
            variant="outline"
            onClick={layoutRunning ? stopLayout : runLayout}
            className="h-8 gap-1.5 border-zinc-700 hover:bg-zinc-800"
          >
            {layoutRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Stop Layout ({Math.round(layoutProgress)}%)
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Layout
              </>
            )}
          </Button>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('in')}><ZoomIn className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('out')}><ZoomOut className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-700" onClick={() => handleZoom('reset')}><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {layoutRunning && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
              <span className="text-sm text-zinc-300">Computing layout... {Math.round(layoutProgress)}%</span>
            </div>
            <div className="mt-2 w-48 h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${layoutProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={containerRef} className="flex-1 bg-zinc-950 overflow-hidden" />

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
          <div className="text-xs text-zinc-500 mt-2">Scroll to zoom • Drag to pan</div>
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
                  style={{ backgroundColor: groupColors.get(group) }}
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
