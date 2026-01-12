import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ZoomIn, ZoomOut, RotateCcw, Eye, Calendar, LayoutList } from 'lucide-react';
import { DataGridView } from './DataGridView';
import type { DataBundle, SemanticSchema } from '@/types';

interface Props {
  bundle: DataBundle;
  schema: SemanticSchema;
}

interface TimelineEvent {
  id: string;
  name: string;
  start: Date;
  end: Date;
  category: string;
  status: string;
  description?: string;
  duration: number; // in days
}

type ViewType = 'gantt' | 'calendar';

export function TimelineExplorer({ bundle }: Props) {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'viz' | 'grid'>('viz');
  const [viewType, setViewType] = useState<ViewType>('gantt');

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  // Extract timeline data from bundle
  const timelineData = useMemo(() => {
    const nameRole = bundle.mappings.find((m) => m.roleId === 'event_name');
    const startRole = bundle.mappings.find((m) => m.roleId === 'start_date');
    const endRole = bundle.mappings.find((m) => m.roleId === 'end_date');
    const categoryRole = bundle.mappings.find((m) => m.roleId === 'category');
    const statusRole = bundle.mappings.find((m) => m.roleId === 'status');
    const descriptionRole = bundle.mappings.find((m) => m.roleId === 'description');

    if (!nameRole || !startRole) {
      return null;
    }

    const events: TimelineEvent[] = [];
    const categories = new Set<string>();

    for (const row of bundle.source.parsedData) {
      const name = String(row[nameRole.sourceColumn] ?? '');
      const startStr = String(row[startRole.sourceColumn] ?? '');
      const endStr = endRole ? String(row[endRole.sourceColumn] ?? startStr) : startStr;
      const category = categoryRole ? String(row[categoryRole.sourceColumn] ?? 'Uncategorized') : 'Uncategorized';
      const status = statusRole ? String(row[statusRole.sourceColumn] ?? 'unknown') : 'unknown';
      const description = descriptionRole ? String(row[descriptionRole.sourceColumn] ?? '') : '';

      const start = new Date(startStr);
      const end = new Date(endStr);

      if (name && !isNaN(start.getTime())) {
        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        events.push({
          id: `${name}-${start.getTime()}`,
          name,
          start,
          end: isNaN(end.getTime()) ? start : end,
          category,
          status,
          description,
          duration,
        });
        categories.add(category);
      }
    }

    // Sort by start date
    events.sort((a, b) => a.start.getTime() - b.start.getTime());

    return { events, categories: Array.from(categories) };
  }, [bundle]);

  // Category colors
  const categoryColors = useMemo(() => {
    if (!timelineData) return new Map();
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);
    const map = new Map<string, string>();
    timelineData.categories.forEach((cat, i) => {
      map.set(cat, colorScale(String(i)));
    });
    return map;
  }, [timelineData]);

  // Status colors
  const statusColors: Record<string, string> = {
    completed: '#10b981',
    in_progress: '#3b82f6',
    planned: '#6b7280',
    delayed: '#ef4444',
    cancelled: '#71717a',
    unknown: '#52525b',
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!timelineData) return [];
    if (selectedCategories.size === 0) return timelineData.events;
    return timelineData.events.filter((e) => selectedCategories.has(e.category));
  }, [timelineData, selectedCategories]);

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
  }, [timelineData, viewType]);

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

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (!timelineData) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">
          No timeline data available. Ensure event_name and start_date columns are mapped.
        </p>
      </div>
    );
  }

  // Show grid view
  if (viewMode === 'grid') {
    return <DataGridView bundle={bundle} onBackToProfile={() => setViewMode('viz')} />;
  }

  const { events, categories } = timelineData;
  const margin = { top: 60, right: 20, bottom: 40, left: 200 };
  const rowHeight = 40;
  const width = 1400;
  const height = filteredEvents.length * rowHeight + margin.top + margin.bottom;

  // Time scale
  const timeExtent = d3.extent(events, (e) => e.start) as [Date, Date];
  const timeEnd = d3.max(events, (e) => e.end) || timeExtent[1];
  const xScale = d3
    .scaleTime()
    .domain([timeExtent[0], timeEnd])
    .range([margin.left, width - margin.right]);

  // Format dates
  const formatDate = d3.timeFormat('%b %d, %Y');
  const formatMonth = d3.timeFormat('%b %Y');

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Timeline</h3>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {filteredEvents.length} events
          </Badge>
          <ToggleGroup type="single" value={viewType} onValueChange={(v) => v && setViewType(v as ViewType)}>
            <ToggleGroupItem value="gantt" aria-label="Gantt view" className="h-8 px-3 data-[state=on]:bg-zinc-700">
              <LayoutList className="w-4 h-4 mr-1" />
              Gantt
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendar view" className="h-8 px-3 data-[state=on]:bg-zinc-700">
              <Calendar className="w-4 h-4 mr-1" />
              Calendar
            </ToggleGroupItem>
          </ToggleGroup>
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

      {/* Category Filters */}
      <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">Categories:</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedCategories(new Set())}
          className="h-6 px-2 text-xs"
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={selectedCategories.size === 0 || selectedCategories.has(cat) ? 'default' : 'outline'}
            onClick={() => toggleCategory(cat)}
            className="h-6 px-2 text-xs"
            style={{
              backgroundColor:
                selectedCategories.size === 0 || selectedCategories.has(cat)
                  ? categoryColors.get(cat)
                  : undefined,
            }}
          >
            {cat}
          </Button>
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
          {viewType === 'gantt' ? (
            <svg
              ref={svgRef}
              width={width}
              height={height}
              className="cursor-grab active:cursor-grabbing"
            >
              <g ref={gRef}>
                {/* X Axis */}
                <g transform={`translate(0,${margin.top - 10})`}>
                  {xScale.ticks(10).map((tick) => (
                    <g key={tick.getTime()} transform={`translate(${xScale(tick)},0)`}>
                      <line y1={0} y2={height - margin.top - margin.bottom + 10} stroke="#27272a" strokeWidth={1} />
                      <text
                        y={-5}
                        textAnchor="middle"
                        className="text-xs fill-zinc-400"
                        style={{ fontFamily: 'system-ui' }}
                      >
                        {formatMonth(tick)}
                      </text>
                    </g>
                  ))}
                </g>

                {/* Event bars */}
                {filteredEvents.map((event, i) => {
                  const y = margin.top + i * rowHeight;
                  const x1 = xScale(event.start);
                  const x2 = xScale(event.end);
                  const barWidth = Math.max(x2 - x1, 4);
                  const isHovered = hoveredEvent?.id === event.id;
                  const color = statusColors[event.status.toLowerCase()] || statusColors.unknown;

                  return (
                    <g
                      key={event.id}
                      onMouseEnter={() => setHoveredEvent(event)}
                      onMouseLeave={() => setHoveredEvent(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Event label */}
                      <text
                        x={margin.left - 10}
                        y={y + rowHeight / 2 + 4}
                        textAnchor="end"
                        className="text-sm fill-zinc-300 select-none"
                        style={{ fontFamily: 'system-ui', fontWeight: isHovered ? 'bold' : 'normal' }}
                      >
                        {event.name}
                      </text>

                      {/* Event bar */}
                      <rect
                        x={x1}
                        y={y + 5}
                        width={barWidth}
                        height={rowHeight - 10}
                        fill={color}
                        fillOpacity={isHovered ? 0.9 : 0.7}
                        stroke={isHovered ? '#fff' : color}
                        strokeWidth={isHovered ? 2 : 0}
                        rx={4}
                        className="transition-all duration-150"
                      />

                      {/* Category badge */}
                      {barWidth > 60 && (
                        <text
                          x={x1 + 8}
                          y={y + rowHeight / 2 + 4}
                          className="text-xs fill-white select-none"
                          style={{ fontFamily: 'system-ui', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                        >
                          {event.category}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-500">Calendar view coming soon...</p>
            </div>
          )}
        </div>

        {/* Event Detail Panel */}
        {hoveredEvent && (
          <div className="absolute bottom-4 right-4 w-80 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl z-10">
            <h3 className="font-semibold text-zinc-100 mb-1">{hoveredEvent.name}</h3>
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: categoryColors.get(hoveredEvent.category),
                  color: '#fff',
                }}
              >
                {hoveredEvent.category}
              </Badge>
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: statusColors[hoveredEvent.status.toLowerCase()] || statusColors.unknown,
                  color: '#fff',
                }}
              >
                {hoveredEvent.status}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-zinc-500">Start:</span>{' '}
                <span className="text-zinc-200">{formatDate(hoveredEvent.start)}</span>
              </div>
              <div>
                <span className="text-zinc-500">End:</span>{' '}
                <span className="text-zinc-200">{formatDate(hoveredEvent.end)}</span>
              </div>
              <div>
                <span className="text-zinc-500">Duration:</span>{' '}
                <span className="text-emerald-400 font-bold">{hoveredEvent.duration} days</span>
              </div>
              {hoveredEvent.description && (
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs text-zinc-400">{hoveredEvent.description}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
