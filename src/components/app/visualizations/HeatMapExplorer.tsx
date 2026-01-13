import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCcw, Eye } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

interface HeatMapCell {
  row: string;
  col: string;
  value: number;
  label: string;
}

export function HeatMapExplorer({ bundle }: Props) {
  const [hoveredCell, setHoveredCell] = useState<HeatMapCell | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);
  const [highlightedCol, setHighlightedCol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  // Extract heat map data from bundle
  const heatMapData = useMemo(() => {
    const rowRole = bundle.mappings.find((m) => m.roleId === 'row_label');
    const colRole = bundle.mappings.find((m) => m.roleId === 'column_label');
    const valueRole = bundle.mappings.find((m) => m.roleId === 'cell_value');
    const labelRole = bundle.mappings.find((m) => m.roleId === 'cell_label');

    if (!rowRole || !colRole || !valueRole) {
      return null;
    }

    const cells: HeatMapCell[] = [];
    const rowSet = new Set<string>();
    const colSet = new Set<string>();

    for (const row of bundle.source.parsedData) {
      const rowLabel = String(row[rowRole.sourceColumn] ?? '');
      const colLabel = String(row[colRole.sourceColumn] ?? '');
      const cellValue = Number(row[valueRole.sourceColumn] ?? 0);
      const cellLabel = labelRole ? String(row[labelRole.sourceColumn] ?? cellValue) : String(cellValue);

      if (rowLabel && colLabel) {
        cells.push({
          row: rowLabel,
          col: colLabel,
          value: cellValue,
          label: cellLabel,
        });
        rowSet.add(rowLabel);
        colSet.add(colLabel);
      }
    }

    const rows = Array.from(rowSet);
    const cols = Array.from(colSet);

    return { cells, rows, cols };
  }, [bundle]);

  // Color scale for heat map
  const colorScale = useMemo(() => {
    if (!heatMapData) return null;

    const values = heatMapData.cells.map((c) => c.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return d3
      .scaleSequential(d3.interpolateRdYlGn)
      .domain([min, max]);
  }, [heatMapData]);

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
    svg.call(zoom.transform, d3.zoomIdentity.translate(120, 80).scale(1));

    return () => {
      svg.on('.zoom', null);
    };
  }, [heatMapData]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 4]);

    if (direction === 'reset') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(120, 80).scale(1));
    } else {
      svg.transition().duration(200).call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
    }
  };

  if (!heatMapData || !colorScale) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">
          No heat map data available. Ensure row_label, column_label, and cell_value columns are mapped.
        </p>
      </div>
    );
  }

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('viz')} />;
  }

  const { cells, rows, cols } = heatMapData;
  const cellSize = 60;
  const padding = { top: 20, right: 20, bottom: 20, left: 100 };
  const width = cols.length * cellSize + padding.left + padding.right;
  const height = rows.length * cellSize + padding.top + padding.bottom;

  // Create lookup map for faster cell access
  const cellMap = new Map<string, HeatMapCell>();
  cells.forEach((cell) => {
    cellMap.set(`${cell.row}:${cell.col}`, cell);
  });

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-300">Heat Map</h3>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {rows.length} × {cols.length} matrix
          </Badge>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {cells.length} cells
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

        <div className="h-full overflow-auto">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="cursor-grab active:cursor-grabbing w-full h-full"
            style={{ minWidth: width, minHeight: height }}
          >
            <g ref={gRef}>
              {/* Column labels */}
              <g>
                {cols.map((col, i) => (
                  <text
                    key={col}
                    x={padding.left + i * cellSize + cellSize / 2}
                    y={padding.top - 5}
                    textAnchor="middle"
                    className="text-xs fill-zinc-300 select-none"
                    style={{ fontFamily: 'system-ui', fontWeight: highlightedCol === col ? 'bold' : 'normal' }}
                  >
                    {col}
                  </text>
                ))}
              </g>

              {/* Row labels */}
              <g>
                {rows.map((row, i) => (
                  <text
                    key={row}
                    x={padding.left - 10}
                    y={padding.top + i * cellSize + cellSize / 2 + 4}
                    textAnchor="end"
                    className="text-xs fill-zinc-300 select-none"
                    style={{ fontFamily: 'system-ui', fontWeight: highlightedRow === row ? 'bold' : 'normal' }}
                  >
                    {row}
                  </text>
                ))}
              </g>

              {/* Heat map cells */}
              <g>
                {rows.map((row, rowIdx) =>
                  cols.map((col, colIdx) => {
                    const cell = cellMap.get(`${row}:${col}`);
                    if (!cell) return null;

                    const x = padding.left + colIdx * cellSize;
                    const y = padding.top + rowIdx * cellSize;
                    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
                    const isRowHighlighted = highlightedRow === row;
                    const isColHighlighted = highlightedCol === col;
                    const isHighlighted = isRowHighlighted || isColHighlighted;

                    return (
                      <g
                        key={`${row}:${col}`}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => {
                          if (highlightedRow === row && highlightedCol === col) {
                            setHighlightedRow(null);
                            setHighlightedCol(null);
                          } else {
                            setHighlightedRow(row);
                            setHighlightedCol(col);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={cellSize - 2}
                          height={cellSize - 2}
                          fill={colorScale(cell.value)}
                          stroke={isHovered ? '#fff' : isHighlighted ? '#10b981' : '#27272a'}
                          strokeWidth={isHovered ? 3 : isHighlighted ? 2 : 1}
                          rx={2}
                          className="transition-all duration-150"
                          opacity={isHovered ? 1 : isHighlighted ? 0.9 : 0.85}
                        />
                        <text
                          x={x + cellSize / 2}
                          y={y + cellSize / 2 + 4}
                          textAnchor="middle"
                          className="text-xs fill-zinc-900 select-none font-semibold pointer-events-none"
                          style={{ fontFamily: 'system-ui' }}
                        >
                          {cell.label}
                        </text>
                      </g>
                    );
                  })
                )}
              </g>
            </g>
          </svg>
        </div>

        {/* Cell Detail Panel */}
        {hoveredCell && (
          <div className="absolute bottom-4 right-4 w-64 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-10">
            <div className="space-y-2">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Row</div>
                <div className="text-sm text-zinc-200 font-medium">{hoveredCell.row}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Column</div>
                <div className="text-sm text-zinc-200 font-medium">{hoveredCell.col}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Value</div>
                <div className="text-lg text-emerald-400 font-bold">{hoveredCell.label}</div>
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <div className="text-xs text-zinc-500">
                  Click to highlight row and column
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 w-64 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl">
          <div className="text-xs font-medium text-zinc-300 mb-2">Color Scale</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-500">Low</div>
            <div className="flex-1 h-6 rounded" style={{
              background: `linear-gradient(to right, ${colorScale(colorScale.domain()[0])}, ${colorScale((colorScale.domain()[0] + colorScale.domain()[1]) / 2)}, ${colorScale(colorScale.domain()[1])})`
            }} />
            <div className="text-xs text-zinc-500">High</div>
          </div>
          <div className="flex justify-between mt-1">
            <div className="text-xs text-zinc-400">{colorScale.domain()[0].toFixed(2)}</div>
            <div className="text-xs text-zinc-400">{colorScale.domain()[1].toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
