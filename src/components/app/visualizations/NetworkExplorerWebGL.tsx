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
const VERY_LARGE_GRAPH_THRESHOLD = 20000; // Threshold for optimized loading path
const SAMPLE_THRESHOLD = 75000; // Above this, offer sampling option
const DEFAULT_SAMPLE_SIZE = 25000; // Default sample size for very large graphs

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
  const [buildPhase, setBuildPhase] = useState<'nodes' | 'edges' | 'render'>('nodes');
  const [useSampling, setUseSampling] = useState<boolean | null>(null); // null = not decided yet
  const [sampleSize] = useState(DEFAULT_SAMPLE_SIZE);

  const relationshipTypeConfig = useAppStore((s) => s.relationshipTypeConfig);

  const fullNetworkData = useMemo<NetworkData>(() => {
    try {
      return transformToNetwork(bundle.source, bundle.mappings);
    } catch (e) {
      console.error('Failed to transform network:', e);
      return { nodes: [], edges: [] };
    }
  }, [bundle]);

  // Apply sampling if requested
  const networkData = useMemo<NetworkData>(() => {
    if (!useSampling || fullNetworkData.nodes.length <= sampleSize) {
      return fullNetworkData;
    }

    // Sample nodes by degree (keep nodes with most connections)
    const nodeDegrees = new Map<string, number>();
    for (const edge of fullNetworkData.edges) {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    }

    // Sort nodes by degree and take top N
    const sortedNodes = [...fullNetworkData.nodes].sort((a, b) => {
      return (nodeDegrees.get(b.id) || 0) - (nodeDegrees.get(a.id) || 0);
    });

    const sampledNodes = sortedNodes.slice(0, sampleSize);
    const sampledNodeIds = new Set(sampledNodes.map(n => n.id));

    // Filter edges to only include sampled nodes
    const sampledEdges = fullNetworkData.edges.filter(
      edge => sampledNodeIds.has(edge.source) && sampledNodeIds.has(edge.target)
    );

    return { nodes: sampledNodes, edges: sampledEdges };
  }, [fullNetworkData, useSampling, sampleSize]);

  // Stats for the full (unsampled) data - used to decide on sampling
  const fullStats = useMemo(() => {
    return {
      nodeCount: fullNetworkData.nodes.length,
      edgeCount: fullNetworkData.edges.length,
    };
  }, [fullNetworkData]);

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
      isSampled: useSampling && fullNetworkData.nodes.length > sampleSize,
      originalNodeCount: fullNetworkData.nodes.length,
      originalEdgeCount: fullNetworkData.edges.length,
    };
  }, [networkData, useSampling, fullNetworkData, sampleSize]);

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

  // Build the graphology graph - optimized for large graphs
  const buildGraphAsync = useCallback(async (): Promise<Graph> => {
    const graph = new Graph();
    const nodeCount = networkData.nodes.length;
    const edgeCount = networkData.edges.length;
    const isVeryLarge = nodeCount > VERY_LARGE_GRAPH_THRESHOLD;

    // Pre-calculate all node degrees in a single pass using a plain object (faster than Map for large data)
    const nodeDegrees: Record<string, number> = {};
    for (let i = 0; i < edgeCount; i++) {
      const edge = networkData.edges[i];
      nodeDegrees[edge.source] = (nodeDegrees[edge.source] || 0) + 1;
      nodeDegrees[edge.target] = (nodeDegrees[edge.target] || 0) + 1;
    }

    // Find max degree
    let maxDegree = 1;
    for (const id in nodeDegrees) {
      if (nodeDegrees[id] > maxDegree) maxDegree = nodeDegrees[id];
    }

    // Layout parameters
    const radius = Math.min(2000, Math.sqrt(nodeCount) * 15);
    const centerX = 1000;
    const centerY = 1000;

    // For very large graphs, use pre-computed positions without randomness
    // This is MUCH faster than calling Math.random() 100K times
    const angleStep = (2 * Math.PI) / nodeCount;

    // OPTIMIZATION: For very large graphs, add all nodes synchronously in one go
    // The batching/yielding overhead actually slows things down more than it helps
    if (isVeryLarge) {
      // Add all nodes at once - much faster than batched approach
      for (let i = 0; i < nodeCount; i++) {
        const node = networkData.nodes[i];
        const angle = i * angleStep;
        const degree = nodeDegrees[node.id] || 0;
        // Spiral layout: nodes with higher degree towards center
        const r = radius * (0.2 + 0.8 * (1 - degree / maxDegree));

        graph.addNode(node.id, {
          label: node.label,
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle),
          size: 2 + (degree / maxDegree) * 8,
          color: node.group ? groupColors.get(node.group) || '#6366f1' : '#6366f1',
          originalNode: node,
        });
      }

      // Yield once after all nodes
      await new Promise(resolve => setTimeout(resolve, 0));

      // Add all edges at once
      const addedEdges = new Set<string>();
      for (let i = 0; i < edgeCount; i++) {
        const edge = networkData.edges[i];
        const edgeKey = `${edge.source}-${edge.target}`;
        if (!addedEdges.has(edgeKey) && graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          addedEdges.add(edgeKey);
          const relType = edge.relationshipType
            ? getRelationshipType(relationshipTypeConfig, edge.relationshipType)
            : null;
          try {
            graph.addEdge(edge.source, edge.target, {
              size: 0.5,
              color: relType?.color || '#303030',
              type: 'arrow',
            });
          } catch {
            // Skip errors
          }
        }
      }
    } else {
      // Original batched approach for smaller graphs
      const BATCH_SIZE = 5000;

      for (let i = 0; i < nodeCount; i += BATCH_SIZE) {
        const end = Math.min(i + BATCH_SIZE, nodeCount);
        for (let j = i; j < end; j++) {
          const node = networkData.nodes[j];
          const angle = j * angleStep;
          const degree = nodeDegrees[node.id] || 0;
          const r = radius * (0.3 + 0.7 * Math.random());

          graph.addNode(node.id, {
            label: node.label,
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
            size: 3 + (degree / maxDegree) * 12,
            color: node.group ? groupColors.get(node.group) || '#6366f1' : '#6366f1',
            originalNode: node,
          });
        }

        if (end < nodeCount) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Add edges in batches
      for (let i = 0; i < edgeCount; i += BATCH_SIZE) {
        const end = Math.min(i + BATCH_SIZE, edgeCount);
        for (let j = i; j < end; j++) {
          const edge = networkData.edges[j];
          if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
            const relType = edge.relationshipType
              ? getRelationshipType(relationshipTypeConfig, edge.relationshipType)
              : null;
            try {
              graph.addEdge(edge.source, edge.target, {
                size: Math.sqrt(edge.weight || 1),
                color: relType?.color || '#404040',
                type: 'arrow',
              });
            } catch {
              // Skip duplicate edges
            }
          }
        }

        if (end < edgeCount) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
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
    // Don't initialize until sampling decision is made for large graphs
    if (fullNetworkData.nodes.length > SAMPLE_THRESHOLD && useSampling === null) return;
    if (!containerRef.current || networkData.nodes.length === 0) return;

    let cancelled = false;
    setBuildingGraph(true);
    setGraphReady(false);

    const initGraph = async () => {
      setBuildPhase('nodes');

      // Build graph asynchronously
      const graph = await buildGraphAsync();

      if (cancelled) {
        return;
      }

      setBuildPhase('render');
      // Give UI a chance to update
      await new Promise(resolve => setTimeout(resolve, 10));

      graphRef.current = graph;

      const isVeryLarge = networkData.nodes.length > VERY_LARGE_GRAPH_THRESHOLD;

      // Create Sigma instance with settings optimized for graph size
      const sigma = new Sigma(graph, containerRef.current!, {
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        defaultNodeColor: '#6366f1',
        defaultEdgeColor: '#404040',
        labelColor: { color: '#a1a1aa' },
        labelSize: isVeryLarge ? 10 : 12,
        // For very large graphs, only show labels when zoomed in a lot
        labelRenderedSizeThreshold: isVeryLarge ? 12 : 6,
        // Disable expensive features for large graphs
        zIndex: !isVeryLarge,
        // Reduce anti-aliasing for performance
        allowInvalidContainer: true,
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
  }, [networkData, buildGraphAsync, runLayout, useSampling]);

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

  // For very large graphs, ask user if they want to sample
  if (fullStats.nodeCount > SAMPLE_THRESHOLD && useSampling === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
            <Info className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-200 mb-2">Large Graph Detected</h3>
          <p className="text-zinc-400 text-sm mb-4">
            This graph has <span className="text-amber-400 font-medium">{fullStats.nodeCount.toLocaleString()}</span> nodes and{' '}
            <span className="text-amber-400 font-medium">{fullStats.edgeCount.toLocaleString()}</span> edges.
            Loading this many nodes may take a while and could affect browser performance.
          </p>

          <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
            <p className="text-xs text-zinc-500 mb-3">Choose how to proceed:</p>
            <div className="space-y-2">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  setUseSampling(true);
                }}
              >
                Sample {DEFAULT_SAMPLE_SIZE.toLocaleString()} nodes (Recommended)
              </Button>
              <Button
                variant="outline"
                className="w-full border-zinc-700"
                onClick={() => {
                  setUseSampling(false);
                }}
              >
                Load all {fullStats.nodeCount.toLocaleString()} nodes (may be slow)
              </Button>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Sampling selects nodes with the most connections to preserve the graph structure.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state while building graph
  if (buildingGraph || !graphReady) {
    const phaseText = {
      nodes: 'Adding nodes...',
      edges: 'Adding edges...',
      render: 'Initializing renderer...',
    };

    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        <div className="text-center">
          <p className="text-zinc-300 font-medium">{phaseText[buildPhase]}</p>
          <p className="text-zinc-500 text-sm mt-1">
            {stats.nodeCount.toLocaleString()} nodes, {stats.edgeCount.toLocaleString()} edges
          </p>
          {stats.nodeCount > VERY_LARGE_GRAPH_THRESHOLD && (
            <p className="text-amber-500 text-xs mt-2">
              Large graph - using optimized circular layout
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
          {stats.isSampled && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
              Sampled from {stats.originalNodeCount?.toLocaleString()} nodes
            </Badge>
          )}
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
